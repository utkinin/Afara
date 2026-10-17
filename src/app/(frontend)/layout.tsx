import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import '../../components/material-study.css'
import '../../components/analytics-consent.css'
export const metadata:Metadata={title:{default:'AFARA — текстильный дизайн и инженерная студия',template:'%s — AFARA'},description:'Сложные портьерные композиции для частных резиденций и HoReCa. Второй свет, многослойность, Wave, blackout, моторизация.',robots:{index:process.env.AFARA_STAGE==='production',follow:process.env.AFARA_STAGE==='production'}}
export default async function Layout({children}:{children:React.ReactNode}){
  await headers() // Per-request CSP nonce: public HTML is dynamic, never shared with a reused nonce.
  return <html lang="ru"><body>{children}</body></html>
}
