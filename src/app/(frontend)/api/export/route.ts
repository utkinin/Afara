import { cms } from '@/lib/payload'
import { csvCell } from '@/lib/inquiry-schema'
export async function GET(req:Request){
  const p=await cms(),{user}=await p.auth({headers:req.headers})
  if(user?.role!=='ADMIN')return new Response('Forbidden',{status:403})
  const docs=await p.find({collection:'leads',limit:1000,depth:0,overrideAccess:false,user,sort:'-createdAt'})
  const columns=['createdAt','name','contact','channel','space','city','description','status'] as const
  const csv=[columns.map(csvCell).join(','),...docs.docs.map(d=>columns.map(k=>csvCell(d[k])).join(','))].join('\r\n')
  await p.create({collection:'audit',data:{actor:String(user.id),action:'export',object:`leads:${docs.docs.length}`}})
  return new Response('\ufeff'+csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="afara-leads.csv"','Cache-Control':'private, no-store'}})
}
