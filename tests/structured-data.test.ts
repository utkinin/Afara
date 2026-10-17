import test from 'node:test'
import assert from 'node:assert/strict'
import type { Knowledge, Page, Site } from '../src/payload-types'
import { serializeStructuredData, structuredData, visibleAnswers } from '../src/lib/structured-data'

test('schema mirrors visible approved content, omits invented product offers and safely serializes script text', () => {
  const page = { id: 1, path: 'home', type: 'home', h1: 'Текстиль', title: 'Главная', _status: 'published', sections: [{ kind: 'faq', cards: [{ title: 'Общий вопрос?', body: 'Публичный ответ.' }] }, { kind: 'faq', visible: false, cards: [{ title: 'Скрытый?', body: 'Не показывать.' }] }] } as Page
  const site = { brand: 'AFARA', _status: 'published', trust: [{ kind: 'faq', cards: [{ title: 'Устаревший?', body: 'Скрыт при наличии базы.' }] }] } as Site
  const knowledge = [{ id: 1, page: 1, approved: true, _status: 'published', question: 'Проверенный вопрос?', answer: '</script><script>alert(1)</script>', evidence: 'Private review note' }, { id: 2, page: 1, approved: false, _status: 'published', question: 'Не проверен?', answer: 'Нет' }, { id: 3, page: 1, approved: true, _status: 'draft', question: 'Черновик?', answer: 'Нет' }] as Knowledge[]
  assert.equal(visibleAnswers(page, site, knowledge).length, 2)
  const encoded = serializeStructuredData(structuredData(page, [page], site, knowledge, 'https://afara.test')!)
  assert.doesNotMatch(encoded, /<\/script|Private review|Скрытый\?|Устаревший\?|Не проверен\?|Черновик\?|"Product"|"Offer"|aggregateRating/)
  const parsed = JSON.parse(encoded)
  assert.equal(parsed['@graph'].find((x: { '@type': string }) => x['@type'] === 'FAQPage').mainEntity.length, 2)
  assert.equal(structuredData({ ...page, _status: 'draft' }, [page], site, knowledge, 'https://afara.test'), null)
  assert.equal(structuredData(page, [page], site, knowledge, 'javascript:bad'), null)
  const direction = { ...page, id: 10, type: 'direction' as const, path: 'chastnye-interery/spalni', serviceConfirmed: true, parent: 20 }
  const parent = { id: 20, path: 'chastnye-interery', title: 'Частные интерьеры', _status: 'published' } as Page
  const detail = structuredData(direction, [direction, parent], site, [], 'https://example.test/Afara')! as { '@graph': { '@type': string; url?: string; itemListElement?: { item: string }[] }[] }
  assert.equal(detail['@graph'].find(x => x['@type'] === 'Service')?.url, 'https://example.test/Afara/chastnye-interery/spalni/')
  assert.equal(detail['@graph'].find(x => x['@type'] === 'BreadcrumbList')?.itemListElement?.length, 3)
})
