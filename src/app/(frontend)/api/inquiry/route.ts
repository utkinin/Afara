import { randomUUID,createHash } from 'node:crypto'
import { cms } from '@/lib/payload'
import { inquirySchema } from '@/lib/inquiry-schema'
import { inquiryAttribution } from '@/lib/analytics-server'
const reply=(status:number)=>Response.json(status===201||status===200?{ok:true}:{ok:false,message:'Не удалось принять заявку. Проверьте данные или повторите позже.'},{status,headers:{'Cache-Control':'no-store'}})
export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(process.env.APP_URL||'http://localhost:3000').origin)return reply(403)
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415)
  const key=req.headers.get('idempotency-key');if(!key||!/^[-\da-f]{36}$/i.test(key))return reply(400)
  try{
    const reader=req.body?.getReader();if(!reader)return reply(400)
    const chunks:Uint8Array[]=[];let bytes=0
    for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16000){await reader.cancel();return reply(413)}chunks.push(value)}
    let body:unknown
    try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return reply(400)}
    const parsed=inquirySchema.safeParse(body)
    if(!parsed.success)return reply(400)
    const input=parsed.data,p=await cms()
    const {analyticsOptIn,analyticsView,analyticsVersion,...core}=input
    const fingerprint=createHash('sha256').update(JSON.stringify(core)).digest('hex')
    const existing=await p.find({collection:'leads',where:{idempotencyKey:{equals:key}},limit:1,depth:0})
    if(existing.docs.length)return reply(existing.docs[0].requestHash===fingerprint?200:409)
    const docs=(await p.find({collection:'documents',where:{_status:{equals:'published'}},overrideAccess:false,depth:0,limit:20})).docs
    const consent=docs.find(d=>d.kind==='consent'),privacy=docs.find(d=>d.kind==='privacy')
    if(!consent||!privacy||consent.version!==input.consentVersion)return reply(409)
    const source=await p.find({collection:'pages',where:{and:[{path:{equals:input.source}},{_status:{equals:'published'}}]},depth:0,limit:1,overrideAccess:false})
    if(!source.docs.length)return reply(400)
    const site=await p.findGlobal({slug:'site',draft:false,depth:0})
    if(site._status!=='published'||!site.form?.spaces?.some(s=>s.label===input.space))return reply(400)
    const bucket=`inquiries:${Math.floor(Date.now()/600000)}`
    const counter=await p.db.pool.query(`INSERT INTO rate_limits (key,count,expires_at,created_at,updated_at) VALUES ($1,1,NOW()+INTERVAL '20 minutes',NOW(),NOW()) ON CONFLICT (key) DO UPDATE SET count=rate_limits.count+1,updated_at=NOW() RETURNING count`,[bucket])
    if(counter.rows[0].count>30)return reply(429)
    const {website: ignoredWebsite,consent: ignoredConsent,consentVersion: ignoredVersion,...fields}=core
    void ignoredWebsite;void ignoredConsent;void ignoredVersion
    // Optional attribution cannot prevent a valid inquiry from being saved.
    let attribution={}
    try{attribution=await inquiryAttribution(p,req.headers,{analyticsOptIn,analyticsView,analyticsVersion})}catch{console.error('inquiry_attribution_unavailable')}
    const data={...fields,consentVersion:`${consent.id}:${consent.version}`,consentText:consent.body,idempotencyKey:key,requestHash:fingerprint,status:'new' as const,deliveryStatus:'pending' as const,retryAt:new Date().toISOString()}
    try{
      // The durable outbox fields are in this same PostgreSQL row: no second write can be lost.
      await p.create({collection:'leads',data:{...data,...attribution}})
    }catch(e){
      const duplicate=await p.find({collection:'leads',where:{idempotencyKey:{equals:key}},limit:1,depth:0})
      if(duplicate.docs.length)return reply(duplicate.docs[0].requestHash===fingerprint?200:409)
      if(Object.keys(attribution).length){
        // Withdrawal may delete the optional FK between lookup and creation; keep the inquiry.
        try{await p.create({collection:'leads',data})}
        catch(error){const retry=await p.find({collection:'leads',where:{idempotencyKey:{equals:key}},limit:1,depth:0});if(retry.docs.length)return reply(retry.docs[0].requestHash===fingerprint?200:409);throw error}
      }else throw e
    }
    return reply(201)
  }catch{console.error('inquiry_failed',randomUUID());return reply(503)}
}
