import { cms } from '@/lib/payload'
import { analyticsEventSchema, analyticsPolicy, analyticsResponse, sameAnalyticsOrigin, smallJSON, readAnalyticsConsent, analyticsLimit, deviceInfo, sanitizeAcquisition } from '@/lib/analytics-server'

export async function POST(req: Request) {
  if (!sameAnalyticsOrigin(req)) return analyticsResponse(403)
  const consent = readAnalyticsConsent(req.headers)
  if (!consent || req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') return analyticsResponse(403)
  if (/bot|spider|crawler|headless|lighthouse/i.test(req.headers.get('user-agent') || '')) return analyticsResponse(200, { ignored: true })
  let event
  try { event = analyticsEventSchema.parse(await smallJSON(req)) } catch { return analyticsResponse(400) }
  try {
    const p = await cms(), policy = await analyticsPolicy(p)
    if (!policy || policy.version !== consent.version) return analyticsResponse(409, { reset: true })
    if (!(await analyticsLimit(p, req.headers, consent.id))) return analyticsResponse(429)
    if (event.type === 'pageview') {
      const path = event.path === '/' ? 'home' : event.path.slice(1, -1)
      const pages = await p.find({ collection: 'pages', where: { and: [{ path: { equals: path } }, { _status: { equals: 'published' } }] }, limit: 1, depth: 0, overrideAccess: false, select: { path: true } })
      if (!pages.docs.length) return analyticsResponse(400)
    }
    const db = await p.db.pool.connect()
    try {
      await db.query('BEGIN')
      // The lock serializes writes with withdrawal. A late beacon cannot recreate deleted history.
      const visitor = (await db.query('SELECT id FROM analytics_visitors WHERE visitor_key=$1 AND expires_at>NOW() FOR KEY SHARE', [consent.id])).rows[0]
      if (!visitor) { await db.query('ROLLBACK'); return analyticsResponse(403) }
      if (event.type === 'pageview') {
        const a = sanitizeAcquisition(event.acquisition || {}), info = deviceInfo(req.headers.get('user-agent') || '')
        const country = process.env.ANALYTICS_TRUST_CLOUDFLARE === 'true' && /^[A-Z]{2}$/.test(req.headers.get('cf-ipcountry') || '') ? req.headers.get('cf-ipcountry') : null
        const values = [event.sessionId, visitor.id, event.path, a.utmSource || a.referrerHost || 'Прямой / источник не передан', a.referrerHost, a.utmSource, a.utmMedium, a.utmCampaign, a.utmContent, a.utmTerm, a.searchTerm, a.queryKind, info.device, info.browser, info.os, country]
        const session = (await db.query(`INSERT INTO analytics_sessions (session_key,visitor_id,landing_path,source,referrer_host,utm_source,utm_medium,utm_campaign,utm_content,utm_term,search_term,query_kind,device,browser,os,country,last_seen,created_at,updated_at)
          VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')},NOW(),NOW(),NOW()) ON CONFLICT (session_key) DO UPDATE SET last_seen=NOW(),updated_at=NOW() WHERE analytics_sessions.visitor_id=$2 AND analytics_sessions.last_seen>NOW()-INTERVAL '30 minutes' RETURNING id`, values)).rows[0]
        if (!session) { await db.query('ROLLBACK'); return analyticsResponse(410) }
        await db.query("INSERT INTO analytics_events (event_key,session_id,visitor_id,kind,path,active_ms,created_at,updated_at) VALUES ($1,$2,$3,'pageview',$4,0,NOW(),NOW()) ON CONFLICT (event_key) DO NOTHING", [event.viewId, session.id, visitor.id, event.path])
        const own = await db.query("SELECT id FROM analytics_events WHERE event_key=$1 AND visitor_id=$2 AND session_id=$3 AND kind='pageview'", [event.viewId, visitor.id, session.id])
        if (!own.rows.length) { await db.query('ROLLBACK'); return analyticsResponse(409) }
      } else {
        const view = (await db.query("SELECT e.id,e.session_id,e.path FROM analytics_events e JOIN analytics_sessions s ON s.id=e.session_id WHERE e.event_key=$1 AND e.visitor_id=$2 AND e.kind='pageview' AND s.last_seen>NOW()-INTERVAL '30 minutes'", [event.viewId, visitor.id])).rows[0]
        if (!view) { await db.query('ROLLBACK'); return analyticsResponse(410) }
        if (event.type === 'ping') await db.query('UPDATE analytics_events SET active_ms=GREATEST(COALESCE(active_ms,0),LEAST($1,EXTRACT(EPOCH FROM (NOW()-created_at))*1000)),updated_at=NOW() WHERE id=$2', [event.activeMs, view.id])
        else await db.query("INSERT INTO analytics_events (event_key,session_id,visitor_id,kind,path,label,active_ms,created_at,updated_at) VALUES ($1,$2,$3,'action',$4,$5,0,NOW(),NOW()) ON CONFLICT (event_key) DO NOTHING", [event.eventId, view.session_id, visitor.id, view.path, event.label])
        await db.query('UPDATE analytics_sessions SET last_seen=NOW(),updated_at=NOW() WHERE id=$1', [view.session_id])
      }
      await db.query('COMMIT'); return analyticsResponse(200)
    } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
  } catch { console.error('analytics_track_failed'); return analyticsResponse(503) }
}
