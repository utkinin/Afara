import type { Page } from '../payload-types'

// A partner landing uses the existing page schema, but is not a type of room.
export const isPartnerPage = (page: Pick<Page, 'path'>) => page.path === 'partnyoram'
export const isSpacePage = (page: Pick<Page, 'path' | 'type' | 'parent'>) => !isPartnerPage(page) && (page.type === 'overview' || page.type === 'direction' && !page.parent)
