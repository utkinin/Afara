import { randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import { cms } from './payload'
export async function processNotification(){
  const p=await cms(),token=randomUUID()
  await p.db.pool.query("UPDATE leads SET delivery_status='failed',delivery_error='Worker lease expired after maximum attempts',lease_token=NULL,lease_until=NULL WHERE delivery_status='processing' AND lease_until<NOW() AND attempts>=5")
  // Claim with row lock + SKIP LOCKED. Lease survives crashes; completion requires the lease token.
  const claimed=await p.db.pool.query(`UPDATE leads SET delivery_status='processing',lease_until=NOW()+INTERVAL '90 seconds',lease_token=$1,attempts=COALESCE(attempts,0)+1 WHERE id=(SELECT id FROM leads WHERE ((delivery_status='pending' AND (retry_at IS NULL OR retry_at<=NOW())) OR (delivery_status='processing' AND lease_until<NOW())) AND COALESCE(attempts,0)<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`,[token])
  if(!claimed.rows.length)return false
  const id=claimed.rows[0].id as number
  try{
    const lead=await p.findByID({collection:'leads',id,depth:0}),settings=await p.findGlobal({slug:'notifications',depth:0})
    if(!settings.recipient||!process.env.SMTP_HOST||!process.env.SMTP_FROM)throw new Error('configuration')
    const production=process.env.AFARA_STAGE==='production'
    if(production&&(!process.env.SMTP_USER||!process.env.SMTP_PASSWORD))throw new Error('configuration')
    const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',requireTLS:production,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000})
    await transport.sendMail({from:process.env.SMTP_FROM,to:settings.recipient,subject:`AFARA — новая заявка #${id}`,messageId:`<afara-lead-${id}@${new URL(process.env.APP_URL||'http://localhost:3000').hostname}>`,text:`Новая заявка #${id}\nИмя: ${lead.name}\nКонтакт: ${lead.contact}\nОбъект: ${lead.space}\nГород: ${lead.city}\nЗадача: ${lead.description}\nБюджет: ${lead.budget||'Не указан'}\n\nОткройте защищённый журнал заявок AFARA.`})
    await p.db.pool.query("UPDATE leads SET delivery_status='sent',lease_until=NULL,lease_token=NULL,delivery_error=NULL WHERE id=$1 AND lease_token=$2",[id,token])
  }catch{
    await p.db.pool.query("UPDATE leads SET delivery_status=CASE WHEN attempts>=5 THEN 'failed'::enum_leads_delivery_status ELSE 'pending'::enum_leads_delivery_status END, retry_at=NOW()+INTERVAL '30 seconds'*POWER(2,attempts-1),lease_until=NULL,lease_token=NULL,delivery_error='SMTP delivery failed; check connection and recipient' WHERE id=$1 AND lease_token=$2",[id,token])
  }
  return true
}
