import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createLocalReq } from 'payload'
import { cms } from '../src/lib/payload'
import { expansionImages, servicePages, pageUpdates, siteUpdate, newKnowledge, semanticCopy } from '../src/lib/copy-expansion'
import { collectionDisclosure } from '../src/lib/editorial'
import type { Page, Site, Knowledge } from '../src/payload-types'

const apply = process.argv.includes('--apply')
if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Use development and AFARA_DB_PUSH=false')
if (!process.env.AFARA_EXPANSION_BASELINE) throw new Error('An explicit private pre-change CMS snapshot is required')
const baseline = JSON.parse(await readFile(process.env.AFARA_EXPANSION_BASELINE, 'utf8')) as { pages: Page[]; site: Site; draft: Page[]; knowledge: Knowledge[] }
const manifest = JSON.parse(await readFile('fixtures/content-expansion/manifest.json', 'utf8')) as { images: { id: string; prompt: string; resultId: string; desktop: { file: string; sha256: string }; mobile: { file: string; sha256: string } }[] }
if (manifest.images.length !== 3) throw new Error('Incomplete image collection')
for (const m of manifest.images) for (const variant of ['desktop', 'mobile'] as const) {
  if (!/^[a-z-]+\.webp$/.test(m[variant].file)) throw new Error('Invalid file path')
  const data = await readFile(path.join('fixtures/content-expansion', m[variant].file))
  if (createHash('sha256').update(data).digest('hex') !== m[variant].sha256) throw new Error('Asset hash mismatch')
}
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v
const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const p = await cms(), report: string[] = []
const pages = (await p.find({ collection: 'pages', draft: false, depth: 0, limit: 1000 })).docs
const latest = (await p.find({ collection: 'pages', draft: true, depth: 0, limit: 1000 })).docs
const media = (await p.find({ collection: 'media', depth: 0, limit: 1000 })).docs
const site = await p.findGlobal({ slug: 'site', draft: false, depth: 0 })
const siteDraft = await p.findGlobal({ slug: 'site', draft: true, depth: 0 })
const existingKnowledge = (await p.find({ collection: 'knowledge', draft: true, depth: 0, limit: 1000 })).docs
const changed: string[] = [], skipped: string[] = []
const tx = apply ? await p.db.beginTransaction() : null
if (apply && !tx) throw new Error('A transaction is required')
const req = await createLocalReq({ req: { transactionID: tx || undefined } }, p)
try {
  for (const m of manifest.images) for (const variant of ['desktop', 'mobile'] as const) {
    const key = `AFARA expansion v1:${m.id}:${variant};`
    if (media.some(image => image.source.startsWith(key))) continue
    report.push(`Новая иллюстрация: ${m.id}/${variant}`)
    if (apply) media.push(await p.create({ collection: 'media', req, filePath: path.join('fixtures/content-expansion', m[variant].file), data: {
      alt: `Концепция: ${m.id === 'edge' ? 'отделка края портьеры' : m.id === 'palette' ? 'палитра тканей и эскиз' : 'текстиль и архитектурный проект'}`, origin: 'ai', caption: collectionDisclosure,
      source: `${key} sha256=${m[variant].sha256}\nОригинальная генерация image_gen.imagegen для AFARA, 16.10.2026. ${m.resultId}\n${m.prompt}\nМобильный кадр — производный оригинала. Не выполненный проект и не документальная фотография производства.`, rightsConfirmed: true, _status: 'published',
    } }))
  }
  const image = expansionImages(media)
  const ids = new Map(pages.map(page => [page.path, page.id]))
  const created = new Set<string>()
  for (const data of servicePages(image, ids)) {
    if (ids.has(data.path)) { report.push(`Сохранена существующая страница: ${data.path}`); continue }
    report.push(`Новая содержательная страница: ${data.path}`)
    created.add(data.path)
    if (apply) {
      const doc = await p.create({ collection: 'pages', draft: true, req, data: { ...data, sections: [], _status: 'draft' } })
      ids.set(doc.path, doc.id)
    }
  }
  for (const data of servicePages(image, ids)) if (created.has(data.path) && apply) await p.update({ collection: 'pages', id: ids.get(data.path)!, req, data })
  for (const [pagePath, patch] of pageUpdates(pages, image, ids)) {
    const current = pages.find(page => page.path === pagePath)!
    const expected = baseline.pages.find(page => page.id === current.id)
    const draft = latest.find(page => page.id === current.id)
    if (!expected || !equal(current, expected) || draft?._status === 'draft') {
      skipped.push(pagePath); report.push(`Сохранена изменённая владельцем запись/черновик: ${pagePath}`); continue
    }
    report.push(`Обновление текста и выбранных изображений: ${pagePath}`)
    changed.push(pagePath)
    if (apply) {
      const fresh = await p.findByID({ collection: 'pages', id: current.id, draft: true, depth: 0, req })
      if (!equal(fresh, draft)) throw new Error(`Page changed during preparation: ${pagePath}`)
      await p.update({ collection: 'pages', id: current.id, req, data: { ...patch, _status: 'published' } })
    }
  }
  if (equal(site, baseline.site) && equal(site, siteDraft)) {
    report.push('Обновление единой географии и описания студии; контакты консультанта синхронизируются')
    if (apply) {
      const fresh = await p.findGlobal({ slug: 'site', draft: true, depth: 0, req })
      if (!equal(fresh, siteDraft)) throw new Error('Site changed during preparation')
      await p.updateGlobal({ slug: 'site', req, data: siteUpdate(site) })
    }
  } else report.push('Сохранены изменённые владельцем настройки сайта/черновик')
  for (const data of newKnowledge) {
    if (existingKnowledge.some(k => k.topic === data.topic)) continue
    report.push(`Новый публичный ответ: ${data.topic}`)
    if (apply) await p.create({ collection: 'knowledge', req, data: { ...data, page: ids.get(data.page)!, approved: true, _status: 'published' } })
  }
  const faq = existingKnowledge.find(k => k.topic === 'faq-1')
  if (faq?._status === 'published' && equal(faq, baseline.knowledge.find(k => k.id === faq.id))) {
    report.push('Уточнение FAQ о полном составе услуг')
    if (apply) await p.update({ collection: 'knowledge', id: faq.id, req, data: { answer: 'В AFARA можно заказать текстильный дизайн, изготовление штор и портьер для частных и общественных интерьеров, пошив по эскизам и размерам заказчика. Работаем со сложными окнами высотой от 3 до 6 м, многослойностью и моторизацией; сотрудничаем со студиями и архитекторами, в том числе в формате white label. ' + semanticCopy.geography, approved: true, _status: 'published' } })
  }
  for (const draft of baseline.knowledge.filter(k => k._status === 'draft')) {
    const after = await p.findByID({ collection: 'knowledge', id: draft.id, draft: true, depth: 0, req })
    if (!equal(after, draft)) throw new Error('Existing knowledge draft changed')
  }
  for (const pagePath of skipped) {
    const before = latest.find(p => p.path === pagePath)!
    const after = await p.findByID({ collection: 'pages', id: before.id, draft: true, depth: 0, req })
    if (!equal(before, after)) throw new Error('Skipped owner record changed')
  }
  report.push('Проверено: существующие черновики и пропущенные правки сохранены; seed не запускался')
  if (tx) await p.db.commitTransaction(tx)
  const result = { applied: apply, changed, skipped, report }
  if (process.env.AFARA_EXPANSION_REPORT) await writeFile(process.env.AFARA_EXPANSION_REPORT, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
  console.log(report.join('\n'))
} catch (error) { if (tx) await p.db.rollbackTransaction(tx); throw error }
finally { await p.destroy() }
process.exit(0)
