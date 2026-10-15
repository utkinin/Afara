import { cms } from '@/lib/payload'
export async function GET(){try{const p=await cms();await p.db.pool.query("SELECT 1",[]);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
