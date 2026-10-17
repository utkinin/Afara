import { cache } from 'react'
import { cms } from './payload'
import type { Page, Media } from '@/payload-types'
export const pageURL=(page:Pick<Page,'path'>)=>page.path==='home'?'/':`/${page.path}/`
export function media(value:unknown):Media|null {return value&&typeof value==='object'&&'url' in value?value as Media:null}
export const publicSite=cache(async()=>{
  const p=await cms()
  const site=await p.findGlobal({slug:'site',draft:false,depth:0})
  const ids=new Set<number>()
  const add=(v:unknown)=>{if(typeof v==='number')ids.add(v)}
  add(site.studio?.photo)
  for(const s of site.trust??[]){add(s.image);for(const c of s.cards??[])add(c.image)}
  const images=ids.size?(await p.find({collection:'media',where:{id:{in:[...ids]}},overrideAccess:false,depth:0,limit:100})).docs:[]
  const resolve=(v:unknown)=>typeof v==='number'?images.find(m=>m.id===v)||null:null
  if(site.studio)site.studio.photo=resolve(site.studio.photo)
  for(const s of site.trust??[]){s.image=resolve(s.image);for(const c of s.cards??[])c.image=resolve(c.image)}
  return site
})
export const publicPages=cache(async()=>{
  const p=await cms()
  return (await p.find({collection:'pages',where:{_status:{equals:'published'}},overrideAccess:false,depth:2,limit:100,sort:['navOrder','createdAt']})).docs
})
export const publicKnowledge=cache(async()=>{
  const p=await cms()
  const pages=await publicPages()
  return (await p.find({collection:'knowledge',where:{and:[{_status:{equals:'published'}},{approved:{equals:true}},{page:{in:pages.map(p=>p.id)}}]},overrideAccess:false,depth:0,limit:200,sort:'id'})).docs
})
export const publicWorks=cache(async()=>{
  const p=await cms()
  return (await p.find({collection:'works',where:{and:[{_status:{equals:'published'}},{verified:{equals:true}}]},overrideAccess:false,depth:1,limit:20,sort:'-createdAt'})).docs.filter(w=>w.photos?.length&&w.photos.every(p=>media(p.image)?._status==='published'))
})
export const publicDocuments=cache(async()=>{
  const p=await cms()
  return (await p.find({collection:'documents',where:{_status:{equals:'published'}},overrideAccess:false,depth:0,limit:20,sort:'-updatedAt'})).docs
})
