import QRCode from 'qrcode'
import { publicContactsURL } from '@/lib/contact-links'
import styles from './site.module.css'

export function ContactsQR({ path }: { path: string }) {
  const url = publicContactsURL(process.env.AFARA_PUBLIC_URL || process.env.APP_URL, path)
  if (!url) return null
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const margin = 4, size = modules.size + margin * 2
  const dots: string[] = []
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) {
    if (modules.get(y, x)) dots.push(`M${x + margin} ${y + margin}h1v1h-1z`)
  }
  return <figure className={styles.contactQR}>
    <svg viewBox={`0 0 ${size} ${size}`} width="176" height="176" role="img" aria-label="QR-код страницы контактов AFARA" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff"/><path d={dots.join('')} fill="#1e1b1d"/>
    </svg>
    <figcaption>Открыть контакты на телефоне<a href={url}>{url}</a></figcaption>
  </figure>
}
