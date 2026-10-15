import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publicDocuments } from '@/lib/content'
import styles from '@/components/site.module.css'
export default async function Document({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params,d=(await publicDocuments()).find(d=>d.slug===slug)
  if(!d)notFound()
  return <main className={`${styles.container} ${styles.document}`}><Link href="/">← AFARA</Link><h1>{d.title}</h1><p>Версия {d.version}</p>{d.body.split('\n\n').map((text,i)=><p key={i}>{text}</p>)}</main>
}
