import test from 'node:test'
import assert from 'node:assert/strict'
import type { Page } from '../src/payload-types'
import { cleanContent, cleanPublicText, refreshPage } from '../content/refresh'
import { partnerSections, russianGeography } from '../content/partners'
import { isSpacePage } from '../src/lib/navigation'

test('Russian release removes old height and geography without changing unrelated facts', () => {
  assert.equal(cleanPublicText('Второй свет, эркеры и остекление высотой от 4,5–6 м.'), 'Второй свет, эркеры и остекление высотой от 3 до 6 м.')
  assert.equal(cleanPublicText('Остекление высотой 4,5–6 м и выше.'), 'Остекление высотой от 3 до 6 м.')
  assert.equal(cleanPublicText('Работаем по всему миру; российское отделение — в Санкт-Петербурге.'), russianGeography)
  assert.equal(cleanPublicText('02 / Разбор решения · ИИ-концепция'), '02 / Разбор решения')
  assert.equal(cleanPublicText('Размер образца — 45 × 60 см.'), 'Размер образца — 45 × 60 см.')
})

test('CMS proposal fixes images, preserves custom sections, adds partnership once and stays idempotent', () => {
  const images = { apartment: 11, restaurant: 12, yacht: 13, living: 14, sculptural: 15, residence: 16, hotel: 17, bedroom: 18, textile: 19, partners: 20 }
  const home = { id: 1, path: 'home', type: 'home', h1: 'Авторский заголовок', intro: 'Авторское описание', conceptLabel: 'ИИ-концепция', sections: [
    { id: 'spaces-id', kind: 'spaces', anchor: 'spaces', heading: 'Пространства', cards: [{ title: 'Частные интерьеры', image: 99, page: 2 }, { title: 'Общественные пространства', image: 99, page: 3 }] },
    { id: 'composition-id', kind: 'compositions', anchor: 'compositions', heading: 'Композиции', cards: [{ title: 'Слои', image: 99 }, { title: 'Драпировки', image: 99 }, { title: 'Высота', image: 99 }] },
    { id: 'custom-id', kind: 'conditions', anchor: 'owner-section', heading: 'Собственный блок', body: 'Новый текст владельца.' },
  ] } as Page
  const pages = [home, { id: 2, path: 'chastnye-interery' }, { id: 3, path: 'obshchestvennye-prostranstva' }] as Page[]
  const original = structuredClone(home)
  const patch = refreshPage(home, pages, images, 40)
  assert.deepEqual(home, original)
  assert.equal(patch.h1, home.h1)
  assert.deepEqual(patch.sections?.find(s => s.anchor === 'owner-section'), home.sections?.[2])
  assert.deepEqual(patch.sections?.[0].cards?.map(c => c.image), [11, 12])
  assert.deepEqual(patch.sections?.[1].cards?.map(c => c.image), [14, 15, 16])
  assert.equal(patch.sections?.[1].id, 'composition-id')
  assert.equal(patch.sections?.filter(s => s.anchor === 'partners').length, 1)
  assert.deepEqual(refreshPage({ ...home, ...patch }, pages, images, 40), patch)
  assert.ok(partnerSections(images).every(s => !JSON.stringify(s).includes('ИИ-концепция')))
  assert.deepEqual(cleanContent({ id: 'keep-id', body: '02 / Разбор решения · ИИ-концепция' }), { id: 'keep-id', body: '02 / Разбор решения' })
})

test('partnership is a separate destination, not a room category', () => {
  assert.equal(isSpacePage({ path: 'partnyoram', type: 'direction', parent: null }), false)
  assert.equal(isSpacePage({ path: 'chastnye-yahty', type: 'direction', parent: null }), true)
})
