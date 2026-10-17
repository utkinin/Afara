import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { cms } from '../src/lib/payload'
import { eraseAnalytics } from '../src/lib/analytics-server'
import { ANALYTICS_ID_COOKIE } from '../src/lib/analytics-server'
import { ANALYTICS_LINK_TEXT } from '../src/lib/analytics-shared'
import { readAnalyticsReport } from '../src/lib/analytics-report'

test('consented analytics: real browser, PostgreSQL, optional lead linking, ADMIN access and withdrawal', { timeout: 180000 }, async () => {
  assert.equal(process.env.AFARA_STAGE, 'development')
  assert.equal(new URL(process.env.DATABASE_URL || '').pathname, '/afara_ci_acceptance', 'Use only the synthetic CI database')
  const origin = process.env.APP_URL || 'http://localhost:3000', p = await cms(), tag = randomUUID(), password = randomBytes(24).toString('base64url')
  const initialSite = await p.findGlobal({ slug: 'site', draft: false, depth: 0 })
  const documents: number[] = [], users: number[] = [], leads: number[] = [], visitors: number[] = []
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    for (const kind of ['privacy', 'consent', 'analytics'] as const) documents.push((await p.create({ collection: 'documents', data: { title: `СИНТЕТИЧЕСКИЙ ТЕСТ ${kind}`, slug: `analytics-qa-${kind}-${tag}`, kind, version: tag, body: 'Синтетический документ для автоматической проверки. Не юридический документ AFARA.', _status: 'published' } })).id)
    await p.updateGlobal({ slug: 'site', data: { analytics: { enabled: true }, _status: 'published' } })
    const policy = (await p.find({ collection: 'documents', where: { id: { equals: documents[2] } }, depth: 0 })).docs[0]
    const policyVersion = `${policy.id}:${policy.version}`
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })
    const page = await context.newPage(), errors: string[] = [], tracked: { viewId: string; sessionId: string }[] = []
    let trackingRequests = 0
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/analytics/track')) { trackingRequests++; const body = r.postDataJSON(); if (body?.type === 'pageview') tracked.push(body) } })
    await page.goto(origin + '/?utm_source=qa&utm_campaign=autumn&utm_term=сложные+портьеры&email=never-store@example.test', { waitUntil: 'networkidle' })
    assert.equal(tracked.length, 0, 'No analytics request before explicit agreement')
    assert.equal((await context.cookies()).some(c => c.name === ANALYTICS_ID_COOKIE), false)
    const denied = page.waitForResponse(r => r.url().endsWith('/api/analytics/consent') && r.status() === 200)
    await page.getByRole('button', { name: 'Без аналитики', exact: true }).click(); await denied
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(tracked.length, 0)
    await page.getByRole('button', { name: 'Настройки cookie', exact: true }).click()
    const accepted = page.waitForResponse(r => r.url().endsWith('/api/analytics/track') && r.status() === 200)
    await page.getByRole('button', { name: 'Разрешить аналитику', exact: true }).click(); await accepted
    const cookie = (await context.cookies()).find(c => c.name === ANALYTICS_ID_COOKIE)
    assert.ok(cookie?.httpOnly); assert.equal(await page.evaluate(name => document.cookie.includes(name + '='), ANALYTICS_ID_COOKIE), false)
    await page.waitForTimeout(1100)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(300)
    const second = page.waitForResponse(r => r.url().endsWith('/api/analytics/track') && r.status() === 200 && r.request().postDataJSON()?.type === 'pageview')
    await page.goto(origin + '/chastnye-interery/'); await second
    assert.equal(tracked.length, 2, 'Choice persists during navigation without another grant')
    const visitor = (await p.find({ collection: 'analytics-visitors', depth: 0, limit: 100 })).docs.find(v => v.consentVersion === policyVersion)!
    visitors.push(visitor.id)
    const session = (await p.find({ collection: 'analytics-sessions', where: { sessionKey: { equals: tracked[0].sessionId } }, depth: 0 })).docs[0]
    assert.equal(session.utmSource, 'qa'); assert.equal(session.searchTerm, 'сложные портьеры'); assert.equal(session.queryKind, 'utm_term')
    const rows = (await p.find({ collection: 'analytics-events', where: { visitor: { equals: visitor.id } }, depth: 0 })).docs
    assert.ok(rows.some(row => Number(row.activeMs) > 0)); assert.ok(rows.every(row => !row.path.includes('?') && !row.path.includes('@')))
    assert.ok(rows.some(row => Number(row.scrollPercent) === 100), 'Scroll bucket persists on navigation')
    const forbidden = await context.request.post(origin + '/api/analytics/track', { headers: { Origin: origin }, data: { type: 'ping', viewId: tracked[1].viewId, activeMs: 1000, email: 'do-not-capture@example.test' } })
    assert.equal(forbidden.status(), 400)
    assert.equal((await context.request.post(origin + '/api/analytics/consent', { headers: { Origin: 'https://external.example' }, data: { granted: true, version: policyVersion } })).status(), 403)
    const docs = (await p.find({ collection: 'documents', where: { _status: { equals: 'published' } }, depth: 0 })).docs
    const core = { space: initialSite.form!.spaces![0].label, city: 'Synthetic city', description: 'Synthetic inquiry without attribution consent.', name: 'Synthetic no link', channel: 'email', contact: `analytics-none-${tag}@example.test`, consent: true, consentVersion: docs.find(d => d.kind === 'consent')!.version, source: 'home', website: '' }
    const ordinary = await context.request.post(origin + '/api/inquiry', { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: core })
    assert.equal(ordinary.status(), 201)
    const unlinked = (await p.find({ collection: 'leads', where: { contact: { equals: core.contact } }, depth: 0 })).docs[0]; leads.push(unlinked.id)
    assert.equal(unlinked.analyticsVisitor, null)
    const form = page.locator('#consultation form'), labels = initialSite.form!
    await form.getByLabel(labels.space).selectOption({ index: 1 }); await form.getByLabel(labels.city).fill('Synthetic linked city'); await form.getByLabel(labels.description).fill('Synthetic inquiry with a separate analytics agreement.')
    await form.getByRole('button', { name: labels.next, exact: false }).click()
    const optional = form.getByRole('checkbox', { name: /Разрешаю связать эту заявку/ })
    assert.equal(await optional.isChecked(), false); assert.equal(await optional.getAttribute('required'), null)
    await form.getByLabel(labels.name).fill('Synthetic linked visitor'); await form.getByLabel(labels.channel).selectOption('email')
    const contact = `analytics-linked-${tag}@example.test`; await form.locator('input[type=email]').fill(contact)
    await form.locator('input[type=checkbox][required]').check(); await optional.check()
    const inquiry = page.waitForResponse(r => r.url().endsWith('/api/inquiry') && r.status() === 201)
    await form.getByRole('button', { name: labels.submit, exact: false }).click(); await inquiry
    const linked = (await p.find({ collection: 'leads', where: { contact: { equals: contact } }, depth: 0 })).docs[0]; leads.push(linked.id)
    assert.equal(linked.analyticsVisitor, visitor.id); assert.equal(linked.analyticsConsentVersion, policyVersion); assert.ok(linked.analyticsConsentText?.includes(ANALYTICS_LINK_TEXT))
    const report = await readAnalyticsReport(p, { session: session.sessionKey })
    assert.ok(report.selected && report.steps.length >= 2); assert.equal(report.leads[0].contact, contact)
    const owner = await p.create({ collection: 'users', data: { email: `analytics-admin-${tag}@example.test`, password, role: 'ADMIN' } }); users.push(owner.id)
    const editor = await p.create({ collection: 'users', data: { email: `analytics-editor-${tag}@example.test`, password, role: 'EDITOR' } }); users.push(editor.id)
    assert.ok((await context.request.get(origin + '/api/analytics-visitors')).status() >= 400)
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    assert.equal((await adminContext.request.post(origin + '/api/users/login', { headers: { Origin: origin }, data: { email: owner.email, password } })).status(), 200)
    const adminPage = await adminContext.newPage(); adminPage.on('pageerror', e => errors.push(e.message))
    await adminPage.goto(origin + '/admin/analytics?session=' + session.sessionKey, { waitUntil: 'networkidle' })
    await adminPage.getByRole('heading', { name: 'Аналитика', exact: true }).waitFor()
    assert.ok((await adminPage.locator('.afara-analytics').textContent())?.includes(contact))
    await mkdir('docs/screenshots', { recursive: true })
    await adminPage.screenshot({ path: 'docs/screenshots/analytics-admin-1440.png', fullPage: true })
    await adminPage.setViewportSize({ width: 390, height: 844 }); assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await adminPage.screenshot({ path: 'docs/screenshots/analytics-admin-390.png', fullPage: true })
    const editorContext = await browser.newContext()
    assert.equal((await editorContext.request.post(origin + '/api/users/login', { headers: { Origin: origin }, data: { email: editor.email, password } })).status(), 200)
    // Next may have started streaming a 200 shell before notFound(); assert that no report or contacts render.
    const editorPage = await editorContext.newPage()
    await editorPage.goto(origin + '/admin/analytics', { waitUntil: 'networkidle' })
    assert.equal(await editorPage.locator('.afara-analytics').count(), 0)
    assert.equal(await editorPage.getByText(contact, { exact: true }).count(), 0)
    assert.ok((await editorContext.request.post(origin + '/api/analytics/erase', { headers: { Origin: origin }, data: { visitorKey: visitor.visitorKey } })).status() >= 400)
    await page.getByRole('button', { name: 'Настройки cookie', exact: true }).click()
    await page.route('**/api/analytics/consent', route => route.abort())
    await page.getByRole('button', { name: 'Отключить и удалить историю', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Сбор остановлен' }).waitFor()
    const afterRefusal = trackingRequests
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); const button = document.createElement('button'); button.dataset.analyticsAction = 'assistant'; document.body.append(button); button.click(); button.remove(); window.scrollTo(0, 0) })
    await page.waitForTimeout(300)
    assert.equal(trackingRequests, afterRefusal, 'Local refusal immediately stops events even if server deletion fails')
    await page.unroute('**/api/analytics/consent')
    const revoked = page.waitForResponse(r => r.url().endsWith('/api/analytics/consent') && r.status() === 200)
    await page.getByRole('button', { name: 'Без аналитики', exact: true }).click(); await revoked
    assert.equal((await p.find({ collection: 'analytics-events', where: { visitor: { equals: visitor.id } } })).totalDocs, 0)
    assert.equal((await p.find({ collection: 'analytics-sessions', where: { visitor: { equals: visitor.id } } })).totalDocs, 0)
    assert.equal((await p.findByID({ collection: 'leads', id: linked.id, depth: 0 })).analyticsVisitor, null)
    assert.equal((await p.findByID({ collection: 'leads', id: linked.id, depth: 0 })).contact, contact)
    assert.equal((await context.request.post(origin + '/api/analytics/track', { headers: { Origin: origin }, data: { type: 'pageview', viewId: randomUUID(), sessionId: randomUUID(), path: '/' } })).status(), 403)
    const expired = await p.create({ collection: 'analytics-visitors', data: { visitorKey: randomUUID(), consentedAt: new Date().toISOString(), consentVersion: 'synthetic', consentText: 'Synthetic expiry test', expiresAt: new Date(Date.now() - 1000).toISOString() } }); visitors.push(expired.id)
    await eraseAnalytics(p)
    assert.equal((await p.find({ collection: 'analytics-visitors', where: { id: { equals: expired.id } } })).totalDocs, 0)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    for (const id of leads) await p.delete({ collection: 'leads', id }).catch(() => {})
    for (const id of visitors) { const doc = (await p.find({ collection: 'analytics-visitors', where: { id: { equals: id } }, limit: 1 })).docs[0]; if (doc) await eraseAnalytics(p, doc.visitorKey) }
    await p.updateGlobal({ slug: 'site', data: { analytics: initialSite.analytics || { enabled: false }, _status: initialSite._status } })
    for (const id of documents) await p.delete({ collection: 'documents', id })
    for (const id of users) await p.delete({ collection: 'users', id })
    await p.destroy()
  }
})
