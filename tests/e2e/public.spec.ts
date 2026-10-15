import { test,expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('public pages, responsive layout, menu and honest form state',async({page})=>{
  await mkdir('docs/screenshots',{recursive:true})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  for(const [width,height] of [[1440,1000],[1024,900],[768,1024],[390,844],[360,640],[320,700]]){
    await page.setViewportSize({width,height});await page.goto('/');await expect(page.locator('h1')).toHaveText('Сложные портьеры по индивидуальному проекту')
    await page.locator('h1').evaluate(()=>document.fonts.ready)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(width===360||width===390){const cta=await page.locator('main section').first().getByRole('link',{name:'Обсудить проект'}).boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(height)}
    if([1440,768,390].includes(width))await page.screenshot({path:`docs/screenshots/home-${width}.png`,fullPage:true})
  }
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('button',{name:'Открыть меню'}).click();await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({path:'docs/screenshots/menu-390.png',fullPage:true})
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Открыть меню'})).toBeFocused()
  await page.getByLabel('Тип пространства').selectOption('Частная резиденция');await page.getByLabel('Город / страна').fill('Санкт-Петербург');await page.getByLabel('Что вы хотите решить?').fill('Второй свет, моторизация и многослойные портьеры')
  await page.getByRole('button',{name:'Продолжить'}).click();await expect(page.getByLabel('Ваше имя')).toBeFocused()
  await expect(page.getByRole('button',{name:'Отправить заявку'})).toBeDisabled()
  await page.screenshot({path:'docs/screenshots/form-step2-390.png',fullPage:true})
  await page.getByRole('button',{name:'Назад',exact:false}).click();await expect(page.getByLabel('Город / страна')).toHaveValue('Санкт-Петербург')
  for(const path of ['/chastnye-interery/','/chastnye-interery/zagorodnye-doma/','/obshchestvennye-prostranstva/oteli/']){const response=await page.goto(path);expect(response?.status()).toBe(200);await expect(page.locator('h1')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
  expect((await page.goto('/not-existing/'))?.status()).toBe(404)
  expect(errors).toEqual([])
})

test('anonymous access is closed for leads, settings, preview and bootstrap',async({request})=>{
  for(const url of ['/api/leads','/api/audit','/api/globals/notifications','/api/globals/site?draft=true'])expect((await request.get(url)).status()).toBeGreaterThanOrEqual(400)
  expect((await request.get('/preview?page=1')).status()).toBe(404)
  expect((await request.post('/api/users/first-register',{data:{email:'bad@example.test',password:'unwanted'}})).status()).toBeGreaterThanOrEqual(400)
  expect((await request.post('/api/inquiry',{data:{}})).status()).toBe(403)
})
