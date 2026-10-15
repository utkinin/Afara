import { cms } from '@/lib/payload'
import { pageURL } from '@/lib/urls'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  const missing = () => new Response('Ссылка не найдена', { status: 404, headers })
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(slug)) return missing()
  try {
    const p = await cms()
    // A narrow privileged lookup; only the validated public destination leaves this handler.
    const links = await p.find({ collection: 'short-links', where: { and: [{ slug: { equals: slug } }, { enabled: { equals: true } }] }, limit: 1, depth: 0 })
    const target = links.docs[0]?.target
    const id = typeof target === 'object' ? target?.id : target
    if (!id) return missing()
    const pages = await p.find({ collection: 'pages', overrideAccess: false, depth: 0, limit: 1, where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] } })
    const page = pages.docs[0]
    if (!page || !/^(home|[a-z0-9-]+(?:\/[a-z0-9-]+)*)$/.test(page.path) || /^(s|admin|api|preview|documents)(\/|$)/.test(page.path)) return missing()
    return new Response(null, { status: 302, headers: { ...headers, Location: pageURL(page) } })
  } catch { return new Response('Ссылка временно недоступна', { status: 503, headers }) }
}
