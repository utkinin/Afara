import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.PREVIEW_TEST_ORIGIN || 'http://localhost:3100', base = '/Afara'
test('care page, one-click brief, educational pictures and mobile layout', async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    let posts = 0; page.on('request', request => { if (request.method() === 'POST') posts++ })
    const response = await page.goto(`${origin}${base}/ukhod-za-shtorami/`, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    assert.equal(await page.locator('h1').textContent(), 'Снятие, чистка и обратная навеска штор')
    const faq = page.locator('#care-questions, section[aria-label="Публичные материалы AFARA"]')
    assert.equal(await faq.locator('details').count(), 8)
    assert.equal(await page.locator('main img').first().evaluate(img => img.complete && img.naturalWidth > 0), true)
    await page.locator('a[data-inquiry-brief]').first().click()
    const description = page.getByLabel('Что вы хотите решить?')
    assert.match(await description.inputValue(), /уход за шторами/)
    await description.fill('Мой текст для обслуживания')
    await page.locator('a[data-inquiry-brief]').first().click()
    assert.equal(await description.inputValue(), 'Мой текст для обслуживания')
    await fs.mkdir('docs/screenshots', { recursive: true })
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      if (width === 390 || width === 1440) { await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }) }); await page.waitForFunction(() => { const img = document.querySelector('main img'); return img?.complete && img.naturalWidth > 0 }); await page.screenshot({ path: `docs/screenshots/care-service-${width}.png` }) }
    }
    await page.goto(`${origin}${base}/obshchestvennye-prostranstva/shkoly-i-detskie-sady/`, { waitUntil: 'networkidle' })
    assert.match(await page.locator('main img').first().getAttribute('alt'), /Школьный класс/)
    assert.equal(await page.locator('#visual-collection img[alt*="Группа детского сада"]').count(), 1)
    assert.equal(await page.locator('#visual-collection [data-save-idea]').count(), 2)
    assert.equal(await page.locator('#visual-collection article[id]').count(), 2)
    assert.equal(await page.locator('#idea-editorial-obshchestvennye-prostranstva-shkoly-i-detskie-sady-school').count(), 1)
    await page.locator('#visual-collection').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => [...document.querySelectorAll('#visual-collection img')].every(img => img.complete && img.naturalWidth > 0))
    for (const img of await page.locator('#visual-collection img').all()) assert.equal(await img.evaluate(el => el.complete && el.naturalWidth > 0), true)
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }) })
      await page.waitForFunction(() => { const img = document.querySelector('main img'); return img?.complete && img.naturalWidth > 0 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: `docs/screenshots/education-${width}.png`, fullPage: true })
    }
    await page.goto(`${origin}${base}/`, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('#curtain-care a').getAttribute('href'), `${base}/ukhod-za-shtorami/`)
    assert.equal(await page.locator('nav[aria-label="Мобильная навигация"] a[href$="/ukhod-za-shtorami/"]').count(), 1)
    assert.equal(posts, 0); assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
