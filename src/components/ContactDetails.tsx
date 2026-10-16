import type { Site } from '@/payload-types'
import styles from './site.module.css'

export function ContactDetails({ site, full = false }: { site: Site; full?: boolean }) {
  return <address className={styles.contacts}>
    {site.messengers?.map(m => <a href={m.url} key={m.id || m.url} rel="noopener noreferrer">{m.label}</a>)}
    {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
    {site.phone && <a href={`tel:${site.phone.replace(/[^+\d]/g, '')}`}>{site.phone}</a>}
    {site.geography && <p>{site.geography}</p>}
    {site.address && <p>{site.address}</p>}
    {site.hours && <p>{site.hours}{site.timezone ? ` · ${site.timezone}` : ''}</p>}
    {full && site.meeting && <p>{site.meeting}</p>}
    {full && site.legalDetails && <p className={styles.legalDetails}>{site.legalDetails}</p>}
  </address>
}
