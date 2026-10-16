import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cms } from '../src/lib/payload'
import { visualCollection, collectionNote } from '../content/visual-collection'
import type { Page } from '../src/payload-types'

// Explicit opt-in operation. Never run from migrations, app startup or an ordinary seed.
const apply = process.argv.includes('--apply-drafts')
const p = await cms()
try {
  const entries = JSON.parse(await readFile('fixtures/editorial/manifest.json', 'utf8')) as { id: string; file: string; mobile: string; prompt: string }[]
  if (!apply) {
    console.log(`Plan only: ${entries.length * 2} media records; ${visualCollection.length} directions; 2 overviews; home gallery; knowledge drafts. Existing texts and real works are retained. Add --apply-drafts to prepare CMS drafts.`)
    process.exitCode = 0
  } else {
    const images = new Map<string, { image: number; mobile: number }>()
    for (const entry of entries) {
      const ids: number[] = []
      for (const [variant, file] of [['desktop', entry.file], ['mobile', entry.mobile]]) {
        const marker = `AFARA_EDITORIAL_20261016:${entry.id}:${variant}`
        const existing = await p.find({ collection: 'media', where: { source: { contains: marker } }, depth: 0, limit: 1, draft: true })
        const alt = visualCollection.find(d => d.asset === entry.id)?.alt || (entry.id === 'materials' ? 'Фактуры сливового бархата, светлой ткани и прозрачного слоя' : 'Двухцветные портьеры со светлой контрастной отделкой')
        const record = existing.docs[0] || await p.create({ collection: 'media', draft: true, filePath: path.resolve('fixtures/editorial', file), data: {
          alt, caption: 'Концепция текстильной композиции', origin: 'ai', rightsConfirmed: true,
          source: `${marker}\nOriginal concept generated with built-in imagegen on 2026-10-16. Not a completed AFARA project.\n${entry.prompt}`, _status: 'draft',
        } })
        ids.push(record.id)
      }
      images.set(entry.id, { image: ids[0], mobile: ids[1] })
    }
    const all = await p.find({ collection: 'pages', draft: true, depth: 1, limit: 200 })
    const pages = new Map(all.docs.map(page => [page.path, page]))
    for (const [pagePath, title, asset] of [['chastnye-interery', 'Частные интерьеры', 'living'], ['obshchestvennye-prostranstva', 'Общественные пространства', 'restaurant']]) {
      if (!pages.has(pagePath)) pages.set(pagePath, await p.create({ collection: 'pages', draft: true, data: { title, path: pagePath, type: 'overview', h1: title, intro: collectionNote, cta: 'Написать о проекте', sections: [], _status: 'draft' } }))
      const image = images.get(asset)!
      const page = pages.get(pagePath)!
      await p.update({ collection: 'pages', id: page.id, draft: true, data: { hero: image.image, heroMobile: image.mobile, conceptLabel: '', _status: 'draft' } })
    }
    for (const [index, direction] of visualCollection.entries()) {
      const image = images.get(direction.asset)!
      let page = pages.get(direction.path)
      if (!page) page = await p.create({ collection: 'pages', draft: true, data: {
        title: direction.title, path: direction.path, parent: direction.parent ? pages.get(direction.parent)?.id : undefined,
        type: 'direction', h1: direction.h1, intro: direction.intro, cta: 'Написать о проекте', serviceConfirmed: false, navOrder: 20 + index, _status: 'draft',
      } })
      const sections: NonNullable<Page['sections']> = (page.sections || []).map(section => ({ ...section,
        image: section.image ? images.get('materials')!.image : section.image,
        cards: section.cards?.map(card => ({ ...card, image: card.image ? image.image : undefined })),
      }))
      if (!sections.some(section => section.anchor === 'visual-collection')) sections.unshift({
        kind: 'compositions', anchor: 'visual-collection', heading: 'Коллекция решений для вашего пространства', body: collectionNote,
        cards: [{ title: direction.pain, body: direction.answer, image: image.image, imageAlt: direction.alt }, { title: 'Цвет и отделка крупным планом', body: 'Сочетание сливового и светлого оттенков, объём складки и контрастный край помогают обсудить характер композиции. Деталь — стилистический пример, не фрагмент сфотографированного объекта.', image: images.get('curtain-detail')!.image }],
      })
      pages.set(direction.path, await p.update({ collection: 'pages', id: page.id, draft: true, data: { hero: image.image, heroMobile: image.mobile, heroAlt: direction.alt, conceptLabel: '', sections, _status: 'draft' } }))
    }
    // Resolve overview cards from their target page, instead of reusing one demo photo everywhere.
    for (const pagePath of ['chastnye-interery', 'obshchestvennye-prostranstva', 'home']) {
      const page = pages.get(pagePath)
      if (!page) continue
      const sections: NonNullable<Page['sections']> = (page.sections || []).map(section => ({ ...section,
        kicker: section.kind === 'details' ? 'Разбор текстильной композиции' : section.kicker,
        image: section.image ? images.get('materials')!.image : section.image,
        cards: section.cards?.map((card, index) => {
          const targetId = typeof card.page === 'object' ? card.page?.id : card.page
          const target = [...pages.values()].find(page => page.id === targetId)
          const direction = visualCollection.find(d => d.path === target?.path)
          const asset = direction?.asset || (target?.path === 'chastnye-interery' ? 'living' : target?.path === 'obshchestvennye-prostranstva' ? 'restaurant' : section.kind === 'details' ? ['residence', 'living', 'curtain-detail'][index % 3] : ['living', 'curtain-detail', 'residence'][index % 3])
          return { ...card, image: card.image || section.kind === 'spaces' ? images.get(asset)!.image : undefined }
        }),
      }))
      if (pagePath === 'home' && !sections.some(s => s.anchor === 'visual-collection')) sections.splice(1, 0, {
        kind: 'compositions', anchor: 'visual-collection', heading: 'Два цвета. Один замысел.', body: collectionNote,
        cards: [{ title: 'Высокие окна и второй свет', body: 'Выразительный масштаб без случайных деталей.', image: images.get('residence')!.image }, { title: 'Контрастный край и пластика', body: 'Сохраните близкую по настроению идею и отправьте её специалисту.', image: images.get('curtain-detail')!.image }, { title: 'Открытый вид и приватность', body: 'Многослойные шторы для частной яхты.', image: images.get('yacht')!.image, page: pages.get('chastnye-yahty')?.id }],
      })
      const hero = images.get(pagePath === 'home' ? 'residence' : pagePath === 'chastnye-interery' ? 'living' : 'restaurant')!
      await p.update({ collection: 'pages', id: page.id, draft: true, data: { sections, hero: hero.image, heroMobile: hero.mobile, conceptLabel: '', _status: 'draft' } })
    }
    const knowledge = JSON.parse(await readFile('content/editorial-knowledge.json', 'utf8')) as { topic: string; page: string; question: string; answer: string; keywords: string; source?: string }[]
    for (const item of knowledge) {
      if ((await p.find({ collection: 'knowledge', draft: true, where: { topic: { equals: item.topic } }, limit: 1 })).totalDocs) continue
      const page = pages.get(item.page)
      if (!page) continue
      await p.create({ collection: 'knowledge', draft: true, data: { topic: item.topic, question: item.question, answer: `${item.answer}${item.source ? `\nИсточник: ${item.source}` : ''}`, keywords: item.keywords, page: page.id, approved: false, _status: 'draft' } })
    }
    console.log('CMS drafts prepared. Published versions, existing copy, studio identity, contacts and real works were not overwritten. Review media, services and sourced answers before publication.')
  }
} finally { await p.destroy() }
process.exit(0)
