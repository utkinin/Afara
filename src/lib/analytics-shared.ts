export const ANALYTICS_CHOICE_COOKIE = 'afara_analytics_choice'
export const ANALYTICS_RETENTION_DAYS = 90
export const ANALYTICS_SESSION_MS = 30 * 60 * 1000
export const ANALYTICS_LINK_TEXT = 'Разрешаю связать эту заявку с историей моих визитов в этом браузере за последние 90 дней. Это необязательно для отправки заявки.'
export type AnalyticsPolicy = { version: string; url: string }
export type AnalyticsChoice = { granted: boolean; version: string }
export type Acquisition = Partial<Record<'referrerHost' | 'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmContent' | 'utmTerm' | 'searchTerm' | 'queryKind', string>>

export function safeAnalyticsText(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().slice(0, max)
  // Never store contacts, network addresses, URLs or markup accidentally put into campaign tags.
  if (!text || /[@<>\u0000-\u001f]|https?:|(?:\d[\s()+.-]*){7,}|(?:\d{1,3}\.){3}\d{1,3}/i.test(text)) return undefined
  return text
}
export function safeAnalyticsPath(value: string): boolean {
  return value.length <= 200 && /^\/(?:[a-z0-9-]+\/)*$/.test(value) && !/^\/(admin|api|preview|documents|s)(\/|$)/.test(value)
}
export function searchHost(host = ''): boolean { return /^(?:www\.)?(?:google\.[a-z.]{2,12}|yandex\.(?:ru|com|by|kz)|ya\.ru|bing\.com|duckduckgo\.com)$/.test(host) }
export const analyticsChannels = { ai_referral: 'Переход из ИИ-сервиса', ai_tagged: 'ИИ указан в UTM', search: 'Поиск / organic', paid: 'Платная UTM-метка', referral: 'Другой внешний источник', direct: 'Прямой / источник не передан' } as const
export function analyticsChannel(data: Acquisition): keyof typeof analyticsChannels {
  if (/^(cpc|ppc|paid|paidsearch|paid-social|display|cpm)$/i.test(data.utmMedium || '')) return 'paid'
  if (['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'www.perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com'].includes(data.referrerHost || '')) return 'ai_referral'
  if (/^(chatgpt|perplexity|claude|gemini|copilot)(\.com|\.ai)?$/i.test(data.utmSource || '')) return 'ai_tagged'
  if (searchHost(data.referrerHost) || data.utmMedium?.toLowerCase() === 'organic') return 'search'
  return data.referrerHost || data.utmSource ? 'referral' : 'direct'
}
export function scrollBucket(top: number, height: number, viewport: number): number {
  if (![top, height, viewport].every(Number.isFinite) || height <= 0 || viewport <= 0) return 0
  return Math.min(100, Math.max(0, Math.floor((Math.max(0, top) + viewport + 1) / height * 4) * 25))
}
export function sanitizeAcquisition(value: Acquisition): Acquisition {
  const clean: Acquisition = {}
  for (const key of ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'] as const) clean[key] = safeAnalyticsText(value[key])
  if (value.referrerHost && /^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(value.referrerHost) && value.referrerHost.length <= 200) clean.referrerHost = value.referrerHost
  if (clean.utmTerm) { clean.searchTerm = clean.utmTerm; clean.queryKind = 'utm_term' }
  else if (searchHost(clean.referrerHost) && value.queryKind === 'referrer') { clean.searchTerm = safeAnalyticsText(value.searchTerm, 150); if (clean.searchTerm) clean.queryKind = 'referrer' }
  return clean
}
export function acquisitionFromURL(href: string, referrer: string): Acquisition {
  const page = new URL(href), params = page.searchParams, data: Acquisition = {}
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) data[({ source: 'utmSource', medium: 'utmMedium', campaign: 'utmCampaign', content: 'utmContent', term: 'utmTerm' } as const)[key]] = params.get('utm_' + key) || undefined
  try {
    const previous = new URL(referrer)
    if (previous.origin !== page.origin) {
      data.referrerHost = previous.hostname.toLowerCase()
      if (searchHost(data.referrerHost)) { data.searchTerm = previous.searchParams.get('q') || previous.searchParams.get('text') || undefined; data.queryKind = 'referrer' }
    }
  } catch { /* A referrer is optional. Its full URL is never transmitted. */ }
  return sanitizeAcquisition(data)
}
export function browserAnalyticsChoice(): AnalyticsChoice | null {
  const value = document.cookie.split('; ').find(c => c.startsWith(ANALYTICS_CHOICE_COOKIE + '='))?.slice(ANALYTICS_CHOICE_COOKIE.length + 1)
  if (!value) return null
  try { const choice = JSON.parse(decodeURIComponent(value)); return typeof choice.granted === 'boolean' && typeof choice.version === 'string' ? choice : null } catch { return null }
}
export function privacySignal(): boolean {
  return navigator.doNotTrack === '1' || Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl)
}
