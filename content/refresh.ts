import type { Page } from '../src/payload-types'
import { partnerTeaser, russianGeography } from './partners'

export function cleanPublicText(text: string): string {
  return text
    .replace(/от\s+4[,.]5\s*[–—-]\s*6\s*м(?:\s+и\s+выше)?/g, 'от 3 до 6 м')
    .replace(/4[,.]5\s*[–—-]\s*6\s*м(?:\s+и\s+выше)?/g, 'от 3 до 6 м')
    .replace(/\s*[·•]\s*ИИ[- ](?:концепция|визуализация)/gi, '')
    .replace(/ИИ[- ](?:концепция|визуализация)\s*[:.]?\s*/gi, '')
    .replace(/Работаем по всему миру[.;]?\s*(?:[Рр]оссийское отделение\s*[—-]\s*(?:в\s+)?Санкт-Петербурге?\.?\s*)?/g, russianGeography + ' ')
    .replace(/Работаем по всему миру\.?/g, russianGeography)
    .trim()
}

export function cleanContent<T>(value: T): T {
  if (typeof value === 'string') return cleanPublicText(value) as T
  if (Array.isArray(value)) return value.map(cleanContent) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanContent(v)])) as T
  return value
}

export const blockImages: Record<string, string[]> = {
  compositions: ['living', 'sculptural', 'residence'],
  details: ['hotel', 'bedroom', 'textile'],
}

export function refreshPage(page: Page, pages: Page[], images: Record<string, number>, partnerId?: number): Partial<Page> {
  const patch: Partial<Page> = {
    h1: cleanPublicText(page.h1), intro: page.intro ? cleanPublicText(page.intro) : page.intro,
    conceptLabel: '', heroAlt: page.heroAlt ? cleanPublicText(page.heroAlt) : page.heroAlt,
    seo: cleanContent(page.seo), sections: cleanContent(page.sections || []),
  }
  if (page.type === 'overview' && ['chastnye-interery', 'obshchestvennye-prostranstva'].includes(page.path)) {
    patch.hero = images[page.path === 'chastnye-interery' ? 'apartment' : 'restaurant']
    if (page.path === 'obshchestvennye-prostranstva') {
      patch.h1 = 'Текстильное оформление общественных пространств'
      patch.intro = 'Шторы и текстиль для отелей, ресторанов, офисов, сцен и образовательных пространств. Согласуем архитектурную композицию, управление светом и требования конкретного объекта.'
    }
  }
  patch.sections = patch.sections?.map(section => {
    if (section.kind === 'spaces') {
      return { ...section, cards: section.cards?.map(card => {
        const id = typeof card.page === 'object' ? card.page?.id : card.page
        const target = pages.find(p => p.id === id)
        const visual = target?.path === 'chastnye-interery' ? 'apartment' : target?.path === 'obshchestvennye-prostranstva' ? 'restaurant' : target?.path === 'chastnye-yahty' ? 'yacht' : null
        return visual && images[visual] ? { ...card, image: images[visual], imageAlt: `${card.title}: текстиль и интерьер` } : card
      }) }
    }
    if (page.type !== 'home' || !section.anchor || !blockImages[section.anchor]) return section
    return { ...section, kicker: section.anchor === 'details' ? '02 / Разбор решения' : section.kicker, cards: section.cards?.map((card, i) => {
      const image = images[blockImages[section.anchor!][i]]
      return image ? { ...card, image, imageAlt: `${card.title}: цвет, фактура и композиция` } : card
    }) }
  })
  if (page.type === 'home' && partnerId && images.partners && !patch.sections?.some(s => s.anchor === 'partners')) {
    const index = patch.sections?.findIndex(s => s.anchor === 'approach') ?? -1
    patch.sections!.splice(index < 0 ? patch.sections!.length : index, 0, partnerTeaser(images.partners, partnerId))
  }
  return patch
}

