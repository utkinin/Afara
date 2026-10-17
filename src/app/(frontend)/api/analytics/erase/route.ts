import { z } from 'zod'
import { cms } from '@/lib/payload'
import { verifyAccess } from '@/lib/gateway'
import { analyticsResponse, sameAnalyticsOrigin, smallJSON, eraseAnalytics } from '@/lib/analytics-server'
export async function POST(req: Request) {
  if (!sameAnalyticsOrigin(req)) return analyticsResponse(403)
  const p = await cms(), { user } = await p.auth({ headers: req.headers })
  if (user?.role !== 'ADMIN' || process.env.AFARA_STAGE === 'production' && !await verifyAccess(req.headers)) return analyticsResponse(403)
  let visitorKey: string
  try { visitorKey = z.object({ visitorKey: z.uuid() }).strict().parse(await smallJSON(req, 512)).visitorKey } catch { return analyticsResponse(400) }
  try {
    const removed = await eraseAnalytics(p, visitorKey)
    await p.create({ collection: 'audit', data: { actor: String(user.id), action: 'erase-analytics', object: `browser-history:${removed}` } })
    return analyticsResponse(200)
  } catch { console.error('analytics_erase_failed'); return analyticsResponse(503) }
}
