import QRCode from 'qrcode'
import { contactPublicURL } from './editorial'

export async function createContactQR(input: string | undefined) {
  const target = contactPublicURL(input)
  if (!target) return null
  const src = await QRCode.toDataURL(target, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#34222d', light: '#ffffff' } })
  return { target, src }
}
