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
  // Resolve draft uploads explicitly with the authenticated reader. Nested population may
  // retain only IDs for unpublished media; public rendering must never use this path.
  const images=new Map<number,ReturnType<typeof resolveImage>>()
  async function resolveImage(id:number){return p.findByID({collection:'media',id,draft:true,user:auth.user,overrideAccess:false,depth:0}).catch(()=>null)}
  const resolve=(value:unknown)=>{
    const id=typeof value==='number'?value:value&&typeof value==='object'&&'id' in value?Number(value.id):0
    if(!id)return Promise.resolve(null)
    if(!images.has(id))images.set(id,resolveImage(id))
    return images.get(id)!
  }
  page.hero=await resolve(page.hero);page.heroMobile=await resolve(page.heroMobile)
  for(const section of page.sections||[]){section.image=await resolve(section.image);for(const card of section.cards||[])card.image=await resolve(card.image)}
  if(site.studio)site.studio.photo=await resolve(site.studio.photo)
  for(const section of site.trust||[]){section.image=await resolve(section.image);for(const card of section.cards||[])card.image=await resolve(card.image)}
  return <Website page={page} pages={await publicPages()} site={site} documents={await publicDocuments()} preview/>
}
