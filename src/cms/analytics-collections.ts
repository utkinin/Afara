import type { CollectionConfig } from 'payload'
import { admin } from './access'

const access = { create: () => false, read: admin, update: () => false, delete: () => false }
const base = { access, admin: { hidden: true } }
export const AnalyticsVisitors: CollectionConfig = {
  ...base, slug: 'analytics-visitors', labels: { singular: 'Браузер с согласием', plural: 'Браузеры с согласием' },
  fields: [
    { name: 'visitorKey', type: 'text', required: true, unique: true },
    { name: 'consentedAt', type: 'date', required: true },
    { name: 'consentVersion', type: 'text', required: true },
    { name: 'consentText', type: 'textarea', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}
export const AnalyticsSessions: CollectionConfig = {
  ...base, slug: 'analytics-sessions', labels: { singular: 'Визит', plural: 'Визиты' },
  fields: [
    { name: 'sessionKey', type: 'text', required: true, unique: true },
    { name: 'visitor', type: 'relationship', relationTo: 'analytics-visitors', required: true, index: true },
    ...['landingPath', 'source', 'referrerHost', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'searchTerm', 'queryKind', 'device', 'browser', 'os', 'country'].map(name => ({ name, type: 'text' as const })),
    { name: 'sourceType', type: 'text' },
    { name: 'lastSeen', type: 'date', required: true, index: true },
  ],
}
export const AnalyticsEvents: CollectionConfig = {
  ...base, slug: 'analytics-events', labels: { singular: 'Шаг визита', plural: 'Шаги визитов' },
  fields: [
    { name: 'eventKey', type: 'text', required: true, unique: true },
    { name: 'session', type: 'relationship', relationTo: 'analytics-sessions', required: true, index: true },
    { name: 'visitor', type: 'relationship', relationTo: 'analytics-visitors', required: true, index: true },
    { name: 'kind', type: 'text', required: true },
    { name: 'path', type: 'text', required: true },
    { name: 'label', type: 'text' },
    { name: 'activeMs', type: 'number', defaultValue: 0 },
    { name: 'scrollPercent', type: 'number', defaultValue: 0, min: 0, max: 100 },
  ],
}
