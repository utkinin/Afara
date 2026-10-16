import type { Site } from '../payload-types'

export const collectionDisclosure = 'Визуальная коллекция AFARA — концепции для обсуждения цвета, света и композиции.'

// Only an explicitly public HTTPS base is suitable for a printed QR. Never encode localhost.
export function contactPublicURL(input: string | undefined): string | null {
  try {
    const url = new URL(input || '')
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || url.port || host === 'localhost' || !host.includes('.') || host.endsWith('.local') || host.endsWith('.test') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return null
    url.search = ''; url.hash = ''
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/kontakty/`
    return url.href
  } catch { return null }
}

export function messageURL(site: Pick<Site, 'messengers'>): string {
  for (const messenger of site.messengers || []) {
    try {
      const url = new URL(messenger.url)
      if (url.protocol === 'https:' && url.hostname === 't.me' && !url.username && !url.password && !url.port && /^\/[a-zA-Z0-9_]{5,32}\/?$/.test(url.pathname)) return url.href
    } catch { /* A malformed saved value never becomes a public link. */ }
  }
  return '#consultation'
}
