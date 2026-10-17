import { DefaultTemplate } from '@payloadcms/next/templates'
import { notFound } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { verifyAccess } from '../lib/gateway'
import { readAnalyticsReport } from '../lib/analytics-report'
import { AnalyticsPanel } from './AnalyticsPanel'
import { AnalyticsRefresh } from './AnalyticsRefresh'

export default async function AnalyticsView(props: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = props.initPageResult
  if (req.user?.role !== 'ADMIN' || process.env.AFARA_STAGE === 'production' && !await verifyAccess(req.headers)) notFound()
  const data = await readAnalyticsReport(req.payload, props.searchParams)
  return <DefaultTemplate i18n={req.i18n} payload={req.payload} req={req} user={props.user} permissions={permissions} visibleEntities={visibleEntities} locale={locale} params={props.params} searchParams={props.searchParams} viewType="analytics"><AnalyticsPanel data={data} refresh={<AnalyticsRefresh />} /></DefaultTemplate>
}
