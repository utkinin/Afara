import { headers } from 'next/headers'
import type { Knowledge, Page, Site } from '../payload-types'
import { serializeStructuredData, structuredData } from '../lib/structured-data'

export async function StructuredData(props: { page: Page; pages: Page[]; site: Site; knowledge: Knowledge[] }) {
  if (process.env.AFARA_STAGE !== 'production') return null
  const data = structuredData(props.page, props.pages, props.site, props.knowledge, process.env.APP_URL)
  if (!data) return null
  return <script type="application/ld+json" nonce={(await headers()).get('x-nonce') || undefined} dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }} />
}
