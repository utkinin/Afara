import { createRemoteJWKSet, jwtVerify } from 'jose'
let keys: ReturnType<typeof createRemoteJWKSet> | undefined
export async function verifyAccess(headers: Headers): Promise<{email:string}|null> {
  const host=process.env.ACCESS_TEAM_DOMAIN
  const audience=process.env.ACCESS_AUDIENCE
  const token=headers.get('cf-access-jwt-assertion')
  if(!host||!audience||!token||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(host))return null
  try{
    keys ||= createRemoteJWKSet(new URL(`https://${host}/cdn-cgi/access/certs`))
    const {payload}=await jwtVerify(token,keys,{issuer:`https://${host}`,audience,algorithms:['RS256']})
    return typeof payload.email==='string'?{email:payload.email}:null
  }catch{return null}
}
