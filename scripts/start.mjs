import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const root=process.cwd(),standalone=path.join(root,'.next/standalone')
if(!existsSync(path.join(standalone,'server.js')))throw new Error('Сначала выполните npm run build')
cpSync(path.join(root,'.next/static'),path.join(standalone,'.next/static'),{recursive:true})
if(existsSync(path.join(root,'public')))cpSync(path.join(root,'public'),path.join(standalone,'public'),{recursive:true})
process.env.MEDIA_DIR=path.resolve(root,process.env.MEDIA_DIR||'media')
process.env.HOSTNAME='0.0.0.0'
await import(pathToFileURL(path.join(standalone,'server.js')).href)
