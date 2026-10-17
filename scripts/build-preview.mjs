import { chromium } from '@playwright/test'
import { mkdir, writeFile, cp, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { writeMaterialStudyPreview } from './material-study-preview.mjs'

const origin=process.env.PREVIEW_ORIGIN||'http://localhost:3000'
const base=process.env.PREVIEW_BASE||'/Afara'
const output=path.resolve(process.env.PREVIEW_OUTPUT||'/workspace/afara-preview/Afara')
if(!/^\/[a-zA-Z0-9_-]+$/.test(base))throw new Error('Use a single safe preview base path')
await mkdir(output,{recursive:true})
if((await readdir(output)).length)throw new Error('PREVIEW_OUTPUT must be a new empty directory; existing files are never overwritten')
await mkdir(path.join(output,'assets'),{recursive:true})
const mapping=new Map(),pending=new Map()
async function asset(input){
  if(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input)&&input.length<150000)return input
  const url=new URL(input,origin)
  if(url.origin!==new URL(origin).origin)throw new Error('Only public assets from the local application may be exported')
  if(!url.pathname.startsWith('/_next/static/')&&!url.pathname.startsWith('/api/media/file/'))throw new Error('Unexpected asset route '+url.pathname)
  if(mapping.has(url.href))return mapping.get(url.href)
  if(pending.has(url.href))return pending.get(url.href)
  const work=(async()=>{
    const ext=path.extname(url.pathname)||'.bin'
    const filename=createHash('sha256').update(url.pathname).digest('hex').slice(0,24)+ext
    const destination=`${base}/assets/${filename}`
    const response=await fetch(url)
    if(!response.ok)throw new Error(`Public asset unavailable: ${url.pathname} (${response.status})`)
    let content=Buffer.from(await response.arrayBuffer())
    if(ext==='.css'){
      let css=content.toString('utf8')
      const replacements=[]
      for(const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)){
        if(match[1].startsWith('data:'))continue
        replacements.push([match[0],`url("${await asset(new URL(match[1],url))}")`])
      }
      for(const [from,to] of replacements)css=css.replaceAll(from,to)
      content=Buffer.from(css)
    }
    await writeFile(path.join(output,'assets',filename),content)
    mapping.set(url.href,destination)
    return destination
  })()
  pending.set(url.href,work)
  try{return await work}finally{pending.delete(url.href)}
}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']})
let templates, hasMaterialStudy=false
const pages=new Set(['/'])
try{
  for(const pathname of pages){
    const page=await browser.newPage({viewport:{width:1440,height:1000}})
    const response=await page.goto(new URL(pathname,origin).href,{waitUntil:'networkidle'})
    if(response?.status()!==200)throw new Error(`Page unavailable: ${pathname}`)
    await page.evaluate(()=>document.fonts.ready)
    if(!templates){
      const step1=await page.locator('#consultation form').innerHTML()
      await page.getByLabel('Тип пространства').selectOption({index:1})
      await page.getByLabel('Город / страна').fill('Тестовый город')
      await page.getByLabel('Что вы хотите решить?').fill('Проверка интерфейса формы предпросмотра')
      await page.getByRole('button',{name:'Продолжить',exact:true}).click()
      const step2=await page.locator('#consultation form').innerHTML()
      templates={step1,step2}
      await page.reload({waitUntil:'networkidle'})
    }
    const links=await page.locator('a[href]').evaluateAll(elements=>elements.map(e=>e.getAttribute('href')))
    for(const href of links){
      if(!href||href.startsWith('#'))continue
      const url=new URL(href,origin)
      if(url.origin!==new URL(origin).origin)continue
      if(url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/')||url.pathname.startsWith('/preview'))throw new Error('Private route in preview navigation')
      pages.add(url.pathname)
    }
    const resources=await page.evaluate(()=>{
      const resources=[]
      for(const e of document.querySelectorAll('link[rel="stylesheet"]'))resources.push({tag:'link',attr:'href',value:e.getAttribute('href')})
      const roots=[document,...Array.from(document.querySelectorAll('template[data-ms-view]'),t=>t.content)]
      for(const root of roots){
        for(const e of root.querySelectorAll('img[src]'))resources.push({tag:'img',attr:'src',value:e.getAttribute('src')})
        for(const e of root.querySelectorAll('img[srcset],source[srcset]'))for(const part of e.getAttribute('srcset').split(','))resources.push({tag:e.tagName.toLowerCase(),attr:'srcset',value:part.trim().split(/\s+/)[0]})
      }
      return resources
    })
    hasMaterialStudy ||= await page.locator('[data-material-study]').count()>0
    for(const resource of resources)await asset(resource.value)
    const replacements=Object.fromEntries(mapping)
    await page.evaluate(({origin,base,replacements})=>{
      const convert=input=>input.startsWith('data:image/png;base64,')?input:replacements[new URL(input,origin).href]
      for(const e of document.querySelectorAll('[data-server-only],script,link[rel="preload"],link[rel="modulepreload"],link[rel="prefetch"],meta[http-equiv="Content-Security-Policy"],link[rel="canonical"],#next-route-announcer,#__next-route-announcer__'))e.remove()
      for(const e of document.querySelectorAll('link[rel="stylesheet"]'))e.setAttribute('href',convert(e.getAttribute('href')))
      const roots=[document,...Array.from(document.querySelectorAll('template[data-ms-view]'),t=>t.content)]
      for(const root of roots){
        for(const e of root.querySelectorAll('img[src]'))e.setAttribute('src',convert(e.getAttribute('src')))
        for(const e of root.querySelectorAll('img[srcset],source[srcset]'))e.setAttribute('srcset',e.getAttribute('srcset').split(',').map(part=>{const [url,size]=part.trim().split(/\s+/);return `${convert(url)} ${size||''}`}).join(', '))
      }
      for(const e of document.querySelectorAll('[data-material-study]'))e.removeAttribute('data-enhanced')
      for(const e of document.querySelectorAll('a[href]')){
        const href=e.getAttribute('href')
        if(href.startsWith('#'))continue
        const url=new URL(href,origin)
        if(url.origin===origin)e.setAttribute('href',base+url.pathname+url.search+url.hash)
      }
      let robots=document.querySelector('meta[name="robots"]')
      if(!robots){robots=document.createElement('meta');robots.setAttribute('name','robots');document.head.append(robots)}
      robots.setAttribute('content','noindex,nofollow,noarchive')
      const csp=document.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'";document.head.prepend(csp)
      const script=document.createElement('script');script.src=base+'/preview-controls.js';script.defer=true;document.head.append(script)
      if(document.querySelector('[data-material-study]')){const study=document.createElement('script');study.type='module';study.src=base+'/material-study-preview.js';document.head.append(study)}
      document.title='Предпросмотр · '+document.title
      const form=document.querySelector('#consultation form');if(form){form.dataset.preview='true';form.setAttribute('aria-label','Форма предпросмотра — отправка отключена')}
      const marker=document.createElement('p');marker.textContent='Статический предпросмотр AFARA · отправка заявок и консультант отключены';marker.style.cssText='font:12px sans-serif;text-align:center;padding:10px;margin:0;background:#4a2f3f;color:#f7f3ea';document.querySelector('footer')?.prepend(marker)
      for(const attr of document.querySelectorAll('[nonce]'))attr.removeAttribute('nonce')
    },{origin:new URL(origin).origin,base,replacements})
    const target=path.join(output,pathname.replace(/^\//,''),'index.html')
    await mkdir(path.dirname(target),{recursive:true})
    await writeFile(target,await page.content())
    console.log('Exported',pathname)
    await page.close()
  }
}finally{await browser.close()}
const controls=`'use strict';\nconst templates=${JSON.stringify(templates).replaceAll('<','\\u003c')};\n`+String.raw`
const openButton=document.querySelector('button[aria-label="Открыть меню"]');
const dialog=document.querySelector('dialog');
openButton?.addEventListener('click',()=>dialog.showModal());
dialog?.querySelector('button[aria-label="Закрыть меню"]')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('a'))dialog.close()});
const form=document.querySelector('form[data-preview]');
let step=1;const values={};
function remember(){for(const field of form.querySelectorAll('input,textarea,select'))if(field.id||field.closest('label')){const label=field.closest('label')?.childNodes[0]?.textContent||field.id;values[label]=field.type==='checkbox'?field.checked:field.value}}
function render(next){remember();step=next;form.innerHTML=templates[step===1?'step1':'step2'];for(const field of form.querySelectorAll('input,textarea,select')){const label=field.closest('label')?.childNodes[0]?.textContent||field.id;if(label in values){if(field.type==='checkbox')field.checked=values[label];else field.value=values[label]}}if(step===2){const submit=form.querySelector('button[type="submit"]');submit.disabled=true;const contact=form.querySelector('input[type="tel"],input[type="email"]');const channel=form.querySelector('select');channel?.addEventListener('change',()=>{contact.type=channel.value==='email'?'email':'tel';contact.autocomplete=contact.type;contact.closest('label').childNodes[0].textContent=channel.value==='email'?'Email':'Телефон';contact.value=''})}form.querySelector('input,select,textarea')?.focus()}
form?.addEventListener('submit',e=>{e.preventDefault();if(step===1&&form.reportValidity())render(2)});
form?.addEventListener('click',e=>{const button=e.target.closest('button');if(step===2&&button?.type==='button')render(1)});
window.addEventListener('afara:question',e=>{
 if(!form||typeof e.detail!=='string'||e.detail.length>500)return;
 if(step===2)render(1);
 const textarea=form.querySelector('textarea');
 if(textarea&&!textarea.value.trim()){textarea.value=e.detail;remember()}
 textarea?.focus();
});
for(const container of document.querySelectorAll('[data-save-idea]'))container.querySelector('button')?.addEventListener('click',async()=>{
 const url=new URL(location.href);url.search='';url.hash=container.dataset.saveIdea;
 const status=container.querySelector('[role="status"]');
 try{await navigator.clipboard.writeText(url.href);status.textContent='Ссылка скопирована'}
 catch{status.textContent='Скопируйте ссылку из поля';let input=container.querySelector('input');if(!input){const label=document.createElement('label');label.textContent='Ссылка на идею';input=document.createElement('input');input.readOnly=true;label.append(input);container.append(label)}input.value=url.href;input.focus();input.select()}
});

`
await writeFile(path.join(output,'preview-controls.js'),controls)
if(hasMaterialStudy)await writeMaterialStudyPreview(output)
await writeFile(path.join(output,'.nojekyll'),'')
await writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n')
// Keep the URL used by the earlier standalone preview. GitHub Pages has no
// server redirects; this same-origin HTML transition is not a 302 short link.
if(pages.has('/partneram/')){
 const target=base+'/partneram/'
 await mkdir(path.join(output,'partnyoram'),{recursive:true})
 await writeFile(path.join(output,'partnyoram','index.html'),`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0;url=${target}"><title>Партнёрам — AFARA</title></head><body><p>Страница обновлена: <a href="${target}">Партнёрам — AFARA</a></p></body></html>`)
}
await mkdir(path.join(output,'licenses'),{recursive:true})
for(const name of ['cormorant-garamond','manrope']){
 const folder=path.join('node_modules','@fontsource-variable',name)
 await cp(path.join(folder,'LICENSE'),path.join(output,'licenses',name+'.txt'))
}
await writeFile(path.join(output,'PREVIEW.md'),'# AFARA preview\n\nGenerated public review copy. CMS, private APIs and lead submission are excluded. No tracking or external requests. Images are illustrative concepts, not completed work. Source: utkinin/Afara. Font licenses in licenses/. The previous /partnyoram/ URL uses a static HTML transition to /partneram/; it is not a server 302.\n')
console.log('Preview generated:',pages.size,'pages,',mapping.size,'public assets at',output)
