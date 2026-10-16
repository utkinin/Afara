import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalReq } from 'payload'
import { cms } from '../src/lib/payload'
import { cleanContent, cleanPublicText, refreshPage } from '../content/refresh'
import { partnerAnswers, partnerIntro, partnerPath, partnerSections, partnerSEO, russianGeography } from '../content/partners'
import type { Page } from '../src/payload-types'

const root = fileURLToPath(new URL('../', import.meta.url))
const apply = process.argv.includes('--apply-published')
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
type Asset = { id: string; desktop: { file: string; sha256: string }; mobile: { file: string; sha256: string }; [key: string]: unknown }

if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Use the existing development CMS with AFARA_DB_PUSH=false. This command never initializes a database.')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the existing CMS. No CMS content was changed.')
const initial = JSON.parse(await readFile(path.join(root, 'fixtures/editorial/manifest.json'), 'utf8')) as { images: Asset[] }
const added = JSON.parse(await readFile(path.join(root, 'content/refresh-assets.json'), 'utf8')) as { images: Asset[] }
const assets = [...initial.images, ...added.images]
if (new Set(assets.map(a => a.id)).size !== assets.length) throw new Error('Duplicate asset identity')
for (const asset of assets) for (const variant of ['desktop', 'mobile'] as const) {
  const record = asset[variant]
  if (!/^[a-z0-9-]+\.webp$/.test(record.file)) throw new Error('Invalid asset path')
  const bytes = await readFile(path.join(root, 'fixtures/editorial', record.file))
  if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error(`Asset checksum mismatch: ${record.file}`)
}

const p = await cms()
let tx: string | number | null = null
try {
  const load = async () => ({
    pages: (await p.find({ collection: 'pages', draft: false, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs,
    latest: (await p.find({ collection: 'pages', draft: true, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs,
    media: (await p.find({ collection: 'media', draft: true, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs,
    knowledge: (await p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, limit: 10000, sort: 'id' })).docs,
    site: await p.findGlobal({ slug: 'site', draft: false, depth: 0 }),
    siteLatest: await p.findGlobal({ slug: 'site', draft: true, depth: 0 }),
  })
  const before = await load(), fingerprint = hash(before)
  const conflicts = before.latest.filter(page => page._status === 'draft').map(page => page.path)
  if (before.siteLatest._status === 'draft') conflicts.push('site (глобальные настройки)')
  const report = {
    release: 'afara-partners-20261016', baseline: fingerprint, applied: false,
    conflicts, changes: ['Разные кадры для пространств, композиций и разбора решения', 'Остекление от 3 до 6 м', russianGeography, 'Страница /partnyoram/, блок на главной, меню и footer', '5 ответов для публичной библиотеки консультанта'],
  }
  if (!apply) { console.log(JSON.stringify(report, null, 2)); process.exitCode = conflicts.length ? 2 : 0 }
  else {
    if (conflicts.length) throw new Error(`Existing owner drafts were preserved. Resolve before publication: ${conflicts.join(', ')}`)
    const backupRoot = process.env.AFARA_CONTENT_BACKUP_DIR
    if (!backupRoot || !path.isAbsolute(backupRoot) || path.resolve(backupRoot).startsWith(root)) throw new Error('Set AFARA_CONTENT_BACKUP_DIR to an absolute private directory outside this checkout')
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    await writeFile(path.join(backupRoot, `content-${Date.now()}.json`), JSON.stringify(before), { mode: 0o600, flag: 'wx' })
    if (hash(await load()) !== fingerprint) throw new Error('CMS changed after the plan; no changes applied')
    tx = await p.db.beginTransaction()
    if (!tx) throw new Error('A database transaction is required')
    const req = await createLocalReq({ req: { transactionID: tx } }, p)
    const ids: Record<string, number> = {}, mobileIds: Record<string, number> = {}
    for (const asset of assets) for (const variant of ['desktop', 'mobile'] as const) {
      const token = `${added.images.includes(asset) ? 'AFARA refresh v1' : 'AFARA editorial v1'}:${asset.id}:${variant};`
      const matches = before.media.filter(m => m.source.startsWith(token))
      if (matches.length > 1) throw new Error(`Duplicate imported media: ${token}`)
      let id = matches[0]?.id
      if (id) {
        if (matches[0]._status !== 'published' || !matches[0].rightsConfirmed) throw new Error(`Media draft preserved; resolve before publishing: ${token}`)
      } else {
        const image = await p.create({ collection: 'media', req, filePath: path.join(root, 'fixtures/editorial', asset[variant].file), data: {
          alt: asset.id === 'partners' ? 'Палитра тканей и архитектурный эскиз' : asset.id === 'sculptural' ? 'Двухцветная портьера со светлой отделкой' : String(asset.title || asset.id),
          caption: 'Коллекция идей AFARA для обсуждения текстильного решения.', origin: 'ai', rightsConfirmed: true,
          source: `${token} sha256=${asset[variant].sha256}\n${JSON.stringify(asset.generation || asset)}\nОригинальная генерация. Не реализованный объект. Публикация по поручению владельца от 16.10.2026.`, _status: 'published',
        } })
        id = image.id
      }
      ;(variant === 'desktop' ? ids : mobileIds)[asset.id] = id
    }
    let partner = before.pages.find(page => page.path === partnerPath)
    if (!partner) partner = await p.create({ collection: 'pages', req, data: {
      title: 'Партнёрам', path: partnerPath, type: 'direction', parent: null, navOrder: 90, serviceConfirmed: true,
      h1: 'Текстильная комплектация для дизайнеров и архитекторов', intro: partnerIntro,
      hero: ids.partners, heroMobile: mobileIds.partners, heroAlt: 'Ткани и архитектурный эскиз для совместного проекта', heroPosition: 50,
      cta: 'Обсудить сотрудничество', detailsLabel: 'Форматы работы', conceptLabel: '', seo: partnerSEO,
      sections: partnerSections(ids), _status: 'published',
    } })
    const allPages: Page[] = [...before.pages.filter(page => page.id !== partner.id), partner]
    let updatedPages = 0
    for (const page of before.pages.filter(page => page._status === 'published' && page.path !== partnerPath)) {
      const patch = refreshPage(page, allPages, ids, partner.id)
      if (page.path === 'chastnye-interery') patch.heroMobile = mobileIds.apartment
      if (page.path === 'obshchestvennye-prostranstva') patch.heroMobile = mobileIds.restaurant
      const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !equal(page[key as keyof Page], value)))
      if (!Object.keys(changed).length) continue
      const fresh = await p.findByID({ collection: 'pages', id: page.id, draft: true, depth: 0, req })
      if (!equal(fresh, before.latest.find(old => old.id === page.id))) throw new Error(`Concurrent edit: ${page.path}`)
      await p.update({ collection: 'pages', id: page.id, req, data: { ...changed, _status: 'published' } })
      updatedPages++
    }
    const site = before.site
    const sitePatch = { geography: russianGeography, studio: cleanContent(site.studio), trust: cleanContent(site.trust), menu: site.menu?.some(m => m.anchor === 'partners') ? site.menu : [...(site.menu || []), { label: 'Партнёрам', anchor: 'partners' }] }
    if (Object.entries(sitePatch).some(([key, value]) => !equal(site[key as keyof typeof site], value))) await p.updateGlobal({ slug: 'site', req, data: { ...sitePatch, _status: 'published' } })
    for (const answer of before.knowledge.filter(k => k._status === 'published')) {
      const cleaned = cleanPublicText(answer.answer)
      if (cleaned !== answer.answer) await p.update({ collection: 'knowledge', id: answer.id, req, data: { answer: cleaned, _status: 'published' } })
    }
    for (const answer of partnerAnswers) if (!before.knowledge.some(k => k.topic === answer.topic)) {
      await p.create({ collection: 'knowledge', req, data: { ...answer, page: partner.id, approved: true, _status: 'published' } })
    }
    for (const image of before.media.filter(m => m._status === 'published')) {
      const alt = cleanPublicText(image.alt), caption = image.caption ? cleanPublicText(image.caption) : image.caption
      if (alt !== image.alt || caption !== image.caption) await p.update({ collection: 'media', id: image.id, req, data: { alt, caption, _status: 'published' } })
    }
    await p.create({ collection: 'audit', req, data: { actor: 'content-refresh-cli', action: 'publish-release', object: 'afara-partners-20261016', version: fingerprint } })
    await p.db.commitTransaction(tx); tx = null
    console.log(JSON.stringify({ ...report, applied: true, updatedPages, partner: partnerPath, note: 'Страницы и настройки опубликованы в подключённой CMS. Снимок GitHub Pages обновляется отдельно.' }, null, 2))
  }
} catch (error) {
  if (tx) await p.db.rollbackTransaction(tx)
  throw error
} finally { await p.destroy() }
