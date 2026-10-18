import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
const origin=process.env.PREVIEW_TEST_ORIGIN||'http://localhost:3100'
const base=process.env.PREVIEW_BASE||'/Afara'
test('static preview has real pages, local assets, keyboard menu and readonly form',async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']})
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),external=[],errors=[]
  const menu=page.locator('dialog').filter({has:page.locator('button[aria-label="Закрыть меню"]')})
  page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url())})
  page.on('pageerror',e=>errors.push(e.message))
  let response=await page.goto(origin+base+'/',{waitUntil:'networkidle'})
  assert.equal(response.status(),200);assert.match(await page.locator('h1').textContent(),/Сложные портьеры/)
  assert.equal(await page.getByRole('button',{name:'Задать вопрос',exact:true}).count(),0)
  const routes=[...new Set(await page.locator('a[href]').evaluateAll((elements,prefix)=>elements.map(e=>new URL(e.href).pathname).filter(p=>p.startsWith(prefix+'/')),base))]
  assert.ok(routes.includes(base+'/kontakty/'));assert.ok(routes.includes(base+'/chastnye-yahty/'))
  assert.equal(await page.locator('main img').first().evaluate(e=>e.complete&&e.naturalWidth>0),true)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.getByRole('button',{name:'Открыть меню'}).click()
  assert.equal(await menu.evaluate(e=>e.open),true)
  await page.keyboard.press('Escape')
  assert.equal(await menu.evaluate(e=>e.open),false)
  await page.getByLabel('Тип пространства').selectOption({index:1})
  await page.getByLabel('Город / страна').fill('Санкт-Петербург')
  await page.getByLabel('Что вы хотите решить?').fill('Проверка предпросмотра сайта AFARA')
  await page.getByRole('button',{name:'Продолжить',exact:true}).click()
  await page.getByLabel('Ваше имя').waitFor()
  assert.equal(await page.getByRole('button',{name:'Отправить заявку',exact:true}).isDisabled(),true)
  await page.getByLabel('Удобный способ связи').selectOption('email')
  assert.equal(await page.locator('input[type=email]').count(),1)
  await page.getByRole('button',{name:'Назад',exact:false}).click()
  assert.equal(await page.getByLabel('Город / страна').inputValue(),'Санкт-Петербург')
  if(await page.locator('#your-task').count()){
   const choice=page.locator('#your-task a[data-inquiry-brief]').first()
   await page.getByLabel('Что вы хотите решить?').fill('')
   await choice.click()
   assert.match(await page.getByLabel('Что вы хотите решить?').inputValue(),/Хочу обсудить:/)
   await page.getByLabel('Что вы хотите решить?').fill('Моя сохранённая задача')
   await choice.click()
   assert.equal(await page.getByLabel('Что вы хотите решить?').inputValue(),'Моя сохранённая задача')
  }
  await page.getByRole('button',{name:'Открыть меню'}).click()
  await menu.getByRole('link',{name:'Все частные интерьеры'}).click()
  await page.waitForURL(origin+base+'/chastnye-interery/')
  assert.match(await page.locator('h1').textContent(),/частных интерьеров/)
  for(const pathname of routes){
   response=await page.goto(origin+pathname);assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,pathname)
   if(await page.locator('[data-save-idea]').count()){
    await page.context().grantPermissions(['clipboard-read','clipboard-write'])
    await page.getByRole('button',{name:'Сохранить идею',exact:true}).first().click()
    await page.waitForFunction(()=>document.querySelector('[data-save-idea] [role="status"]')?.textContent==='Ссылка скопирована')
    const copied=await page.evaluate(()=>navigator.clipboard.readText())
    assert.ok(copied.startsWith(origin+base+'/'));assert.ok(new URL(copied).hash.startsWith('#idea-'))
   }
  }
  for(const pathname of ['admin/','api/leads/','api/consultant/','s/yahta/','preview/'])assert.equal((await page.request.get(origin+base+'/'+pathname)).status(),404)
  if(routes.includes(base+'/partneram/')){
   await page.goto(origin+base+'/partnyoram/');await page.waitForURL(origin+base+'/partneram/')
   assert.equal(await page.locator('h1').count(),1)
   assert.equal(await page.locator('summary').filter({hasText:'Нужен ли готовый дизайн-проект для первого обращения?'}).count(),1)
  }
  assert.deepEqual(external,[]);assert.deepEqual(errors,[])
 }finally{await browser.close()}
})
