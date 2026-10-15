import type { Metadata } from 'next'
import { cms } from '@/lib/payload'
import {pageURL} from '@/lib/urls'
import { notFound,permanentRedirect } from 'next/navigation'
import { publicPages,publicSite,publicDocuments,publicKnowledge,publicWorks } from '@/lib/content'
import { Website } from '@/components/Website'
import styles from '@/components/site.module.css'
type Props={params:Promise<{path?:string[]}>}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const path=(await params).path?.join('/')||'home'
  const page=(await publicPages()).find(p=>p.path===path)
  return page?{title:page.seo?.title||page.h1,description:page.seo?.description||page.intro,alternates:process.env.AFARA_STAGE==='production'?{canonical:new URL(path==='home'?'/':`/${path}/`,process.env.APP_URL).toString()}:undefined}:{}
}
export default async function Page({params}:Props){
  const path=(await params).path?.join('/')||'home'
  const [pages,site,documents,knowledge,works]=await Promise.all([publicPages(),publicSite(),publicDocuments(),publicKnowledge(),publicWorks()])
  if(site._status!=='published')return <main className={styles.empty}><h1>AFARA</h1><p>Сайт готовится к публикации.</p></main>
  const page=pages.find(p=>p.path===path)
  if(!page){if(path!=='home'){const p=await cms(),aliases=await p.find({collection:'redirects',where:{from:{equals:path}},depth:0,limit:1});const target=aliases.docs[0]?.target;const id=typeof target==='object'?target?.id:target;const destination=pages.find(p=>p.id===id);if(destination)permanentRedirect(pageURL(destination));notFound();}return <main className={styles.empty}><h1>AFARA</h1><p>Сайт готовится к публикации.</p></main>}
  return <Website page={page} pages={pages} site={site} documents={documents} knowledge={knowledge} works={works}/>
}
