import { cache } from 'react'
import { cms } from './payload'
import type { Page, Media } from '@/payload-types'
export const pageURL=(page:Pick<Page,'path'>)=>page.path==='home'?'/':`/${page.path}/`
export function media(value:unknown):Media|null {return value&&typeof value==='object'&&'url' in value?value as Media:null}
export const publicSite=cache(async()=>{
  const p=await cms()
  return p.findGlobal({slug:'site',draft:false,depth:0})
})
export const publicPages=cache(async()=>{
  const p=await cms()
  return (await p.find({collection:'pages',where:{_status:{equals:'published'}},overrideAccess:false,depth:2,limit:100,sort:'createdAt'})).docs
})
export const publicDocuments=cache(async()=>{
  const p=await cms()
  return (await p.find({collection:'documents',where:{_status:{equals:'published'}},overrideAccess:false,depth:0,limit:20})).docs
})
