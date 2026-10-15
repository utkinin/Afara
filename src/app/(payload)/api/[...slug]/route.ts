import config from '@payload-config'
import { REST_DELETE,REST_GET,REST_OPTIONS,REST_PATCH,REST_POST,REST_PUT } from '@payloadcms/next/routes'
const get=REST_GET(config)
export const GET:typeof get=async(req,args)=>{const response=await get(req,args);if(new URL(req.url).pathname.startsWith('/api/media/file/')&&response.ok&&!req.headers.has('cookie'))response.headers.set('Cache-Control','public, max-age=31536000, immutable');return response}
export const POST=REST_POST(config)
export const DELETE=REST_DELETE(config)
export const PATCH=REST_PATCH(config)
export const PUT=REST_PUT(config)
export const OPTIONS=REST_OPTIONS(config)
