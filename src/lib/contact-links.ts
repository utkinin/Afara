export function telegramURL(messengers: { url: string }[] | null | undefined): string | null {
  for (const messenger of messengers || []) {
    try {
      const url = new URL(messenger.url)
      if (url.protocol === 'https:' && url.hostname === 't.me' && !url.username && !url.password && /^\/[a-zA-Z0-9_+][a-zA-Z0-9_+/-]*$/.test(url.pathname)) return url.href
    } catch { /* Ignore an unconfigured channel; never publish a placeholder destination. */ }
  }
  return null
}

export function publicContactsURL(base: string | undefined, path: string): string | null {
  try {
    const url = new URL(base || '')
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost') return null
    url.hash = ''; url.search = ''
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\/+|\/+$/g, '')}/`
    return url.href
  } catch { return null }
}
