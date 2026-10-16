import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { cms } from '../src/lib/payload'
import { collectionDisclosure } from '../src/lib/editorial'
import { importVisuals, digest } from '../scripts/content-visuals'
import { searchKnowledge } from '../src/lib/consultant'

test('editorial import preserves owner drafts and public content; publication and idea links work', async () => {
  assert.equal(process.env.AFARA_STAGE, 'development')
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /_acceptance$/)
  const p = await cms(), origin = process.env.APP_URL || 'http://localhost:3000'
  const original = (await p.find({ collection: 'pages', where: { path: { equals: 'chastnye-yahty' } }, depth: 0 })).docs[0]
  assert.ok(original, 'Use a fresh restored AFARA acceptance copy for the editorial suite')
  const existing = await p.findByID({ collection: 'pages', id: original.id, draft: true, depth: 0 })
  const ownerText = `Синтетический черновик владельца ${randomUUID()}`
  await p.update({ collection: 'pages', id: original.id, draft: true, data: { intro: ownerText, _status: 'draft' } })
  const ownerDraft = await p.findByID({ collection: 'pages', id: original.id, draft: true, depth: 0 })
  const beforeMedia = await p.count({ collection: 'media' })
  const beforeKnowledge = await p.count({ collection: 'knowledge' })
  const publicHome = (await p.find({ collection: 'pages', where: { path: { equals: 'home' } }, depth: 0 })).docs[0]
  const plan = await importVisuals(p)
  assert.ok(plan.report.some(r => r.includes('Сохранён существующий черновик: chastnye-yahty')))
  assert.equal((await p.count({ collection: 'media' })).totalDocs, beforeMedia.totalDocs)
  const result = await importVisuals(p, true)
  assert.equal(result.baseline, plan.baseline)
  assert.equal((await p.count({ collection: 'media' })).totalDocs, beforeMedia.totalDocs + 32)
  assert.equal((await p.count({ collection: 'knowledge' })).totalDocs, beforeKnowledge.totalDocs + 8)
  assert.equal(digest(await p.findByID({ collection: 'pages', id: original.id, draft: true, depth: 0 })), digest(ownerDraft))
  assert.equal(digest(await p.findByID({ collection: 'pages', id: publicHome.id, draft: false, depth: 0 })), digest(publicHome))
  const repeat = await importVisuals(p, true)
  assert.equal(repeat.report.some(r => r.startsWith('Новый')), false)
  const homeDraft = await p.findByID({ collection: 'pages', id: publicHome.id, draft: true, depth: 0 })
  assert.equal(homeDraft.sections?.find(s => s.anchor === 'visual-collection')?.cards?.length, 16)
  const records = (await p.find({ collection: 'knowledge', where: { topic: { contains: 'editorial-' } }, depth: 0, limit: 100 })).docs
  assert.equal(records.length, 8); assert.ok(records.every(k => k._status === 'draft' && !k.approved))
  assert.equal((await searchKnowledge('акустика ресторан отражения звукоизоляция')).some(s => records.some(k => k.id === s.id)), false)
  const password = randomBytes(24).toString('base64url')
  const admin = await p.create({ collection: 'users', data: { email: `editorial-${randomUUID()}@example.test`, password, role: 'ADMIN' } })
  const user = { ...admin, collection: 'users' as const }
  const residence = (await p.find({ collection: 'pages', where: { path: { equals: 'chastnye-interery/zagorodnye-doma' } }, depth: 0 })).docs[0]
  const residenceDraft = await p.findByID({ collection: 'pages', id: residence.id, draft: true, depth: 0 })
  const proposed = { hero: residenceDraft.hero, heroMobile: residenceDraft.heroMobile, heroAlt: residenceDraft.heroAlt, conceptLabel: residenceDraft.conceptLabel, sections: residenceDraft.sections, _status: 'published' as const }
  await assert.rejects(() => p.update({ collection: 'pages', id: residence.id, user, data: proposed }))
  for (const id of new Set([residenceDraft.hero, residenceDraft.heroMobile])) {
    assert.equal(typeof id, 'number')
    await assert.rejects(() => p.findByID({ collection: 'media', id: id as number, overrideAccess: false }))
    const m = await p.findByID({ collection: 'media', id: id as number })
    assert.equal(m.origin, 'ai'); assert.equal(m.rightsConfirmed, false)
    assert.ok((await fetch(origin + new URL(m.url!, origin).pathname)).status >= 400)
    await p.update({ collection: 'media', id: id as number, user, data: { rightsConfirmed: true, _status: 'published' } })
  }
  await p.update({ collection: 'pages', id: residence.id, user, data: proposed })
  const knowledgeRecord = records.find(k => k.topic === 'editorial-restaurant-acoustics')!
  await assert.rejects(() => p.update({ collection: 'knowledge', id: knowledgeRecord.id, user, data: { approved: false, _status: 'published' } }))
  await p.update({ collection: 'knowledge', id: knowledgeRecord.id, user, data: { approved: true, _status: 'published' } })
  assert.equal((await searchKnowledge('акустика ресторан отражения звукоизоляция')).some(s => s.id === knowledgeRecord.id), true)
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const page = await context.newPage()
    const r = await page.goto(origin + '/chastnye-interery/zagorodnye-doma/', { waitUntil: 'networkidle' })
    assert.equal(r?.status(), 200)
    await page.locator('#visual-collection').scrollIntoViewIfNeeded()
    assert.equal(await page.getByText(collectionDisclosure, { exact: true }).count(), 1)
    await page.getByRole('button', { name: 'Сохранить идею', exact: true }).click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + '/chastnye-interery/zagorodnye-doma/#idea-editorial-residence')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: 'docs/screenshots/editorial-idea-360.png' })
    const login = await context.request.post(origin + '/api/users/login', { data: { email: admin.email, password } })
    assert.equal(login.status(), 200)
    await page.goto(origin + '/preview/?page=' + homeDraft.id, { waitUntil: 'networkidle' })
    for (const width of [360, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.equal(await page.locator('#visual-collection [data-save-idea]').count(), 16)
      assert.equal(await page.locator('#visual-collection img').count(), 16, 'Every draft image must resolve for the authenticated editor')
    }
    await page.screenshot({ path: 'docs/screenshots/editorial-home-preview-1440.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#visual-collection').evaluate(e => e.scrollIntoView({ block: 'start' }))
    await page.waitForFunction(() => [...document.querySelectorAll('#visual-collection img')].slice(0, 2).every(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))
    await page.screenshot({ path: 'docs/screenshots/editorial-collection-preview-390.png' })
    await page.goto(origin + '/', { waitUntil: 'networkidle' })
    let sent = 0
    page.on('request', r => { if (new URL(r.url()).pathname === '/api/inquiry' && r.method() === 'POST') sent++ })
    await page.getByRole('button', { name: 'Задать вопрос', exact: true }).click()
    await page.getByLabel('Ваш вопрос', { exact: true }).fill('Как обсудить текстиль для моей гостиной?')
    await page.getByRole('link', { name: 'Передать вопрос специалисту' }).click()
    assert.equal(await page.getByLabel('Что вы хотите решить?').inputValue(), 'Как обсудить текстиль для моей гостиной?')
    assert.equal(sent, 0)
    await page.goto(origin + '/kontakty/', { waitUntil: 'networkidle' })
    assert.equal(await page.getByRole('img', { name: 'QR-код страницы контактов AFARA' }).count(), 1)
    assert.equal(await page.getByRole('link', { name: 'Написать о проекте', exact: true }).first().getAttribute('href'), '#consultation')
    await page.screenshot({ path: 'docs/screenshots/editorial-contacts-390.png' })
  } finally { await browser.close(); await p.delete({ collection: 'users', id: admin.id }) }
  await p.update({ collection: 'pages', id: original.id, draft: true, data: { intro: existing.intro, _status: 'draft' } })
})
