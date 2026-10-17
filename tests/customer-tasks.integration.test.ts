import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createLocalReq } from 'payload'
import { cms } from '../src/lib/payload'
import { addCustomerTasks } from '../src/lib/customer-tasks-import'
import { customerTasksAnchor, customerTasks } from '../content/customer-tasks'

test('real CMS and browser: task section preserves content, transfers a brief in one click, is responsive and preserves owner drafts', { timeout: 90000 }, async () => {
  assert.equal(process.env.AFARA_STAGE, 'development')
  assert.equal(new URL(process.env.DATABASE_URL || '').pathname, '/afara_ci_acceptance')
  const p = await cms(), origin = process.env.APP_URL || 'http://localhost:3000'
  const home = (await p.find({ collection: 'pages', where: { path: { equals: 'home' } }, draft: false, depth: 0 })).docs[0]
  const site = await p.findGlobal({ slug: 'site', draft: false, depth: 0 })
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] })
  let tx: string | number | null = null
  try {
    tx = await p.db.beginTransaction({ isolationLevel: 'serializable' }); assert.ok(tx)
    const req = await createLocalReq({ req: { transactionID: tx } }, p)
    assert.equal((await addCustomerTasks(p, req)).applied, true)
    await p.db.commitTransaction(tx); tx = null
    const changed = await p.findByID({ collection: 'pages', id: home.id, depth: 0, draft: false })
    assert.deepEqual(changed.sections?.filter(section => section.anchor !== customerTasksAnchor), home.sections)
    for (const key of ['h1', 'title', 'intro', 'hero', 'seo'] as const) assert.deepEqual(changed[key], home[key])
    tx = await p.db.beginTransaction({ isolationLevel: 'serializable' }); assert.ok(tx)
    assert.equal((await addCustomerTasks(p, await createLocalReq({ req: { transactionID: tx } }, p))).action, 'preserve-existing-section')
    await p.db.commitTransaction(tx); tx = null
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors: string[] = []
    let submitted = 0
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.url().endsWith('/api/inquiry') && request.method() === 'POST') submitted++ })
    await page.goto(origin, { waitUntil: 'networkidle' })
    const section = page.locator('[data-customer-tasks]'), links = section.locator('a[data-inquiry-brief]'), description = page.locator('#consultation form').getByLabel(site.form!.description)
    assert.equal(await links.count(), 4); assert.equal(await section.locator('img,video').count(), 0)
    await links.first().focus(); await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA' && Boolean(document.activeElement.closest('#consultation')))
    assert.ok((await description.inputValue()).includes(customerTasks[0].title)); assert.equal(await description.evaluate(el => el === document.activeElement), true)
    await description.fill('Мой уже написанный текст, который нельзя заменять.')
    await links.nth(2).click(); assert.equal(await description.inputValue(), 'Мой уже написанный текст, который нельзя заменять.')
    assert.equal(submitted, 0, 'Choosing a task does not send a lead or capture contacts')
    await mkdir('docs/screenshots', { recursive: true })
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.ok((await links.first().boundingBox())!.height >= 44)
      if (width === 390 || width === 1440) await section.screenshot({ path: `docs/screenshots/customer-tasks-${width}.png` })
    }
    assert.deepEqual(errors, [])
    await p.update({ collection: 'pages', id: home.id, draft: true, data: { intro: 'SYNTHETIC owner draft must survive', _status: 'draft' } })
    tx = await p.db.beginTransaction({ isolationLevel: 'serializable' }); assert.ok(tx)
    assert.equal((await addCustomerTasks(p, await createLocalReq({ req: { transactionID: tx } }, p))).action, 'preserve-owner-draft')
    await p.db.commitTransaction(tx); tx = null
    assert.equal((await p.findByID({ collection: 'pages', id: home.id, depth: 0, draft: true })).intro, 'SYNTHETIC owner draft must survive')
  } finally {
    await browser.close()
    if (tx) await p.db.rollbackTransaction(tx)
    await p.update({ collection: 'pages', id: home.id, draft: false, data: { sections: home.sections, intro: home.intro, _status: home._status } })
    await p.destroy()
  }
})
