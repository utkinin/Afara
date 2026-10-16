import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalReq, type Payload } from 'payload'
import { cms } from '../src/lib/payload'
import { collectionDisclosure } from '../src/lib/editorial'
import type { Page } from '../src/payload-types'

export type EditorialImage = {
  id: string; title: string; question: string; description: string; page: string
  desktop: { file: string; sha256: string; width: number; height: number }
  mobile: { file: string; sha256: string; width: number; height: number }
  generation: { tool: string; date: string; resultId: string; prompt: string }
}
type Answer = { topic: string; page: string; question: string; answer: string; keywords: string; sources: string[] }
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const root = fileURLToPath(new URL('../', import.meta.url))

export async function importVisuals(p: Payload, apply = false) {
  if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Use development with AFARA_DB_PUSH=false; never run an automatic production import')
  const manifest = JSON.parse(await readFile(path.join(root, 'fixtures/editorial/manifest.json'), 'utf8')) as { version: number; images: EditorialImage[] }
  const answers = JSON.parse(await readFile(path.join(root, 'content/editorial-knowledge.json'), 'utf8')) as Answer[]
  if (manifest.version !== 1 || manifest.images.length !== 16 || new Set(manifest.images.map(i => i.id)).size !== 16 || answers.length !== 8 || new Set(answers.map(a => a.topic)).size !== 8) throw new Error('Incomplete or duplicate editorial package')
  for (const image of manifest.images) {
    if (!/^[a-z0-9-]+$/.test(image.id)) throw new Error('Invalid image id')
    for (const variant of [image.desktop, image.mobile]) {
      if (!/^[a-z0-9-]+\.webp$/.test(variant.file)) throw new Error('Invalid asset path')
      const data = await readFile(path.join(root, 'fixtures/editorial', variant.file))
      if (createHash('sha256').update(data).digest('hex') !== variant.sha256) throw new Error(`Hash mismatch: ${variant.file}`)
    }
  }
  for (const a of answers) {
    if (!a.topic.startsWith('editorial-') || a.answer.length > 2000 || a.sources.some(s => new URL(s).protocol !== 'https:')) throw new Error('Invalid knowledge proposal')
  }
  const getPages = (draft = false) => p.find({ collection: 'pages', draft, depth: 0, pagination: false, limit: 10000, sort: 'id' })
  const publicPages = (await getPages()).docs
  const latestPages = (await getPages(true)).docs
  const oldDrafts = latestPages.filter(d => d._status === 'draft')
  const knowledge = (await p.find({ collection: 'knowledge', draft: false, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs
  const latestKnowledge = (await p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs
  const media = (await p.find({ collection: 'media', draft: false, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs
  const site = await p.findGlobal({ slug: 'site', draft: false, depth: 0 })
  const siteDraft = await p.findGlobal({ slug: 'site', draft: true, depth: 0 })
  const baseline = digest({ publicPages, knowledge, media, oldDrafts, latestKnowledge, site, siteDraft })
  const report: string[] = [], images = new Map<string, { desktop: number; mobile: number }>()
  const tx = apply ? await p.db.beginTransaction() : null
  if (apply && !tx) throw new Error('A real transaction is required')
  const req = await createLocalReq({ req: { transactionID: tx || undefined } }, p)
  try {
    for (const image of manifest.images) {
      const ids = { desktop: 0, mobile: 0 }
      for (const variant of ['desktop', 'mobile'] as const) {
        const token = `AFARA editorial v1:${image.id}:${variant};`
        const existing = media.filter(m => m.source.startsWith(token))
        if (existing.length > 1) throw new Error(`Duplicate import identity: ${token}`)
        if (existing.length) { ids[variant] = existing[0].id; continue }
        report.push(`Новый медиа-черновик: ${image.id}/${variant}`)
        if (apply) {
          const m = await p.create({ collection: 'media', draft: true, req, filePath: path.join(root, 'fixtures/editorial', image[variant].file), data: {
            alt: `Концепция: ${image.title}`, caption: collectionDisclosure, origin: 'ai', rightsConfirmed: false,
            source: `${token} sha256=${image[variant].sha256}\n${JSON.stringify(image.generation)}\nОригинальная генерация для AFARA. Мобильный вариант — адаптивный кадр оригинала. Не выполненный заказ и не изображение производителя. Права и пригодность перед публикацией проверяет ADMIN.`, _status: 'draft',
          } })
          ids[variant] = m.id
        }
      }
      images.set(image.id, ids)
    }
    const proposals = new Map<string, EditorialImage[]>()
    proposals.set('home', manifest.images)
    for (const image of manifest.images.filter(i => i.page !== 'home')) proposals.set(image.page, [image])
    for (const [pagePath, collection] of proposals) {
      const current = latestPages.find(p => p.path === pagePath)
      if (!current) { report.push(`Пропущено: отсутствует страница ${pagePath}`); continue }
      if (current._status === 'draft') { report.push(`Сохранён существующий черновик: ${pagePath}`); continue }
      if (current.sections?.some(s => s.anchor === 'visual-collection')) { report.push(`Коллекция уже существует, сохранена: ${pagePath}`); continue }
      const fresh = await p.findByID({ collection: 'pages', id: current.id, draft: true, depth: 0, req })
      if (digest(fresh) !== digest(current)) throw new Error(`Page changed during preparation: ${pagePath}`)
      const hero = collection.find(i => i.id === 'home') || collection[0]
      const section: NonNullable<Page['sections']>[number] = {
        kind: 'details', anchor: 'visual-collection', heading: pagePath === 'home' ? 'Найдите свою задачу в пространстве' : hero.question,
        body: collectionDisclosure, cards: collection.map(image => ({ id: `editorial-${image.id}`, title: image.title, body: `${image.question} ${image.description}`, image: images.get(image.id)!.desktop,
          page: publicPages.find(p => p.path === image.page)?.id, linkLabel: 'Обсудить пространство',
        })),
      }
      report.push(`Новый черновик страницы: ${pagePath} (существующие тексты и блоки сохранены)`)
      if (apply) await p.update({ collection: 'pages', id: current.id, draft: true, req, data: {
        hero: images.get(hero.id)!.desktop, heroMobile: images.get(hero.id)!.mobile, heroAlt: `Концепция: ${hero.title}`, heroPosition: 50,
        conceptLabel: '', sections: [...(current.sections || []), section], _status: 'draft',
      } })
    }
    for (const a of answers) {
      if (latestKnowledge.some(k => k.topic === a.topic)) { report.push(`Сохранён существующий материал: ${a.topic}`); continue }
      const page = publicPages.find(p => p.path === a.page)
      if (!page) { report.push(`Пропущен ответ без источника-страницы: ${a.topic}`); continue }
      report.push(`Новый ответ-черновик без одобрения: ${a.topic}`)
      if (apply) await p.create({ collection: 'knowledge', draft: true, req, data: { question: a.question, answer: a.answer + (a.sources.length ? `\n\nРедакционные источники: ${a.sources.join(' ; ')}` : ''), topic: a.topic, keywords: a.keywords, page: page.id, approved: false, _status: 'draft' } })
    }
    // Verify inside the transaction: inadvertent overwrites abort the entire import.
    const existing = async <T extends 'pages' | 'knowledge' | 'media'>(collection: T, ids: number[], draft = false) => ids.length ? (await p.find({ collection, req, draft, depth: 0, pagination: false, limit: 10000, sort: 'id', where: { id: { in: ids } } })).docs : []
    const after = digest({
      publicPages: await existing('pages', publicPages.map(d => d.id)), knowledge: await existing('knowledge', knowledge.map(d => d.id)), media: await existing('media', media.map(d => d.id)),
      oldDrafts: await existing('pages', oldDrafts.map(d => d.id), true), latestKnowledge: await existing('knowledge', latestKnowledge.map(d => d.id), true),
      site: await p.findGlobal({ slug: 'site', draft: false, depth: 0, req }), siteDraft: await p.findGlobal({ slug: 'site', draft: true, depth: 0, req }),
    })
    if (after !== baseline) throw new Error('Existing CMS content changed; rolling back')
    if (tx) await p.db.commitTransaction(tx)
    report.push(`Проверено полное совпадение исходных записей и существующих черновиков: SHA-256 ${baseline}`)
    report.push(apply ? 'Импорт завершён. Ничего не опубликовано; новые знания не одобрены.' : 'План без записи. Для создания черновиков используйте --apply-drafts.')
    return { report, baseline, applied: apply }
  } catch (error) {
    if (tx) await p.db.rollbackTransaction(tx)
    throw error
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const p = await cms()
  try {
    const result = await importVisuals(p, process.argv.includes('--apply-drafts'))
    if (process.env.AFARA_EDITORIAL_REPORT) {
      const destination = path.resolve(process.env.AFARA_EDITORIAL_REPORT)
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
      await writeFile(destination, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
    }
    console.log(result.report.join('\n'))
  } finally { await p.destroy() }
  process.exit(0)
}
