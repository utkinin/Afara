import { readFile, mkdir, writeFile, stat, realpath } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { careCopy, carePage, careLinkSection, careRelatedPaths, careAnswers, educationPath } from '../src/lib/care-service'
import { sameContent } from '../src/lib/content-identity'
import type { Page } from '../src/payload-types'

if (process.argv.includes('--list')) console.log(JSON.stringify(careCopy, null, 2))
else {
  if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false' || !process.env.DATABASE_URL) throw new Error('Use the existing development CMS and AFARA_DB_PUSH=false')
  const apply = process.argv.includes('--apply'), publish = process.argv.includes('--publish-reviewed')
  if (publish && !apply) throw new Error('--publish-reviewed requires --apply and owner confirmation of the service')
  const root = path.resolve('.'), fixtures = path.join(root, 'fixtures/care-education')
  const manifest = JSON.parse(await readFile(path.join(fixtures, 'manifest.json'), 'utf8')) as { images: { id: string; title: string; alt: string; generation: object; desktop: { file: string; sha256: string }; mobile: { file: string; sha256: string } }[] }
  for (const image of manifest.images) for (const variant of [image.desktop, image.mobile]) {
    if (!/^[a-z-]+\.webp$/.test(variant.file)) throw new Error('Invalid fixture path')
    if (createHash('sha256').update(await readFile(path.join(fixtures, variant.file))).digest('hex') !== variant.sha256) throw new Error('Image hash mismatch')
  }
  const { cms } = await import('../src/lib/payload'), { createLocalReq } = await import('payload')
  const p = await cms(), report: string[] = []
  let tx: string | number | null = null
  try {
    const pages = (await p.find({ collection: 'pages', draft: false, depth: 0, pagination: false, limit: 1000 })).docs
    const drafts = (await p.find({ collection: 'pages', draft: true, depth: 0, pagination: false, limit: 1000 })).docs
    const media = (await p.find({ collection: 'media', depth: 0, pagination: false, limit: 1000 })).docs
    const knowledge = (await p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, limit: 1000 })).docs
    if (!apply) console.log(JSON.stringify({ applied: false, newPage: !drafts.some(p => p.path === careCopy.path), educationPageFound: pages.some(p => p.path === educationPath), ownerDraftsPreserved: drafts.filter(p => p._status === 'draft').map(p => p.path), publication: publish, note: 'Новые записи и медиа — черновики. Для публикации проверенного состава услуги: --apply --publish-reviewed.' }))
    else {
      const backup = process.env.AFARA_CONTENT_BACKUP_DIR
      if (!backup || !path.isAbsolute(backup)) throw new Error('Private absolute backup directory required')
      await mkdir(backup, { recursive: true, mode: 0o700 })
      const resolved = await realpath(backup)
      if (resolved === root || resolved.startsWith(root + path.sep) || (await stat(resolved)).mode & 0o077) throw new Error('Backup must be 0700 and outside checkout')
      await writeFile(path.join(resolved, `care-education-${Date.now()}.json`), JSON.stringify({ pages, drafts, media, knowledge }), { mode: 0o600, flag: 'wx' })
      tx = await p.db.beginTransaction({ isolationLevel: 'serializable' }); if (!tx) throw new Error('Transaction required')
      const req = await createLocalReq({ req: { transactionID: tx } }, p)
      const ids = new Map<string, number>()
      for (const image of manifest.images) for (const variant of ['desktop', 'mobile'] as const) {
        const token = `AFARA care-education v1:${image.id}:${variant};`
        const old = media.find(m => m.source.startsWith(token))
        if (old) {
          if (publish && old._status !== 'published') {
            const expectedSource = `${token} sha256=${image[variant].sha256}\n${JSON.stringify(image.generation)}`
            if (old.alt !== image.alt || old.source !== expectedSource || !old.rightsConfirmed) throw new Error('An edited image draft requires review in CMS')
            await p.update({ collection: 'media', id: old.id, req, data: { _status: 'published', rightsConfirmed: true } })
          }
          ids.set(`${image.id}:${variant}`, old.id); continue
        }
        const record = await p.create({ collection: 'media', req, filePath: path.join(fixtures, image[variant].file), data: { alt: image.alt, caption: 'Иллюстрация текстильного решения. Не выполненный объект AFARA.', origin: 'ai', rightsConfirmed: true, source: `${token} sha256=${image[variant].sha256}\n${JSON.stringify(image.generation)}`, _status: publish ? 'published' : 'draft' } })
        ids.set(`${image.id}:${variant}`, record.id)
      }
      let service = drafts.find(page => page.path === careCopy.path)
      if (!service) {
        const find = (variant: 'desktop' | 'mobile') => media.find(m => m.source.startsWith(`AFARA expansion v1:edge:${variant};`))?.id || null
        service = await p.create({ collection: 'pages', req, draft: !publish, data: carePage(find('desktop'), find('mobile'), publish) })
        for (const answer of careAnswers) if (!knowledge.some(k => k.topic === answer.topic)) await p.create({ collection: 'knowledge', req, draft: !publish, data: { ...answer, page: service.id, approved: publish, _status: publish ? 'published' : 'draft' } })
        report.push(`Создана страница ${service.path}: ${service._status}`)
      } else report.push('Существующая страница ухода и её черновик сохранены')
      if (publish) {
        const oldSchool = new Set(media.filter(m => m.source.startsWith('AFARA editorial v1:school:')).map(m => m.id))
        const schoolId = ids.get('school-classroom:desktop')!, schoolMobile = ids.get('school-classroom:mobile')!, kindergartenId = ids.get('kindergarten-group:desktop')!
        const replace = (id: unknown): number | unknown => typeof id === 'number' && oldSchool.has(id) ? schoolId : id
        for (const page of pages) {
          const latest = drafts.find(d => d.id === page.id)
          if (!latest || latest._status === 'draft') { report.push(`Сохранён черновик: ${page.path}`); continue }
          const sections = structuredClone(page.sections || [])
          for (const section of sections) {
            section.image = replace(section.image) as typeof section.image
            for (const card of section.cards || []) if (oldSchool.has(typeof card.image === 'number' ? card.image : -1)) { card.image = schoolId; card.imageAlt = manifest.images[0].alt }
          }
          const patch: Partial<Page> = { sections }
          if (typeof page.hero === 'number' && oldSchool.has(page.hero)) { patch.hero = schoolId; patch.heroMobile = schoolMobile; patch.heroAlt = manifest.images[0].alt; patch.heroPosition = 50 }
          if (page.path === educationPath && (patch.hero || page.hero === schoolId)) {
            const gallery = sections.find(s => s.anchor === 'visual-collection')
            if (gallery && !gallery.cards?.some(card => card.image === kindergartenId)) { gallery.heading = 'Школьный класс и группа детского сада'; gallery.cards = [
              { title: 'Школьный класс', body: 'Дневной свет для занятий, управление шторами и доступ к окну. Комплект и документы проверяются по конкретному заданию.', image: schoolId, imageAlt: manifest.images[0].alt },
              { title: 'Группа детского сада', body: 'Текстиль для занятий и игр с учётом расположения детской мебели, освещения, управления и ухода.', image: kindergartenId, imageAlt: manifest.images[1].alt },
            ] }
          }
          if (service._status === 'published' && careRelatedPaths.includes(page.path) && !sections.some(s => s.anchor === 'curtain-care')) {
            const index = sections.findIndex(s => s.anchor === 'approach')
            sections.splice(index < 0 ? sections.length : index + 1, 0, careLinkSection(page.path === 'home', service.id))
          }
          if (sameContent(sections, page.sections || []) && !patch.hero) continue
          const fresh = await p.findByID({ collection: 'pages', id: page.id, draft: true, depth: 0, req })
          if (!sameContent(fresh, latest)) throw new Error(`Concurrent edit preserved: ${page.path}`)
          await p.update({ collection: 'pages', id: page.id, req, draft: false, data: { ...patch, _status: 'published' } })
          report.push(`Обновлены только выбранные блоки: ${page.path}`)
        }
      }
      await p.create({ collection: 'audit', req, data: { actor: 'care-education-cli', action: publish ? 'publish-reviewed-care-education' : 'prepare-care-education-drafts', object: careCopy.path, version: careCopy.version } })
      await p.db.commitTransaction(tx); tx = null
      console.log(JSON.stringify({ applied: true, publication: publish, report }))
    }
  } catch (error) { if (tx) await p.db.rollbackTransaction(tx); throw error }
  finally { await p.destroy() }
}
process.stdout.write('', () => process.exit(0))
