export const dynamic='force-dynamic'
import type { MetadataRoute } from 'next'
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:process.env.AFARA_STAGE==='production'?'/':undefined,disallow:process.env.AFARA_STAGE==='production'?['/admin','/api','/preview']:['/']},sitemap:process.env.AFARA_STAGE==='production'?`${process.env.APP_URL}/sitemap.xml`:undefined}}
