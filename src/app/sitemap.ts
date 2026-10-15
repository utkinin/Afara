export const dynamic='force-dynamic'
import type { MetadataRoute } from 'next'
import {publicPages,pageURL} from '@/lib/content'
export default async function sitemap():Promise<MetadataRoute.Sitemap>{if(process.env.AFARA_STAGE!=='production')return [];return (await publicPages()).map(p=>({url:new URL(pageURL(p),process.env.APP_URL).toString(),lastModified:p.updatedAt}))}
