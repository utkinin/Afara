import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cms } from '@/lib/payload'
import { ANALYTICS_CHOICE_COOKIE } from '@/lib/analytics-shared'
import { ANALYTICS_ID_COOKIE, analyticsPolicy, analyticsResponse, sameAnalyticsOrigin, smallJSON, readAnalyticsConsent, signedAnalyticsConsent, eraseAnalytics, analyticsLimit, randomUUID, maxAge } from '@/lib/analytics-server'

export async function POST(req: Request) {
  if (!sameAnalyticsOrigin(req)) return analyticsResponse(403)
  let choice: { granted: boolean; version?: string }
  try { choice = z.object({ granted: z.boolean(), version: z.string().max(200).optional() }).strict().parse(await smallJSON(req, 1024)) } catch { return analyticsResponse(400) }
  try {
    const p = await cms(), old = readAnalyticsConsent(req.headers, true)
    let version = choice.version || '', token = '', cookieAge = maxAge
    if (!choice.granted) {
      if (old) await eraseAnalytics(p, old.id)
    } else {
      if (req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') return analyticsResponse(409, { ok: false, message: 'В браузере включён запрет отслеживания.' })
      if (!(await analyticsLimit(p, req.headers))) return analyticsResponse(429)
      const policy = await analyticsPolicy(p, true)
      if (!policy || policy.version !== choice.version) return analyticsResponse(409, { ok: false, message: 'Условия аналитики изменились. Обновите страницу перед выбором.' })
      version = policy.version
      const valid = readAnalyticsConsent(req.headers)
      const existing = valid?.version === version ? (await p.find({ collection: 'analytics-visitors', where: { and: [{ visitorKey: { equals: valid.id } }, { expiresAt: { greater_than: new Date().toISOString() } }] }, limit: 1, depth: 0 })).docs[0] : null
      if (existing && valid) { token = signedAnalyticsConsent(valid); cookieAge = Math.max(0, Math.floor((valid.at + maxAge * 1000 - Date.now()) / 1000)) }
      else {
        if (old) await eraseAnalytics(p, old.id)
        const at = Date.now(), id = randomUUID()
        await p.create({ collection: 'analytics-visitors', data: { visitorKey: id, consentedAt: new Date(at).toISOString(), consentVersion: version, consentText: policy.body, expiresAt: new Date(at + maxAge * 1000).toISOString() } })
        token = signedAnalyticsConsent({ id, version, at })
      }
    }
    const response = NextResponse.json({ granted: choice.granted, version }, { headers: { 'Cache-Control': 'private, no-store' } })
    const flags = { path: '/', secure: new URL(req.url).protocol === 'https:' || process.env.AFARA_STAGE === 'production', sameSite: 'lax' as const }
    response.cookies.set(ANALYTICS_ID_COOKIE, token, { ...flags, httpOnly: true, maxAge: choice.granted ? cookieAge : 0 })
    response.cookies.set(ANALYTICS_CHOICE_COOKIE, JSON.stringify({ granted: choice.granted, version }), { ...flags, maxAge: cookieAge })
    return response
  } catch { console.error('analytics_consent_failed'); return analyticsResponse(503) }
}
