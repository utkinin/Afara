import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'

// Reproducible editorial update of the last published, read-only preview.
// This does not claim to have applied a content import to the owner's CMS.
const input = path.resolve(process.env.AFARA_CARE_PREVIEW_INPUT || '')
const output = path.resolve(process.env.AFARA_CARE_PREVIEW_OUTPUT || '')
if (!process.env.AFARA_CARE_PREVIEW_INPUT || !process.env.AFARA_CARE_PREVIEW_OUTPUT || input === output) throw new Error('Use separate explicit input and new output directories')
try { if ((await fs.readdir(output)).length) throw new Error('Output must be empty') } catch (error) { if (error.code !== 'ENOENT') throw error }
await fs.cp(input, output, { recursive: true, errorOnExist: true, force: false })
const base = '/Afara'
const copy = JSON.parse(await fs.readFile('content/care-service.json', 'utf8'))
const manifest = JSON.parse(await fs.readFile('fixtures/care-education/manifest.json', 'utf8'))
for (const image of manifest.images) for (const variant of ['desktop', 'mobile', 'thumb']) {
  const bytes = await fs.readFile(path.join('fixtures/care-education', image[variant].file))
  if (createHash('sha256').update(bytes).digest('hex') !== image[variant].sha256) throw new Error('Image fixture hash mismatch')
  await fs.copyFile(path.join('fixtures/care-education', image[variant].file), path.join(output, 'assets', image[variant].file))
}
const schoolRoute = 'obshchestvennye-prostranstva/shkoly-i-detskie-sady'
const homeHTML = await fs.readFile(path.join(input, 'index.html'), 'utf8')
const schoolHTML = await fs.readFile(path.join(input, schoolRoute, 'index.html'), 'utf8')
const templateHTML = await fs.readFile(path.join(input, 'partneram/index.html'), 'utf8')
const styles = [...new Set([...homeHTML.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)))]
const classes = Object.fromEntries(['section','container','sectionIntro','sectionBody','kicker','cards','spaces','process','processNumber','card','cardImage','cardText','arrowLink','faq'].map(stem => {
  const name = styles.find(v => v.startsWith(`site_${stem}__`)); if (!name) throw new Error(`Missing existing style ${stem}`); return [stem, name]
}))
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] })
const files = []
async function visit(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) await visit(file); else if (entry.name === 'index.html') files.push(path.relative(output, file)) } }
await visit(output)
files.push(`${copy.path}/index.html`)
try {
  const helper = await browser.newPage()
  await helper.route('**/*', route => route.abort())
  await helper.setContent(schoolHTML, { waitUntil: 'domcontentloaded' })
  const oldSchoolURLs = await helper.locator('[class*="site_heroImage__"] picture').evaluate(picture => [...picture.querySelectorAll('img,source')].flatMap(el => [el.getAttribute('src'), ...(el.getAttribute('srcset') || '').split(',').map(v => v.trim().split(/\s+/)[0])]).filter(Boolean))
  if (!oldSchoolURLs.length) throw new Error('Published school hero not found')
  await helper.setContent(homeHTML, { waitUntil: 'domcontentloaded' })
  const macroPicture = await helper.locator('#details picture').last().evaluate(el => el.outerHTML)
  await helper.close()
  let replacements = 0
  for (const relative of files) {
    const isCare = relative === `${copy.path}/index.html`
    const html = isCare ? templateHTML : await fs.readFile(path.join(input, relative), 'utf8')
    const page = await browser.newPage()
    await page.route('**/*', route => route.abort())
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    replacements += await page.evaluate(({ base, copy, classes: c, manifest, oldSchoolURLs, schoolRoute, relative, isCare, macroPicture }) => {
      const route = relative.replace(/\/index\.html$/, '').replace(/^index\.html$/, '')
      const careURL = `${base}/${copy.path}/`
      const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el }
      const link = () => { const a = node('a', c.arrowLink, 'Уход за шторами'); a.href = careURL; return a }
      const picture = (image, hero = false) => {
        const p = node('picture'), source = node('source'), img = node('img')
        if (hero) { source.media = '(max-width: 767px)'; source.srcset = `${base}/assets/${image.mobile.file} 768w`; source.sizes = '100vw'; p.append(source) }
        img.src = `${base}/assets/${image.desktop.file}`; img.srcset = `${base}/assets/${image.thumb.file} 768w, ${base}/assets/${image.desktop.file} 1536w`; img.sizes = hero ? '100vw' : '(max-width: 767px) calc(100vw - 40px), 45vw'; img.width = 1536; img.height = 1024; img.alt = image.alt; img.loading = hero ? 'eager' : 'lazy'; img.decoding = 'async'; img.style.objectPosition = '50% center'; if (hero) img.setAttribute('fetchpriority', 'high'); p.append(img); return p
      }
      function section(data) {
        const s = node('section', c.section); s.id = data.anchor
        const container = node('div', c.container), intro = node('div', c.sectionIntro)
        if (data.kicker) intro.append(node('p', c.kicker, data.kicker))
        intro.append(node('h2', '', data.heading)); if (data.body) intro.append(node('p', c.sectionBody, data.body)); container.append(intro)
        if (data.cards?.length) {
          const grid = node('div', data.kind === 'faq' ? c.faq : data.kind === 'process' ? c.process : c.cards)
          for (const [i, card] of data.cards.entries()) {
            if (data.kind === 'faq') { const d = node('details'), summary = node('summary', '', card.title), mark = node('span', '', '+'); mark.setAttribute('aria-hidden', 'true'); summary.append(mark); d.append(summary, node('p', '', card.body)); grid.append(d); continue }
            const article = node('article', c.card), text = node('div', c.cardText)
            if (card.imageIndex !== undefined) { const frame = node('div', c.cardImage); frame.append(picture(manifest.images[card.imageIndex])); article.append(frame) }
            if (data.kind === 'process') article.append(node('span', c.processNumber, `0${i + 1}`))
            text.append(node('h3', '', card.title)); if (card.body) text.append(node('p', '', card.body))
            if (card.linkLabel) { const a = link(); a.textContent = card.linkLabel; text.append(a) }
            article.append(text); grid.append(article)
          }
          container.append(grid)
        }
        s.append(container); return s
      }
      for (const panel of document.querySelectorAll('[class*="site_servicePanel__"]')) {
        if (!panel.querySelector(`a[href="${careURL}"]`)) { const a = node('a', '', copy.title); a.href = careURL; panel.append(a) }
        const label = panel.previousElementSibling; if (label?.tagName === 'A') { label.textContent = 'Услуги '; label.append(node('span', '', '⌄')) }
      }
      const mobile = document.querySelector('nav[aria-label="Мобильная навигация"]')
      if (mobile && !mobile.querySelector(`a[href="${careURL}"]`)) { const a = mobile.querySelector('a[href$="/partneram/"]')?.cloneNode(true) || link(); a.href = careURL; a.textContent = copy.title; const previous = mobile.querySelector('a[href$="/poshiv-po-eskizam/"]'); if (previous) previous.after(a); else mobile.append(a) }
      const footerNav = document.querySelector('footer nav'); if (footerNav && !footerNav.querySelector(`a[href="${careURL}"]`)) footerNav.append(link())
      let changed = 0
      for (const p of document.querySelectorAll('picture')) if (oldSchoolURLs.includes(p.querySelector('img')?.getAttribute('src'))) { p.replaceWith(picture(manifest.images[0], Boolean(p.closest('[class*="site_heroImage__"]')))); changed++ }
      if (route === schoolRoute) {
        const gallery = document.getElementById('visual-collection')
        if (gallery) {
          const next = section({ anchor: 'visual-collection', kicker: '/ Пространства для занятий', heading: 'Школьный класс и группа детского сада', body: 'Текстиль согласуется с назначением помещения, освещением, управлением и уходом. Иллюстрации показывают варианты оформления; требования и документы проверяются по конкретному объекту.', cards: [
            { title: 'Школьный класс', body: 'Дневной свет для занятий, управление шторами и доступ к окну. Комплект и документы проверяются по конкретному заданию.', imageIndex: 0 },
            { title: 'Группа детского сада', body: 'Текстиль для занятий и игр с учётом расположения детской мебели, освещения, управления и ухода.', imageIndex: 1 },
          ] }); next.querySelector(`.${c.cards}`).className = c.spaces; gallery.replaceWith(next)
        }
      }
      if (isCare) {
        document.title = `Предпросмотр · ${copy.seo.title}`
        for (const [key, value] of [['description', copy.seo.description], ['og:title', copy.seo.title], ['og:description', copy.seo.description]]) { let meta = document.head.querySelector(`meta[name="${key}"],meta[property="${key}"]`); if (!meta) { meta = node('meta'); meta.setAttribute(key.startsWith('og:') ? 'property' : 'name', key); document.head.append(meta) } meta.content = value }
        const ogURL = document.querySelector('meta[property="og:url"]'); if (ogURL) ogURL.content = `https://utkinin.github.io${careURL}`
        const main = document.getElementById('main'), hero = main.querySelector('section[class*="site_hero__"]'), form = document.getElementById('consultation'), crumbs = main.querySelector('nav[aria-label="Хлебные крошки"]')
        if (!hero || !form) throw new Error('Missing existing page template')
        for (const child of [...main.children]) if (child !== hero && child !== form && child !== crumbs) child.remove()
        if (crumbs) { const home = node('a', '', 'AFARA'); home.href = `${base}/`; crumbs.replaceChildren(home, node('span', '', '/'), node('span', '', copy.title)) }
        hero.querySelector('h1').textContent = copy.h1; hero.querySelector('[class*="site_heroIntro__"]').textContent = copy.intro
        const cta = hero.querySelector('a[href="#consultation"]'); cta.textContent = copy.cta; cta.dataset.inquiryBrief = copy.brief
        const details = hero.querySelector('[class*="site_detailsLink__"]'); details.href = '#care-tasks'; details.textContent = copy.detailsLabel + ' ↓'
        hero.querySelector('[class*="site_heroImage__"]').innerHTML = macroPicture
        const heroImage = hero.querySelector('img'); heroImage.loading = 'eager'; heroImage.sizes = '100vw'; heroImage.setAttribute('fetchpriority', 'high'); heroImage.alt = 'Фактура и отделка портьеры'
        for (const data of copy.sections) form.before(section(data))
        const h2 = form.querySelector('h2'); if (h2) h2.textContent = 'Обсудим уход за вашими шторами'
        const intro = form.querySelector(`.${c.sectionBody}`); if (intro) intro.textContent = 'Укажите город, высоту окон, количество полотен и что требуется сделать. Фотографии и сведения о ткани можно передать согласованным способом в переписке.'
      } else if (['', 'partneram', 'obshchestvennye-prostranstva/oteli', 'obshchestvennye-prostranstva/restorany', 'obshchestvennye-prostranstva/ofisy'].includes(route) && !document.getElementById('curtain-care')) {
        const block = section(route === '' ? copy.home : copy.crossLink)
        const after = document.getElementById('approach'); if (route === '' && after) after.after(block); else document.getElementById('consultation')?.before(block)
      }
      return changed
    }, { base, copy, classes, manifest, oldSchoolURLs, schoolRoute, relative, isCare, macroPicture })
    const target = path.join(output, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, '<!DOCTYPE html>' + await page.locator('html').evaluate(el => el.outerHTML))
    await page.close()
  }
  if (replacements < 2) throw new Error('Expected school replacements in the published page and navigation collection')
  const previous = JSON.parse(await fs.readFile(path.join(input, 'deployment.json'), 'utf8'))
  await fs.writeFile(path.join(output, 'deployment.json'), JSON.stringify({ ...previous, release: 'afara-care-education-20261018', sourceCommit: process.env.AFARA_SOURCE_COMMIT || 'local-unpublished', previewUpdatedAt: new Date().toISOString(), pages: previous.pages + 1, cmsUpdate: 'previous-published-CMS-preserved; care-education-editorial-preview', careEducation: { mode: 'editorial-preview', cmsAppliedInThisRun: false, service: `/${copy.path}/`, education: `/${schoolRoute}/`, replacedPictures: replacements, sourceCMSRelease: previous.release, newImageVariants: 6, form: 'existing-readonly-preview' } }, null, 2) + '\n')
  console.log(JSON.stringify({ pages: files.length, replacedPictures: replacements, output, cmsApplied: false }))
} finally { await browser.close() }
