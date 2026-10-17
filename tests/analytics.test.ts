import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { acquisitionFromURL, sanitizeAcquisition, safeAnalyticsPath, safeAnalyticsText } from '../src/lib/analytics-shared'
import { analyticsFilters } from '../src/lib/analytics-report'
import { analyticsEventSchema, readAnalyticsConsent, signedAnalyticsConsent, ANALYTICS_ID_COOKIE } from '../src/lib/analytics-server'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

test('analytics strips private URL data and never invents an organic query', () => {
  const source = acquisitionFromURL('https://afara.test/kvartiry/?utm_source=yandex&utm_campaign=autumn&utm_term=сложные+шторы&email=someone@example.test#phone', 'https://yandex.ru/search/?text=другая+фраза')
  assert.equal(source.searchTerm, 'сложные шторы'); assert.equal(source.queryKind, 'utm_term')
  assert.equal('email' in source, false)
  assert.equal(acquisitionFromURL('https://afara.test/', 'https://www.google.com/').searchTerm, undefined)
  assert.equal(acquisitionFromURL('https://afara.test/', 'https://afara.test/private?email=x@example.test').referrerHost, undefined)
  for (const value of ['person@example.test', '+7 (999) 123-45-67', '127.0.0.1', '<img src=x>', 'https://other.test/?token=secret']) assert.equal(safeAnalyticsText(value), undefined)
  assert.equal(sanitizeAcquisition({ referrerHost: 'bad.test', queryKind: 'referrer', searchTerm: 'invented organic query' }).searchTerm, undefined)
  assert.ok(safeAnalyticsPath('/chastnye-interery/kvartiry/'))
  for (const path of ['/admin/', '/api/inquiry/', '/documents/private/', '/s/name/', '/?email=x', '//external.test/', '/../admin/', '/page/#secret']) assert.equal(safeAnalyticsPath(path), false)
})
test('tracking has a bounded allowlist and does not accept form data or browser fingerprints', () => {
  const viewId = randomUUID(), sessionId = randomUUID()
  assert.ok(analyticsEventSchema.safeParse({ type: 'pageview', viewId, sessionId, path: '/' }).success)
  assert.equal(analyticsEventSchema.safeParse({ type: 'ping', viewId, activeMs: 1000, email: 'private@example.test' }).success, false)
  assert.equal(analyticsEventSchema.safeParse({ type: 'action', viewId, eventId: randomUUID(), label: 'capture-all-fields' }).success, false)
  assert.equal(analyticsEventSchema.safeParse({ type: 'ping', viewId, activeMs: -1 }).success, false)
  assert.deepEqual(analyticsFilters({ days: '999999', source: 'private@example.test', leads: 'raw', session: '1 OR 1=1' }), { days: 30, source: '', leads: '', selected: '' })
})
test('an analytics cookie is purpose-signed, bounded in time and cannot select another browser', () => {
  const previous = process.env.PAYLOAD_SECRET
  process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
  try {
    const value = { id: randomUUID(), version: '123:v1', at: Date.now() }, token = signedAnalyticsConsent(value)
    const headers = new Headers({ cookie: `${ANALYTICS_ID_COOKIE}=${token}` })
    assert.deepEqual(readAnalyticsConsent(headers), value)
    assert.equal(readAnalyticsConsent(new Headers({ cookie: `${ANALYTICS_ID_COOKIE}=${token.slice(0, -1)}!` })), null)
    const expired = signedAnalyticsConsent({ ...value, at: Date.now() - 91 * 86400000 })
    assert.equal(readAnalyticsConsent(new Headers({ cookie: `${ANALYTICS_ID_COOKIE}=${expired}` })), null)
    assert.equal(readAnalyticsConsent(new Headers({ cookie: `${ANALYTICS_ID_COOKIE}=${expired}` }), true)?.id, value.id)
  } finally { if (previous === undefined) delete process.env.PAYLOAD_SECRET; else process.env.PAYLOAD_SECRET = previous }
})
test('production middleware exposes only the two write-only ingestion routes, never analytics reads or erasure', async () => {
  const stage = process.env.AFARA_STAGE
  process.env.AFARA_STAGE = 'production'
  try {
    for (const path of ['/admin/analytics', '/api/analytics-visitors', '/api/analytics-events', '/api/analytics/erase']) assert.equal((await proxy(new NextRequest('http://localhost:3000' + path, { method: 'POST' }))).status, 403)
    for (const path of ['/api/analytics/track', '/api/analytics/consent']) {
      assert.equal((await proxy(new NextRequest('http://localhost:3000' + path, { method: 'POST' }))).status, 200)
      assert.equal((await proxy(new NextRequest('http://localhost:3000' + path))).status, 403)
    }
  } finally { if (stage === undefined) delete process.env.AFARA_STAGE; else process.env.AFARA_STAGE = stage }
})
