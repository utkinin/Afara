import copy from '../../content/care-service.json'
import type { Page } from '../payload-types'
import type { PageInput } from './copy-expansion'

export const careCopy = copy
export const educationPath = 'obshchestvennye-prostranstva/shkoly-i-detskie-sady'
export const careRelatedPaths = ['home', 'partneram', 'obshchestvennye-prostranstva/oteli', 'obshchestvennye-prostranstva/restorany', 'obshchestvennye-prostranstva/ofisy']
export function carePage(hero: number | null, heroMobile: number | null, publish = false): PageInput {
  return { path: copy.path, title: copy.title, h1: copy.h1, intro: copy.intro, cta: copy.cta, detailsLabel: copy.detailsLabel, seo: copy.seo, type: 'service', navOrder: 70, serviceConfirmed: publish, hero, heroMobile, heroAlt: 'Фактура и отделка портьеры', heroPosition: 50, conceptLabel: '', sections: copy.sections.filter(s => s.kind !== 'faq') as Page['sections'], _status: publish ? 'published' : 'draft' }
}
export function careLinkSection(home: boolean, pageId: number): NonNullable<Page['sections']>[number] {
  const section = structuredClone(home ? copy.home : copy.crossLink)
  return { ...section, kind: 'compositions', cards: section.cards.map(c => ({ ...c, page: pageId })) }
}
export const careAnswers = copy.sections.find(s => s.kind === 'faq')!.cards.map((card, i) => ({ topic: `curtain-care-${i + 1}`, question: card.title, answer: card.body, keywords: 'уход снятие чистка стирка химчистка обратная навеска шторы портьеры Санкт-Петербург', evidence: 'Редакционная проверка 18.10.2026. https://delius.de/fileadmin/Forms/Broschueren/Cleaning_Decorationfabrics.pdf — индивидуальный уход по артикулу, не универсальный режим. Услуга/география/даты/исполнитель подтверждаются по объекту. Частотности и результаты пилота не измерены.' }))
