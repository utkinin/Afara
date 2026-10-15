import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { verifyAccess } from './lib/gateway'
export async function proxy(req:NextRequest){
  const p=req.nextUrl.pathname
  if(p.includes('create-first-user') || p.includes('first-register') || p.includes('init')&&p.startsWith('/api/users/'))return new NextResponse('Not found',{status:404})
  const publicAPI=p==='/api/inquiry'||p==='/api/health'||p.startsWith('/api/media/file/')&&req.method==='GET'
  if(process.env.AFARA_STAGE==='production' && (p.startsWith('/admin')||p.startsWith('/preview')||p.startsWith('/api/')&&!publicAPI) && !(await verifyAccess(req.headers))) {
    return new NextResponse('Administrative access requires a verified MFA gateway',{status:403,headers:{'Cache-Control':'no-store'}})
  }
  const nonce=randomBytes(16).toString('base64')
  const dev=process.env.NODE_ENV==='development'
  const csp=[`default-src 'self'`,`script-src 'self' 'nonce-${nonce}'${dev?" 'unsafe-eval'":''}`,`style-src 'self' 'unsafe-inline'`,"img-src 'self' blob: data:","font-src 'self'",`connect-src 'self'${dev?' ws:':''}`,"frame-ancestors 'self'","base-uri 'self'","form-action 'self'","object-src 'none'"].join('; ')
  const headers=new Headers(req.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp)
  const res=NextResponse.next({request:{headers}})
  res.headers.set('Content-Security-Policy',csp)
  if(process.env.AFARA_STAGE!=='production')res.headers.set('X-Robots-Tag','noindex, nofollow')
  if(p.startsWith('/api/')||p.startsWith('/admin')||p.startsWith('/preview'))res.headers.set('Cache-Control','private, no-store')
  return res
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|media/).*)']}
