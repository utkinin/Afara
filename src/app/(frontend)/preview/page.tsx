import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cms } from '@/lib/payload'
import { publicPages, publicDocuments } from '@/lib/content'
import { Website } from '@/components/Website'
export const metadata={title:'Предпросмотр',robots:{index:false,follow:false}}
export default async function Preview({searchParams}:{searchParams:Promise<{page?:string}>}){
  // Read request state before initializing CMS so a database is never contacted during prerender analysis.
  const requestHeaders=await headers()
  const p=await cms(),auth=await p.auth({headers:requestHeaders})
  if(!auth.user)notFound()
  const id=Number((await searchParams).page);if(!Number.isSafeInteger(id))notFound()
  const page=await p.findByID({collection:'pages',id,draft:true,user:auth.user,overrideAccess:false,depth:2})
  const site=await p.findGlobal({slug:'site',draft:true,user:auth.user,overrideAccess:false,depth:0})
  return <Website page={page} pages={await publicPages()} site={site} documents={await publicDocuments()} preview/>
}
