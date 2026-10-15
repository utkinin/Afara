import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cms } from '@/lib/payload'
import { publicPages, publicDocuments } from '@/lib/content'
import { Website } from '@/components/Website'
export const metadata={title:'Предпросмотр',robots:{index:false,follow:false}}
export default async function Preview({searchParams}:{searchParams:Promise<{page?:string}>}){
  const p=await cms(),auth=await p.auth({headers:await headers()})
  if(!auth.user)notFound()
  const id=Number((await searchParams).page);if(!Number.isSafeInteger(id))notFound()
  const page=await p.findByID({collection:'pages',id,draft:true,user:auth.user,overrideAccess:false,depth:2})
  const site=await p.findGlobal({slug:'site',draft:true,user:auth.user,overrideAccess:false,depth:0})
  return <Website page={page} pages={await publicPages()} site={site} documents={await publicDocuments()} preview/>
}
