import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { cms } from '../src/lib/payload'

test('services: distinct imagery, geography, professional navigation, brief and cited public answers', async () => {
  assert.equal(process.env.AFARA_STAGE, 'development')
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /_acceptance$/)
  const p = await cms(), origin = process.env.APP_URL || 'http://localhost:3006'
  try {
    const pages = (await p.find({ collection: 'pages', depth: 0, limit: 1000 })).docs
    const home = pages.find(p => p.path === 'home')!
    const core = home.sections!.filter(s => ['spaces', 'compositions', 'details'].includes(s.anchor || ''))
    const pictures = core.flatMap(s => s.cards!.map(c => c.image))
    assert.equal(pictures.length, 8); assert.equal(new Set(pictures).size, 8)
    assert.ok(home.sections!.find(s => s.anchor === 'compositions')!.cards!.some(c => c.body?.includes('от 3 до 6 м')))
    assert.equal(JSON.stringify(home).includes('ИИ-концеп'), false)
    const site = await p.findGlobal({ slug: 'site', depth: 0 })
    assert.match(site.geography!, /всей России/); assert.match(site.geography!, /ОАЭ/); assert.equal(site.geography!.includes('миру'), false)
    for (const path of ['partneram', 'poshiv-po-eskizam']) assert.equal(pages.find(p => p.path === path)?.type, 'service')
    await assert.rejects(() => p.create({ collection: 'pages', data: { path: 'qa-unconfirmed-service', title: 'Synthetic', h1: 'Synthetic', intro: 'Synthetic service validation', type: 'service', serviceConfirmed: false, cta: 'Обсудить', _status: 'published' } }))
    for (const [question, path] of [
      ['Можно ли заказать пошив по эскизам и размерам заказчика?', '/poshiv-po-eskizam/'],
      ['White label под брендом нашей студии: как сотрудничать?', '/partneram/'],
      ['Отправляете ли вы шторы и текстиль в ОАЭ?', '/kontakty/'],
    ]) {
      const r = await fetch(origin + '/api/consultant', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ question }) })
      const result = await r.json(); assert.equal(r.status, 200); assert.ok(result.sources.some((s: { url: string }) => s.url.startsWith(path + '#answer-')))
    }
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] })
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' }), errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      for (const width of [360, 390, 768, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const path of ['/', '/partneram/', '/poshiv-po-eskizam/']) {
          const response = await page.goto(origin + path, { waitUntil: 'networkidle' })
          assert.equal(response?.status(), 200)
          assert.equal(await page.locator('h1').count(), 1)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} at ${width}`)
          assert.equal(await page.locator('main img').first().evaluate(e => e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0), true)
        }
      }
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin, { waitUntil: 'networkidle' })
      assert.equal(await page.getByRole('combobox', { name: 'Тип пространства' }).count(), 1)
      assert.equal(await page.getByRole('textbox').count(), 2)
      await page.getByRole('button', { name: 'Открыть меню' }).click()
      const dialog = page.getByRole('dialog')
      assert.equal(await dialog.getByRole('link', { name: 'Партнёрам', exact: true }).count(), 1)
      assert.equal(await dialog.getByRole('link', { name: 'Пошив по эскизам', exact: true }).count(), 1)
      await dialog.getByRole('link', { name: 'Партнёрам', exact: true }).click(); await page.waitForURL(origin + '/partneram/')
      await page.screenshot({ path: 'docs/screenshots/partners-390.png' })
      await page.goto(origin + '/poshiv-po-eskizam/', { waitUntil: 'networkidle' }); await page.screenshot({ path: 'docs/screenshots/by-sketch-390.png' })
      await page.goto(origin, { waitUntil: 'networkidle' }); await page.locator('#compositions').evaluate(e => e.scrollIntoView({ block: 'start' })); await page.screenshot({ path: 'docs/screenshots/distinct-compositions-390.png' })
      const renderedPictures: string[] = []
      for (const anchor of ['spaces', 'compositions', 'details']) {
        const pictures = page.locator(`#${anchor} article img`)
        for (const picture of await pictures.all()) {
          await picture.scrollIntoViewIfNeeded()
          await picture.evaluate(e => (e as HTMLImageElement).decode())
          renderedPictures.push(await picture.getAttribute('src') || '')
        }
      }
      assert.equal(new Set(renderedPictures).size, renderedPictures.length)
      await page.locator('#compositions').evaluate(e => e.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: 'docs/screenshots/distinct-compositions-390.png' })
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin, { waitUntil: 'networkidle' }); await page.screenshot({ path: 'docs/screenshots/expanded-home-1440.png' })
      const servicesLink = page.getByRole('navigation', { name: 'Основная навигация', exact: true }).getByRole('link', { name: /^Услуги/ }).first()
      await servicesLink.focus()
      const manufacturingLink = page.getByRole('navigation', { name: 'Основная навигация', exact: true }).getByRole('link', { name: 'Пошив по эскизам', exact: true })
      assert.equal(await manufacturingLink.isVisible(), true)
      const box = await manufacturingLink.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= 1440)
      assert.deepEqual(errors, [])
    } finally { await browser.close() }
  } finally { await p.destroy() }
})
