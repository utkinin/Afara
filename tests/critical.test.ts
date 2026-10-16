import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { randomUUID,randomBytes } from 'node:crypto'
import { chromium } from '@playwright/test'
import { cms } from '../src/lib/payload'
import { processNotification } from '../src/lib/notifications'
import { inquirySchema,csvCell } from '../src/lib/inquiry-schema'

const testOrigin=process.env.APP_URL||'http://localhost:3000'
test('validation rejects mass assignment and invalid contacts; CSV neutralizes formulas',()=>{
  assert.equal(inquirySchema.safeParse({status:'closed'}).success,false)
  for(const input of ['=1+1','  +SUM(A1)','@cmd','-1+1'])assert.match(csvCell(input),/^"'/)
  assert.equal(csvCell('hello "AFARA"'),'"hello ""AFARA"""')
})

test('real PostgreSQL: roles, drafts, private media, transactional inquiry and SMTP outbox',async()=>{
  assert.equal(process.env.AFARA_STAGE,'development','This test must never run against production')
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /_acceptance$/, 'Only an isolated acceptance database may be used')
  const p=await cms(),tag=randomUUID(),password=randomBytes(24).toString('base64url')
  const admin=await p.create({collection:'users',data:{email:`qa-admin-${tag}@example.test`,password,role:'ADMIN'}})
  const editor=await p.create({collection:'users',data:{email:`qa-editor-${tag}@example.test`,password,role:'EDITOR'}})
  const user={...editor,collection:'users' as const},owner={...admin,collection:'users' as const}
  const created:{collection:'pages'|'documents'|'leads',id:number}[]=[]
  let privateMediaId:number|undefined
  try{
    await assert.rejects(()=>p.find({collection:'leads',user,overrideAccess:false}))
    await assert.rejects(()=>p.update({collection:'users',id:editor.id,data:{role:'ADMIN'},user,overrideAccess:false}))
    const page=await p.create({collection:'pages',user,overrideAccess:false,data:{title:`QA ${tag}`,path:`qa-${tag}`,type:'direction',intro:'Содержательное описание синтетической страницы для проверки публикации.',serviceConfirmed:true,h1:'Проверяемый черновик',cta:'Обсудить проект',_status:'draft'}})
    created.push({collection:'pages',id:page.id})
    assert.equal((await p.find({collection:'pages',where:{id:{equals:page.id}},overrideAccess:false})).totalDocs,0)
    await assert.rejects(()=>p.update({collection:'pages',id:page.id,data:{_status:'published'},user,overrideAccess:false}))
    await p.update({collection:'pages',id:page.id,data:{serviceConfirmed:true,_status:'published'},user:owner,overrideAccess:false})
    assert.equal((await p.findByID({collection:'pages',id:page.id,overrideAccess:false})).h1,'Проверяемый черновик')
    await assert.rejects(()=>p.update({collection:'pages',id:page.id,data:{h1:'Попытка изменения без draft'},user,overrideAccess:false}))
    await p.update({collection:'pages',id:page.id,draft:true,data:{h1:'Непубличное изменение',_status:'draft'},user,overrideAccess:false})
    assert.equal((await p.findByID({collection:'pages',id:page.id,overrideAccess:false})).h1,'Проверяемый черновик')
    assert.equal((await p.findByID({collection:'pages',id:page.id,draft:true,user,overrideAccess:false})).h1,'Непубличное изменение')
    const image=await p.create({collection:'media',draft:true,user,overrideAccess:false,filePath:'fixtures/afara-ai-concept.png',data:{alt:'Тест приватного изображения',origin:'ai',source:'Synthetic test',rightsConfirmed:true,_status:'draft'}})
    privateMediaId=image.id
    const file=await fetch(new URL(image.url!, testOrigin));assert.ok(file.status===403||file.status===404,`private media returned ${file.status}; status=${image._status}`)
    await assert.rejects(()=>p.create({collection:'media',user,overrideAccess:false,file:{data:Buffer.from('<script>bad()</script>'),mimetype:'image/png',name:'broken.png',size:22},data:{alt:'Bad',origin:'concept',source:'test',rightsConfirmed:false}}))
    for(const kind of ['consent','privacy'] as const){const d=await p.create({collection:'documents',data:{title:`ТЕСТОВЫЙ ${kind}`,slug:`qa-${kind}-${tag}`,body:'СИНТЕТИЧЕСКИЙ ДОКУМЕНТ ТЕСТА. Не юридический документ AFARA.',kind,version:tag,_status:'published'}});created.push({collection:'documents',id:d.id})}
    const key=randomUUID(),input={space:'Частная резиденция',city:'Test city',description:'Synthetic functional inquiry for database and SMTP verification.',budget:'',name:'Synthetic QA',channel:'email',contact:'qa@example.test',consent:true,consentVersion:tag,source:'home',website:''}
    const send=(body:unknown=input,k=key)=>fetch(testOrigin+'/api/inquiry',{method:'POST',headers:{origin:testOrigin,'Content-Type':'application/json','Idempotency-Key':k},body:JSON.stringify(body)})
    const first=await send();assert.equal(first.status,201,await first.text())
    assert.equal((await send()).status,200)
    assert.equal((await send({...input,name:'Different'})).status,409)
    assert.equal((await send({...input,status:'closed'},randomUUID())).status,400)
    const leads=await p.find({collection:'leads',where:{idempotencyKey:{equals:key}}});assert.equal(leads.totalDocs,1)
    const lead=leads.docs[0];created.push({collection:'leads',id:lead.id})
    assert.equal(lead.deliveryStatus,'pending');assert.match(lead.consentText,/СИНТЕТИЧЕСКИЙ/)
    const runActualWorker=async()=>{
      const worker=spawn(process.execPath,['--import','tsx','--env-file-if-exists=.env.local','scripts/worker.ts'],{stdio:'ignore'})
      const stopped=new Promise<void>((resolve,reject)=>{worker.on('error',reject);worker.on('exit',code=>code===0?resolve():reject(new Error('worker exited '+code)))})
      try{
        let sent=false
        for(let attempt=0;attempt<60;attempt++){if((await p.findByID({collection:'leads',id:lead.id})).deliveryStatus==='sent'){sent=true;break}await setTimeout(250)}
        assert.ok(sent,'Actual worker process delivered the persisted outbox job')
      }finally{worker.kill('SIGTERM');await Promise.race([stopped,setTimeout(10000).then(()=>{worker.kill('SIGKILL');throw new Error('Worker did not stop gracefully')})])}
    }
    await runActualWorker()
    assert.equal((await p.findByID({collection:'leads',id:lead.id})).deliveryStatus,'sent')
    await p.db.pool.query("UPDATE leads SET delivery_status='processing',attempts=1,lease_until=NOW()-INTERVAL '5 minutes',lease_token='interrupted-worker' WHERE id=$1",[lead.id])
    await runActualWorker()
    assert.equal((await p.findByID({collection:'leads',id:lead.id})).attempts,2)

    const messages=await (await fetch('http://localhost:8025/api/v1/messages')).json()
    assert.ok(messages.messages.some((m:{Subject:string})=>m.Subject===`AFARA — новая заявка #${lead.id}`),'Mailpit received the actual SMTP message')
    // Concurrent claims cannot both send the same row.
    await p.db.pool.query("UPDATE leads SET delivery_status='pending',attempts=0,retry_at=NOW() WHERE id=$1",[lead.id])
    await Promise.all([processNotification(),processNotification()])
    assert.equal((await p.findByID({collection:'leads',id:lead.id})).attempts,1)
    const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']})
    try{
      const context=await browser.newContext({viewport:{width:390,height:844}}),screen=await context.newPage()
      screen.setDefaultNavigationTimeout(60000)
      await screen.goto(testOrigin+'/admin/login')
      await screen.locator('input[name=email]').fill(admin.email)
      await screen.locator('input[name=password]').fill(password)
      await screen.locator('button[type=submit]').click()
      await screen.waitForURL(url=>url.pathname==='/admin',{timeout:45000})
      await screen.goto(`${testOrigin}/admin/collections/pages/${page.id}`)
      await screen.locator('input[name=h1]').fill('Изменено через браузер')
      const saved=screen.waitForResponse(r=>r.url().includes(`/api/pages/${page.id}`)&&r.request().method()==='PATCH')
      await screen.getByRole('button',{name:'Сохранить черновик',exact:true}).click()
      assert.ok((await saved).ok())
      await screen.waitForFunction(()=>!document.querySelector('input[name=h1]')?.hasAttribute('disabled'))
      await screen.screenshot({path:'docs/screenshots/admin-editor-390.png',fullPage:true})
      await screen.goto(`${testOrigin}/preview?page=${page.id}`)
      assert.equal(await screen.locator('h1').textContent(),'Изменено через браузер')
      await screen.screenshot({path:'docs/screenshots/preview-390.png',fullPage:true})
      await screen.goto(testOrigin+'/')
      await screen.getByLabel('Тип пространства').selectOption('Частная резиденция')
      await screen.getByLabel('Город / страна').fill('QA city')
      await screen.getByLabel('Что вы хотите решить?').fill('Synthetic browser form smoke test')
      await screen.locator('#consultation').screenshot({path:'docs/screenshots/form-step1-390.png'})
      await screen.getByRole('button',{name:'Продолжить',exact:true}).click()
      await screen.getByLabel('Ваше имя').fill('Synthetic browser QA')
      await screen.getByLabel('Удобный способ связи').selectOption('email')
      const browserContact=`qa-browser-${tag}@example.test`
      await screen.getByLabel('Email',{exact:true}).fill(browserContact)
      await screen.locator('input[type=checkbox]').check()
      await screen.route('**/api/inquiry',route=>route.abort('failed'))
      await screen.getByRole('button',{name:'Отправить заявку',exact:true}).click()
      await screen.locator('#consultation').getByRole('alert').waitFor()
      await screen.locator('#consultation').screenshot({path:'docs/screenshots/form-error-390.png'})
      await screen.unroute('**/api/inquiry')
      await screen.getByRole('button',{name:'Отправить заявку',exact:true}).click()
      await screen.getByRole('heading',{name:'Спасибо. Ваша заявка сохранена.'}).waitFor()
      const browserLeads=await p.find({collection:'leads',where:{contact:{equals:browserContact}},depth:0})
      assert.equal(browserLeads.totalDocs,1)
      created.push({collection:'leads',id:browserLeads.docs[0].id})
      await screen.locator('#consultation').screenshot({path:'docs/screenshots/form-success-390.png'})
      await p.delete({collection:'leads',id:browserLeads.docs[0].id});created.pop()
      for(const width of [390,1440]){
        await screen.setViewportSize({width,height:900})
        await screen.goto(testOrigin+'/admin/collections/media')
        await screen.screenshot({path:`docs/screenshots/admin-media-${width}.png`,fullPage:true})
        await screen.goto(testOrigin+'/admin/collections/leads')
        await screen.screenshot({path:`docs/screenshots/admin-leads-${width}.png`,fullPage:true})
      }
    }finally{await browser.close()}
    await p.update({collection:'pages',id:page.id,data:{path:`qa-renamed-${tag}`,_status:'published'},user:owner,overrideAccess:false})
    const redirected=await fetch(`${testOrigin}/qa-${tag}/`,{redirect:'manual'})
    assert.equal(redirected.status,308);assert.match(redirected.headers.get('location')||'',/qa-renamed-/)
    await p.update({collection:'leads',id:lead.id,data:{archived:true},user:owner,overrideAccess:false})
    assert.equal((await p.findByID({collection:'leads',id:lead.id})).archived,true)
    // SMTP failure is durable, keeps the lead, and schedules a retry.
    const oldHost=process.env.SMTP_HOST;process.env.SMTP_HOST='invalid.example.test'
    await p.db.pool.query("UPDATE leads SET delivery_status='pending',attempts=0,retry_at=NOW() WHERE id=$1",[lead.id])
    await processNotification();process.env.SMTP_HOST=oldHost
    const failed=await p.findByID({collection:'leads',id:lead.id});assert.equal(failed.deliveryStatus,'pending');assert.equal(failed.attempts,1);assert.ok(failed.deliveryError)
  }finally{
    const aliases=await p.find({collection:'redirects',where:{from:{equals:`qa-${tag}`}},depth:0})
    for(const alias of aliases.docs)await p.delete({collection:'redirects',id:alias.id})
    for(const d of created.reverse())await p.delete({collection:d.collection,id:d.id})
    // Media deletion intentionally disallowed in the application; synthetic fixture is purged directly in this test environment.
    if(privateMediaId)await p.db.pool.query('DELETE FROM media WHERE id=$1',[privateMediaId])
    await p.delete({collection:'users',id:editor.id});await p.delete({collection:'users',id:admin.id})
    await p.destroy()
  }
})
