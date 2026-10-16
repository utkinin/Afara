export function AnswerText({ text }: { text: string }) {
  const marker = '\nИсточник: '
  const index = text.lastIndexOf(marker)
  if (index < 0) return <>{text}</>
  let url: URL | null = null
  try { url = new URL(text.slice(index + marker.length).trim()) } catch { /* Keep malformed editorial text visible. */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password) return <>{text}</>
  return <>{text.slice(0, index)}<br/><a href={url.href} target="_blank" rel="noopener noreferrer">Источник: {url.hostname.replace(/^www\./, '')} ↗</a></>
}
