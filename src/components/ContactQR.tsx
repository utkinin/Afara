import Image from 'next/image'
import { createContactQR } from '@/lib/editorial-qr'
import styles from './site.module.css'

export async function ContactQR() {
  const code = await createContactQR(process.env.AFARA_PUBLIC_URL || process.env.APP_URL)
  if (!code) return null
  // Generated entirely on the server, with no third-party QR service or browser library.
  const { target, src } = code
  return <figure className={styles.contactQR}><a href={target}><Image unoptimized src={src} width={240} height={240} loading="lazy" alt="QR-код страницы контактов AFARA" /></a><figcaption><a href={target}>Открыть контакты на другом устройстве</a></figcaption></figure>
}
