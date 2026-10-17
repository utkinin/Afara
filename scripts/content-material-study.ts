import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalReq } from 'payload'
import { cms } from '../src/lib/payload'
import { materialStudyAnchor, materialStudyAnswers, materialStudySection, materialStudyViews } from '../content/material-study'
import type { Page } from '../src/payload-types'

const root = fileURLToPath(new URL('../', import.meta.url))
const apply = process.argv.includes('--apply')
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')
type Variant = { file: string; width: number; sha256: string }
type Image = { id: string; resultId: string; prompt?: string; variants: Variant[] }
if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Use the existing development CMS with AFARA_DB_PUSH=false; no schema changes are required')
if (!process.env.DATABASE_URL) throw new Error('The existing CMS DATABASE_URL is required. No content was changed.')
const manifest = JSON.parse(await readFile(path.join(root, 'fixtures/material-study/manifest.json'), 'utf8')) as { version: number; images: Image[] }
if (manifest.version !== 1 || manifest.images.length !== 3 || new Set(manifest.images.map(i => i.id)).size !== 3 || !materialStudyViews.every(v => manifest.images.some(i => i.id === v.id))) throw new Error('Incomplete material study')
for (const image of manifest.images) for (const variant of image.variants) {
  if (!/^(neutral|warm|detail)-(480|960|1536)\.webp$/.test(variant.file)) throw new Error('Invalid asset path')
  const bytes = await readFile(path.join(root, 'fixtures/material-study', variant.file))
  if (createHash('sha256').update(bytes).digest('hex') !== variant.sha256) throw new Error(`Checksum mismatch: ${variant.file}`)
}
const p = await cms(), report: string[] = []
let tx: string | number | null = null
try {
  const paths = ['home', 'poshiv-po-eskizam']
  const pages = (await p.find({ collection: 'pages', draft: false, depth: 0, pagination: false, where: { path: { in: paths } } })).docs
  const latest = (await p.find({ collection: 'pages', draft: true, depth: 0, pagination: false, where: { path: { in: paths } } })).docs
  const eligible: Page[] = []
  for (const page of pages) {
    if (page._status !== 'published' || latest.find(x => x.id === page.id)?._status === 'draft') { report.push(`Сохранён черновик владельца: ${page.path}`); continue }
    if (page.sections?.some(s => s.anchor === materialStudyAnchor)) { report.push(`Сохранён существующий интерактивный блок: ${page.path}`); continue }
    report.push(`Новый блок просмотра материалов: ${page.path}`); eligible.push(page)
  }
  const knowledge = (await p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, limit: 10000 })).docs
  const media = (await p.find({ collection: 'media', draft: true, depth: 0, pagination: false, limit: 10000 })).docs
  if (apply && eligible.length) {
    const backupRoot = process.env.AFARA_CONTENT_BACKUP_DIR
    const resolvedBackup = backupRoot && path.resolve(backupRoot), resolvedRoot = path.resolve(root)
    if (!backupRoot || !path.isAbsolute(backupRoot) || resolvedBackup === resolvedRoot || resolvedBackup!.startsWith(resolvedRoot + path.sep)) throw new Error('Set AFARA_CONTENT_BACKUP_DIR to a private absolute directory outside the checkout')
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    if ((await stat(backupRoot)).mode & 0o077) throw new Error('Content backup directory must have private permissions (0700)')
    await writeFile(path.join(backupRoot, `material-study-${Date.now()}.json`), JSON.stringify({ pages, latest, knowledge, media }), { mode: 0o600, flag: 'wx' })
    tx = await p.db.beginTransaction()
    if (!tx) throw new Error('A database transaction is required')
    const req = await createLocalReq({ req: { transactionID: tx } }, p)
    const ids: Record<string, number> = {}
    for (const image of manifest.images) {
      const master = [...image.variants].sort((a, b) => b.width - a.width)[0]
      const token = `AFARA material-study v1:${image.id};`
      const matches = media.filter(m => m.source.startsWith(token))
      if (matches.length > 1) throw new Error(`Duplicate image identity: ${token}`)
      if (matches.length) {
        if (matches[0]._status !== 'published' || !matches[0].rightsConfirmed) throw new Error(`Existing image draft preserved: ${image.id}`)
        ids[image.id] = matches[0].id
      } else {
        const view = materialStudyViews.find(v => v.id === image.id)!
        const created = await p.create({ collection: 'media', req, filePath: path.join(root, 'fixtures/material-study', master.file), data: {
          alt: view.alt, caption: 'Иллюстративный просмотр материалов. Не образец конкретного артикула и не измерение освещения.', origin: 'ai', rightsConfirmed: true,
          source: `${token} sha256=${master.sha256}\nOriginal AFARA image_gen.imagegen, 2026-10-17; ${image.resultId}\n${image.prompt || ''}\nКонцепция, не выполненный заказ. Цвет, коэффициент и масштаб изображения не являются измеренными свойствами ткани.`, _status: 'published',
        } })
        ids[image.id] = created.id
      }
    }
    for (const page of eligible) {
      const fresh = await p.findByID({ collection: 'pages', id: page.id, draft: true, depth: 0, req })
      if (digest(fresh) !== digest(latest.find(x => x.id === page.id))) throw new Error(`Concurrent edit preserved: ${page.path}`)
      const sections = [...(page.sections || [])]
      const index = sections.findIndex(s => s.anchor === 'materials')
      sections.splice(index < 0 ? sections.length : index + 1, 0, materialStudySection(ids))
      await p.update({ collection: 'pages', id: page.id, req, data: { sections, _status: 'published' } })
    }
    const home = pages.find(page => page.path === 'home' && page._status === 'published')
    if (home) for (const answer of materialStudyAnswers) if (!knowledge.some(k => k.topic === answer.topic)) await p.create({ collection: 'knowledge', req, data: { ...answer, page: home.id, approved: true, _status: 'published' } })
    await p.create({ collection: 'audit', req, data: { actor: 'material-study-cli', action: 'publish-material-study', object: eligible.map(x => x.path).join(','), version: digest(pages) } })
    await p.db.commitTransaction(tx); tx = null
    report.push('Опубликован блок в существующей CMS; исходные секции, тексты и черновики сохранены.')
  }
  console.log(JSON.stringify({ applied: apply && eligible.length > 0, pages: eligible.map(x => x.path), report, note: apply ? 'Превью экспортируется отдельно по PREVIEW.md.' : 'План без записи. Для применения используйте --apply.' }, null, 2))
} catch (error) { if (tx) await p.db.rollbackTransaction(tx); throw error }
finally { await p.destroy() }
process.exit(0)
