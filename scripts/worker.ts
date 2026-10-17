import { setTimeout } from 'node:timers/promises'
import { processNotification } from '../src/lib/notifications'
import { cms } from '../src/lib/payload'
import { eraseAnalytics } from '../src/lib/analytics-server'
let stop=false
let cleanedAt=0
process.on('SIGTERM',()=>{stop=true});process.on('SIGINT',()=>{stop=true})
const p=await cms()
while(!stop){
  try{await processNotification();await p.db.pool.query('DELETE FROM rate_limits WHERE expires_at<NOW()');if(Date.now()-cleanedAt>3600000){await eraseAnalytics(p);cleanedAt=Date.now()}}
  catch{console.error('notification_worker_failed')}
  if(!stop)await setTimeout(5000)
}
await p.destroy()

process.exit(0)
