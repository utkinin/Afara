import { setTimeout } from 'node:timers/promises'
import { processNotification } from '../src/lib/notifications'
import { cms } from '../src/lib/payload'
let stop=false
process.on('SIGTERM',()=>{stop=true});process.on('SIGINT',()=>{stop=true})
const p=await cms()
while(!stop){
  try{await processNotification();await p.db.pool.query('DELETE FROM rate_limits WHERE expires_at<NOW()')}
  catch{console.error('notification_worker_failed')}
  if(!stop)await setTimeout(5000)
}
await p.destroy()

process.exit(0)
