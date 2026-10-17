import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const origin=process.env.MATERIAL_STUDY_TEST_ORIGIN||'http://localhost:3110'
const base=process.env.MATERIAL_STUDY_BASE??'/Afara'

test('fabric study is responsive, defers extra images, supports keyboard and preserves the inquiry',async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']})
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}})
    const requests=[],errors=[]
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}))
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(origin+base+'/',{waitUntil:'networkidle'})
    assert.equal(requests.some(r=>/(warm|detail)-(480|960|1536)\.webp/.test(r.url)),false,'inactive pictures must not load')
    const study=page.locator('[data-material-study]')
    for(const width of[360,390,768,1440]){
      await page.setViewportSize({width,height:900})
      await study.scrollIntoViewIfNeeded()
      await page.waitForFunction(()=>document.querySelector('[data-material-study]')?.dataset.enhanced==='true')
      await page.waitForFunction(()=>{const i=document.querySelector('[data-ms-frame] img');return i?.complete&&i.naturalWidth>0})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      assert.equal(await study.locator('[data-ms-frame] img').evaluate(i=>i.complete&&i.naturalWidth>0),true)
    }
    await study.getByRole('button',{name:'Тёплый свет',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('[data-ms-caption]')?.textContent.includes('вечернем освещении'))
    assert.equal(await study.getByRole('button',{name:'Тёплый свет',exact:true}).getAttribute('aria-pressed'),'true')
    await study.getByRole('button',{name:'Фактура',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('[data-ms-caption]')?.textContent.includes('Крупный план'))
    await study.getByRole('slider',{name:'Коэффициент сборки'}).focus()
    await page.keyboard.press('End')
    assert.equal(await study.locator('[data-ms-output]').textContent(),'2,0')
    await study.getByLabel('Слои у окна',{exact:true}).selectOption('1')
    await study.getByRole('button',{name:'Увеличить изображение ткани',exact:true}).click()
    assert.equal(await study.locator('dialog').evaluate(d=>d.open),true)
    await page.keyboard.press('Escape')
    assert.equal(await study.locator('dialog').evaluate(d=>d.open),false)
    assert.equal(await study.getByRole('button',{name:'Увеличить изображение ткани',exact:true}).evaluate(e=>e===document.activeElement),true)
    await study.getByRole('link',{name:'Обсудить образцы и решение',exact:true}).click()
    const description=page.locator('#consultation textarea')
    await page.waitForFunction(()=>document.querySelector('#consultation textarea')?.value.includes('2,0; слоёв: 1'))
    assert.match(await description.inputValue(),/2,0; слоёв: 1/)
    await description.fill('Моё сохранённое описание проекта')
    await study.scrollIntoViewIfNeeded()
    await study.getByRole('link',{name:'Обсудить образцы и решение',exact:true}).click()
    assert.equal(await description.inputValue(),'Моё сохранённое описание проекта')
    await page.getByLabel('Тип пространства').selectOption({index:1})
    await page.getByLabel('Город / страна').fill('Санкт-Петербург')
    await page.getByRole('button',{name:'Продолжить',exact:true}).click()
    await page.getByLabel('Ваше имя').waitFor()
    await study.scrollIntoViewIfNeeded()
    await study.getByRole('link',{name:'Обсудить образцы и решение',exact:true}).click()
    await description.waitFor()
    assert.equal(await description.inputValue(),'Моё сохранённое описание проекта')
    await page.emulateMedia({reducedMotion:'reduce'})
    await study.scrollIntoViewIfNeeded()
    await study.getByRole('button',{name:'Нейтральный свет',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('[data-ms-frame]')?.getAttribute('aria-busy')==='false')
    assert.equal(await study.evaluate(el=>el.getAnimations({subtree:true}).length),0)
    assert.equal(requests.some(r=>r.method==='POST'),false)
    assert.deepEqual(errors,[])
    assert.ok(requests.every(r=>new URL(r.url).origin===origin))
  }finally{await browser.close()}
})
