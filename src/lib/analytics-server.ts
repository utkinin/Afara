import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { Payload } from 'payload'
import { z } from 'zod'
import { ANALYTICS_RETENTION_DAYS, ANALYTICS_SESSION_MS, ANALYTICS_LINK_TEXT, sanitizeAcquisition, safeAnalyticsPath, type AnalyticsPolicy } from './analytics-shared'

export const ANALYTICS_ID_COOKIE = 'afara_analytics'
const maxAge = ANALYTICS_RETENTION_DAYS * 86400
type Consent = { id: string; version: string; at: number }
const action = z.enum(['message', 'phone', 'email', 'inquiry', 'assistant'])
export const analyticsEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pageview'), viewId: z.uuid(), sessionId: z.uuid(), path: z.string().refine(safeAnalyticsPath), acquisition: z.object({ referrerHost: z.string().max(200).optional(), utmSource: z.string().max(120).optional(), utmMedium: z.string().max(120).optional(), utmCampaign: z.string().max(120).optional(), utmContent: z.string().max(120).optional(), utmTerm: z.string().max(120).optional(), searchTerm: z.string().max(150).optional(), queryKind: z.string().max(20).optional() }).strict().optional() }).strict(),
  z.object({ type: z.literal('ping'), viewId: z.uuid(), activeMs: z.number().int().min(0).max(86400000), scrollPercent: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional() }).strict(),
  z.object({ type: z.literal('action'), viewId: z.uuid(), eventId: z.uuid(), label: action }).strict(),
])
export function analyticsResponse(status: number, body: object = { ok: status < 400 }) { return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export function sameAnalyticsOrigin(req: Request): boolean { return req.headers.get('origin') === new URL(process.env.APP_URL || 'http://localhost:3000').origin }
export async function smallJSON(req: Request, max = 4096): Promise<unknown> {
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Error('content-type')
  const reader = req.body?.getReader(); if (!reader) throw new Error('empty')
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error('size') } chunks.push(value) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
function signature(value: string): string { return createHmac('sha256', process.env.PAYLOAD_SECRET || '').update('afara-analytics-v1:' + value).digest('base64url') }
export function signedAnalyticsConsent(value: Consent): string {
  if ((process.env.PAYLOAD_SECRET || '').length < 32) throw new Error('A strong application secret is required')
  const data = Buffer.from(JSON.stringify(value)).toString('base64url'); return data + '.' + signature(data)
}
export function readAnalyticsConsent(headers: Headers, includeExpired = false): Consent | null {
  const token = headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(ANALYTICS_ID_COOKIE + '='))?.slice(ANALYTICS_ID_COOKIE.length + 1)
  if (!token || token.length > 1200 || (process.env.PAYLOAD_SECRET || '').length < 32) return null
  try {
    const [data, mac, extra] = token.split('.'), expected = signature(data)
    if (extra || !mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
    const value = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (!z.uuid().safeParse(value.id).success || typeof value.version !== 'string' || !Number.isFinite(value.at) || value.at > Date.now() + 60000 || !includeExpired && Date.now() - value.at > maxAge * 1000) return null
    return value
  } catch { return null }
}
export async function analyticsPolicy(p: Payload, withText = false): Promise<(AnalyticsPolicy & { body: string }) | null> {
  const site = await p.findGlobal({ slug: 'site', draft: false, depth: 0, select: { analytics: true, _status: true } })
  if (site._status !== 'published' || !site.analytics?.enabled) return null
  const docs = (await p.find({ collection: 'documents', where: { and: [{ _status: { equals: 'published' } }, { kind: { in: ['analytics', 'privacy'] } }] }, overrideAccess: false, depth: 0, limit: 20, sort: '-updatedAt', select: { kind: true, version: true, slug: true, body: true } })).docs
  const policy = docs.find(d => d.kind === 'analytics')
  return policy && docs.some(d => d.kind === 'privacy') ? { version: `${policy.id}:${policy.version}`, url: `/documents/${policy.slug}/`, body: withText ? policy.body : '' } : null
}
export function deviceInfo(ua: string) {
  return { device: /ipad|tablet/i.test(ua) ? 'Планшет' : /mobile|iphone|android/i.test(ua) ? 'Телефон' : 'Компьютер', browser: /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Другой', os: /iphone|ipad/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /macintosh/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Другая' }
}
export async function analyticsLimit(p: Payload, headers: Headers, subject?: string): Promise<boolean> {
  // IP is used only for a short-lived security bucket when the origin is protected by a trusted proxy.
  const ip = process.env.ANALYTICS_TRUST_CLOUDFLARE === 'true' ? headers.get('cf-connecting-ip') : null
  const identity = subject || (ip && isIP(ip) ? signature(`${new Date().toISOString().slice(0, 10)}:${ip}`) : 'shared')
  const minute = Math.floor(Date.now() / 60000), key = `analytics:${identity}:${minute}`, globalKey = `analytics:global:${minute}`
  const result = await p.db.pool.query('INSERT INTO rate_limits (key,count,expires_at,created_at,updated_at) VALUES ($1,1,NOW()+INTERVAL \'2 minutes\',NOW(),NOW()),($2,1,NOW()+INTERVAL \'2 minutes\',NOW(),NOW()) ON CONFLICT (key) DO UPDATE SET count=rate_limits.count+1 RETURNING key,count', [key, globalKey])
  return result.rows.every((r: { key: string; count: number }) => r.count <= (r.key === globalKey ? 5000 : subject ? 180 : 60))
}
export async function eraseAnalytics(p: Payload, visitorKey?: string): Promise<number> {
  const client = await p.db.pool.connect()
  try {
    await client.query('BEGIN')
    const condition = visitorKey ? 'visitor_key=$1' : 'expires_at<NOW()'
    const values = visitorKey ? [visitorKey] : []
    const ids = (await client.query(`SELECT id FROM analytics_visitors WHERE ${condition} FOR UPDATE`, values)).rows.map((r: { id: number }) => r.id)
    if (ids.length) {
      await client.query('UPDATE leads SET analytics_visitor_id=NULL,analytics_session_id=NULL WHERE analytics_visitor_id=ANY($1::int[])', [ids])
      await client.query('DELETE FROM analytics_events WHERE visitor_id=ANY($1::int[])', [ids])
      await client.query('DELETE FROM analytics_sessions WHERE visitor_id=ANY($1::int[])', [ids])
      await client.query('DELETE FROM analytics_visitors WHERE id=ANY($1::int[])', [ids])
    }
    await client.query('COMMIT'); return ids.length
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
export async function inquiryAttribution(p: Payload, headers: Headers, input: { analyticsOptIn?: boolean; analyticsView?: string; analyticsVersion?: string }) {
  if (!input.analyticsOptIn || !input.analyticsView || headers.get('sec-gpc') === '1' || headers.get('dnt') === '1') return {}
  const consent = readAnalyticsConsent(headers), policy = consent && await analyticsPolicy(p, true)
  if (!consent || !policy || policy.version !== consent.version || policy.version !== input.analyticsVersion) return {}
  const result = await p.db.pool.query('SELECT e.visitor_id,e.session_id FROM analytics_events e JOIN analytics_visitors v ON v.id=e.visitor_id WHERE e.event_key=$1 AND e.kind=\'pageview\' AND v.visitor_key=$2 AND v.expires_at>NOW()', [input.analyticsView, consent.id])
  const match = result.rows[0]
  return match ? { analyticsVisitor: match.visitor_id, analyticsSession: match.session_id, analyticsConsentVersion: policy.version, analyticsConsentText: ANALYTICS_LINK_TEXT + '\n\n' + policy.body, analyticsConsentAt: new Date().toISOString() } : {}
}
export { randomUUID, maxAge, ANALYTICS_SESSION_MS, sanitizeAcquisition }
