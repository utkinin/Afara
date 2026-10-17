import { acquisitionFromURL, ANALYTICS_SESSION_MS, type AnalyticsPolicy } from './analytics-shared'

let context: { viewId: string; version: string } | null = null
export const currentAnalyticsContext = () => context
const storageKey = 'afara.analytics.session.v1'

export function startAnalytics(path: string, policy: AnalyticsPolicy): () => void {
  let stopped = false, ready = false, viewId = '', sessionId = '', total = 0, sent = 0
  let tick = performance.now(), lastInput = tick, lastTouch = 0, running = document.visibilityState === 'visible' && document.hasFocus()
  const acquisition = acquisitionFromURL(location.href, document.referrer)
  const remember = () => { lastTouch = Date.now(); try { sessionStorage.setItem(storageKey, JSON.stringify({ id: sessionId, at: lastTouch })) } catch {} }
  const post = async (payload: object) => {
    const current = viewId
    try {
      const response = await fetch('/api/analytics/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true, signal: AbortSignal.timeout(5000) })
      if (stopped || current !== viewId) return false
      if (response.status === 410) { begin(true); return false }
      if (response.status === 403 || response.status === 409) { stopped = true; context = null; window.dispatchEvent(new Event('afara:analytics-invalid')); return false }
      if (response.ok) remember()
      return response.ok
    } catch { return false }
  }
  const begin = (fresh = false) => {
    let saved: { id?: string; at?: number } = {}
    if (!fresh) try { saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}') } catch {}
    sessionId = saved.id && saved.at && Date.now() - saved.at < ANALYTICS_SESSION_MS ? saved.id : crypto.randomUUID()
    viewId = crypto.randomUUID(); ready = false; total = 0; sent = 0; tick = performance.now(); lastInput = tick; context = null
    const current = viewId
    void post({ type: 'pageview', viewId, sessionId, path, acquisition }).then(ok => { if (ok && !stopped && current === viewId) { ready = true; context = { viewId, version: policy.version } } })
  }
  const advance = () => { const now = performance.now(); if (running) total += Math.max(0, Math.min(now, lastInput + 60000) - tick); tick = now }
  const flush = (beacon = false) => {
    advance()
    if (stopped || !ready || total - sent < 500) return
    const payload = { type: 'ping', viewId, activeMs: Math.min(86400000, Math.round(total)) }
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/analytics/track', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    else void post(payload)
    sent = total
  }
  const interaction = () => { advance(); lastInput = performance.now(); if (!stopped && ready && Date.now() - lastTouch > ANALYTICS_SESSION_MS) begin(true) }
  const visibility = () => { flush(true); running = document.visibilityState === 'visible' && document.hasFocus(); tick = performance.now(); if (running) { lastInput = tick; if (!stopped && ready && Date.now() - lastTouch > ANALYTICS_SESSION_MS) begin(true) } }
  const choice = (event: Event) => {
    const value = (event as CustomEvent<{ granted?: boolean; version?: string } | null>).detail
    if (!value?.granted || value.version !== policy.version) { stopped = true; context = null }
  }
  const click = (event: MouseEvent) => {
    if (stopped || !ready || !(event.target instanceof Element)) return
    const target = event.target.closest<HTMLElement>('a,button'), href = target?.getAttribute('href') || ''
    let label = target?.dataset.analyticsAction
    if (href.startsWith('tel:')) label = 'phone'
    else if (href.startsWith('mailto:')) label = 'email'
    else if (href === '#consultation') label = 'inquiry'
    else { try { if (['t.me', 'wa.me', 'max.ru', 'vk.com'].includes(new URL(href).hostname)) label = 'message' } catch {} }
    if (label && ['phone', 'email', 'inquiry', 'message', 'assistant'].includes(label)) void post({ type: 'action', viewId, eventId: crypto.randomUUID(), label })
  }
  begin()
  const timer = window.setInterval(() => flush(), 20000)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', visibility); window.addEventListener('blur', visibility)
  window.addEventListener('pagehide', visibility)
  for (const name of ['pointerdown', 'keydown', 'scroll'] as const) window.addEventListener(name, interaction, { passive: true })
  document.addEventListener('click', click)
  window.addEventListener('afara:analytics-choice', choice)
  return () => {
    flush(true); stopped = true; context = null; clearInterval(timer)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('focus', visibility); window.removeEventListener('blur', visibility); window.removeEventListener('pagehide', visibility)
    for (const name of ['pointerdown', 'keydown', 'scroll'] as const) window.removeEventListener(name, interaction)
    document.removeEventListener('click', click)
    window.removeEventListener('afara:analytics-choice', choice)
  }
}
