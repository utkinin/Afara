import type { Payload } from 'payload'
import { z } from 'zod'
import { safeAnalyticsText } from './analytics-shared'

type Session = { id: number; session_key: string; visitor_id: number; visitor_key: string; created_at: string; last_seen: string; source: string; source_type: string | null; landing_path: string; device: string; browser: string; os: string; country: string | null; utm_campaign: string | null; utm_medium: string | null; search_term: string | null; query_kind: string | null; views: number; active_ms: number; converted: boolean; identified: boolean }
export type AnalyticsStep = { id: number; kind: string; path: string; label: string | null; created_at: string; active_ms: number; scroll_percent: number }
type Ranked = { label: string; count: number; active_ms?: number; query_kind?: string; scroll_percent?: number; reached_75?: number }
type Lead = { id: number; name: string; contact: string; channel: string; city: string; created_at: string; analytics_consent_at: string }
type Params = Record<string, unknown>
export function analyticsFilters(params: Params = {}) {
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30
  return { days, source: safeAnalyticsText(params.source, 200) || '', leads: params.leads === 'yes' || params.leads === 'no' ? params.leads : '', selected: z.uuid().safeParse(params.session).success ? String(params.session) : '' }
}
export async function readAnalyticsReport(p: Payload, params: Params = {}) {
  const filters = analyticsFilters(params), values = [filters.days, filters.source || null, filters.leads || null]
  const converted = 'EXISTS(SELECT 1 FROM leads l WHERE l.analytics_session_id=s.id AND l.analytics_consent_at IS NOT NULL)'
  const identified = 'EXISTS(SELECT 1 FROM leads l WHERE l.analytics_visitor_id=s.visitor_id AND l.analytics_consent_at IS NOT NULL)'
  const from = 'FROM analytics_sessions s JOIN analytics_visitors v ON v.id=s.visitor_id'
  const where = `WHERE s.created_at>=NOW()-($1::int*INTERVAL '1 day') AND v.expires_at>NOW() AND ($2::text IS NULL OR s.source=$2) AND ($3::text IS NULL OR ($3='yes' AND ${identified}) OR ($3='no' AND NOT ${identified}))`
  const columns = `s.*,v.visitor_key,COUNT(e.id) FILTER(WHERE e.kind='pageview')::int AS views,COALESCE(SUM(e.active_ms) FILTER(WHERE e.kind='pageview'),0)::float8 AS active_ms,${converted} AS converted,${identified} AS identified`
  const [summary, sources, landings, queries, pages, sessions, live, channels] = await Promise.all([
    p.db.pool.query(`SELECT COUNT(*)::int AS visits,COUNT(DISTINCT s.visitor_id)::int AS browsers,COUNT(*) FILTER(WHERE ${converted})::int AS converted,COUNT(*) FILTER(WHERE s.last_seen>NOW()-INTERVAL '45 seconds')::int AS active ${from} ${where}`, values),
    p.db.pool.query(`SELECT COALESCE(s.source,'Не передан') AS label,COUNT(*)::int AS count ${from} ${where} GROUP BY s.source ORDER BY count DESC LIMIT 8`, values),
    p.db.pool.query(`SELECT s.landing_path AS label,COUNT(*)::int AS count ${from} ${where} GROUP BY s.landing_path ORDER BY count DESC LIMIT 5`, values),
    p.db.pool.query(`SELECT s.search_term AS label,s.query_kind,COUNT(*)::int AS count ${from} ${where} AND s.search_term IS NOT NULL GROUP BY s.search_term,s.query_kind ORDER BY count DESC LIMIT 5`, values),
    p.db.pool.query(`SELECT e.path AS label,COUNT(*)::int AS count,COALESCE(AVG(e.active_ms),0)::float8 AS active_ms,COALESCE(AVG(e.scroll_percent),0)::float8 AS scroll_percent,COUNT(*) FILTER(WHERE e.scroll_percent>=75)::int AS reached_75 ${from} JOIN analytics_events e ON e.session_id=s.id ${where} AND e.kind='pageview' GROUP BY e.path ORDER BY count DESC LIMIT 10`, values),
    p.db.pool.query(`SELECT ${columns} ${from} LEFT JOIN analytics_events e ON e.session_id=s.id ${where} GROUP BY s.id,v.visitor_key ORDER BY s.created_at DESC,s.id DESC LIMIT 50`, values),
    p.db.pool.query(`SELECT s.session_key,s.source,(SELECT e.path FROM analytics_events e WHERE e.session_id=s.id AND e.kind='pageview' ORDER BY e.created_at DESC LIMIT 1) AS path ${from} ${where} AND s.last_seen>NOW()-INTERVAL '45 seconds' ORDER BY s.last_seen DESC LIMIT 10`, values),
    p.db.pool.query(`SELECT COALESCE(s.source_type,'direct') AS label,COUNT(*)::int AS count,COUNT(*) FILTER(WHERE ${converted})::int AS converted ${from} ${where} GROUP BY s.source_type ORDER BY count DESC LIMIT 8`, values),
  ])
  let selected: Session | null = null, steps: AnalyticsStep[] = [], leads: Lead[] = [], history: Pick<Session, 'session_key' | 'created_at' | 'source' | 'landing_path'>[] = []
  if (filters.selected) {
    selected = (await p.db.pool.query(`SELECT ${columns} ${from} LEFT JOIN analytics_events e ON e.session_id=s.id WHERE s.session_key=$1 AND v.expires_at>NOW() GROUP BY s.id,v.visitor_key`, [filters.selected])).rows[0] || null
    if (selected) {
      const result = await Promise.all([
        p.db.pool.query('SELECT id,kind,path,label,created_at,active_ms,scroll_percent FROM analytics_events WHERE session_id=$1 ORDER BY created_at,id LIMIT 250', [selected.id]),
        p.db.pool.query('SELECT id,name,contact,channel,city,created_at,analytics_consent_at FROM leads WHERE analytics_visitor_id=$1 AND analytics_consent_at IS NOT NULL ORDER BY created_at DESC LIMIT 20', [selected.visitor_id]),
        p.db.pool.query('SELECT session_key,created_at,source,landing_path FROM analytics_sessions WHERE visitor_id=$1 ORDER BY created_at DESC LIMIT 20', [selected.visitor_id]),
      ])
      steps = result[0].rows; leads = result[1].rows; history = result[2].rows
    }
  }
  return { filters, summary: summary.rows[0] as { visits: number; browsers: number; converted: number; active: number }, channels: channels.rows as { label: string; count: number; converted: number }[], sources: sources.rows as Ranked[], landings: landings.rows as Ranked[], queries: queries.rows as Ranked[], pages: pages.rows as Ranked[], sessions: sessions.rows as Session[], live: live.rows as { session_key: string; source: string; path: string }[], selected, steps, leads, history }
}
export type AnalyticsReport = Awaited<ReturnType<typeof readAnalyticsReport>>
