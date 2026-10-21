import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.AFARA_STATIC_TEST_ORIGIN;
if (!origin?.startsWith('http://localhost:')) throw new Error('Use the isolated static acceptance server');

test('AFARA static launch: responsive pages, Telegram, material draft, navigation and QR', async () => {
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({url:request.url(), method:request.method()}));
    await page.context().route('https://t.me/**', route => route.fulfill({contentType:'text/html', body:'Telegram handoff test'}));
    await fs.mkdir('/tmp/afara-static-screenshots', {recursive:true});
    for (const width of [360,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      for (const path of ['/', '/kontakty/', '/ukhod-za-shtorami/', '/obshchestvennye-prostranstva/shkoly-i-detskie-sady/']) {
        assert.equal((await page.goto(origin + path, {waitUntil:'networkidle'})).status(), 200);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('form').count(), 0);
        assert.ok(await page.locator('a[href^="https://t.me/Ilya_Utkin"]').count());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width} ${path}`);
        if (width===390 && path==='/') {
          await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
          assert.ok(await page.locator('dialog[open]').count());
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('dialog[open]').count(),0);
          assert.equal(await page.getByRole('button',{name:'Открыть меню',exact:true}).evaluate(el=>el===document.activeElement),true);
          await page.locator('#consultation').scrollIntoViewIfNeeded();
          await page.screenshot({path:'/tmp/afara-static-screenshots/contact-390.png'});
        }
        if(width===1440 && path==='/') await page.screenshot({path:'/tmp/afara-static-screenshots/home-1440.png'});
        if(width===390 && path.includes('shkoly')) {
          await page.locator('#visual-collection').scrollIntoViewIfNeeded();
          await page.waitForFunction(() => [...document.querySelectorAll('#visual-collection img')].every(img=>img.complete&&img.naturalWidth>0));
          await page.screenshot({path:'/tmp/afara-static-screenshots/education-390.png'});
        }
      }
    }
    await page.goto(origin+'/',{waitUntil:'networkidle'});
    await page.locator('[data-material-study]').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-material-study][data-enhanced]');
    await page.locator('[data-ms-select="1"]').click();
    await page.locator('[data-ms-transfer]').click();
    await page.waitForFunction(() => document.querySelector('[data-contact-brief]').textContent.includes('свет'));
    const draft = new URL(await page.locator('[data-contact-primary]').getAttribute('href'));
    assert.equal(draft.hostname,'t.me');
    assert.equal(draft.pathname,'/Ilya_Utkin');
    assert.ok(draft.searchParams.get('text').includes('https://afara.ru/'));
    await page.locator('[data-contact-primary]').click();
    assert.ok(page.url().startsWith('https://t.me/Ilya_Utkin'));
    await page.goto(origin+'/',{waitUntil:'networkidle'});
    const idea=page.locator('[data-save-idea]').first();
    await idea.locator('button').click();
    assert.ok(await idea.locator('[role="status"]').textContent());
    const fallback=idea.locator('input');
    if(await fallback.count()) assert.ok((await fallback.inputValue()).startsWith('https://afara.ru/#'));
    assert.deepEqual(errors,[]);
    assert.equal(requests.some(r=>r.method!=='GET'),false);
    assert.equal(requests.some(r=>!r.url.startsWith(origin)&&!r.url.startsWith('data:')&&!r.url.startsWith('https://t.me/Ilya_Utkin')),false);
    assert.equal(await page.evaluate(()=>document.cookie),'');
  } finally {await browser.close();}
});
