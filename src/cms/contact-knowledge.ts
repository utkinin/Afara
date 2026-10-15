import type { Site } from '../payload-types'

// Whitelist only the public contact fields, never the whole global or private settings.
export function publicContactText(site: Partial<Site>): string {
  return [site.geography, site.phone ? `Телефон: ${site.phone}` : '', site.email ? `Email: ${site.email}` : '',
    site.address, [site.hours, site.timezone].filter(Boolean).join(' · '), site.meeting, site.legalDetails,
    ...site.messengers?.map(m => `${m.label}: ${m.url}`) || [],
  ].filter(Boolean).join('\n')
}
