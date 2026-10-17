import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import { verifyAccess } from '../lib/gateway'
import { readAnalyticsReport } from '../lib/analytics-report'
import { AnalyticsPanel } from './AnalyticsPanel'
import { AnalyticsRefresh } from './AnalyticsRefresh'

export default async function AnalyticsView(props: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = props.initPageResult
  const allowed = req.user?.role === 'ADMIN' && (process.env.AFARA_STAGE !== 'production' || await verifyAccess(req.headers))
  const data = allowed ? await readAnalyticsReport(req.payload, props.searchParams) : null
  return <DefaultTemplate i18n={req.i18n} payload={req.payload} req={req} user={props.user} permissions={permissions} visibleEntities={visibleEntities} locale={locale} params={props.params} searchParams={props.searchParams} viewType="analytics">{data ? <AnalyticsPanel data={data} refresh={<AnalyticsRefresh />} /> : <section className="afara-analytics__denied"><h1>Доступ к аналитике ограничен</h1><p>Отчёт доступен администратору. Данные визитов и заявок не загружались.</p></section>}</DefaultTemplate>
}
