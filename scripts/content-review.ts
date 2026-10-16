import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { cms } from '../src/lib/payload'
import type { Page, Site } from '../src/payload-types'

// Explicit editorial operation, never called by setup, startup, migration or deployment.
if (process.env.AFARA_STAGE !== 'development') throw new Error('Подготовка редакционных черновиков разрешена только в development. Рабочую публикацию выполняет ADMIN в CMS.')
const apply = process.argv.includes('--apply-drafts')
const proposals = JSON.parse(await readFile(new URL('../content/review-2026-10.json', import.meta.url), 'utf8')) as {
  faq: { number: number; question: string; answer: string }[]
  directions: { title: string; h1: string; slug: string; parent: string; intro: string; topics: string }[]
}
const keywords: Record<number, string> = { 1: 'услуги задачи специализация что делаете', 2: 'состав проект работа входит подбор монтаж', 3: 'весь дом квартира комнаты', 4: 'когда ремонт до после', 5: 'первое обращение начать нужно заказ', 6: 'без размеров замер', 7: 'сколько стоит цена стоимость расчет бюджет шторы портьеры проект заказ композиция', 8: 'сколько времени срок сроки график изготовление монтаж заказ шторы портьеры проект', 9: 'дизайнер сотрудничество', 10: 'старые существующие карнизы', 11: 'blackout блэкаут темнота затемнение спальня', 12: 'отель гостиница комплектация', 13: 'фотография повторить референс', 14: 'отдельно документация расчет', 15: 'документы рекомендации уход' }

const directionDetails = JSON.parse(await readFile(new URL('../content/direction-details.json', import.meta.url), 'utf8')) as Record<string, string[]>
const p = await cms()
const before = await p.find({ collection: 'pages', depth: 0, limit: 100, draft: false })
const siteBefore = await p.findGlobal({ slug: 'site', depth: 0, draft: false })
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const baseline = digest({ pages: before.docs, site: siteBefore })
const report: string[] = []
const records = new Map(before.docs.map(page => [page.path, page]))
const existingDrafts = await p.find({ collection: 'pages', depth: 0, limit: 100, draft: true })
for (const page of existingDrafts.docs) records.set(page.path, page)
try {
  for (const [index, d] of proposals.directions.entries()) {
    const path = `${d.parent}/${d.slug}`
    if (records.has(path)) { report.push(`Сохранено без изменений: ${path}`); continue }
    const parent = records.get(d.parent)
    if (!parent) throw new Error(`Нет родителя ${d.parent}`)
    const data: Omit<Page, 'id' | 'createdAt' | 'updatedAt'> = {
      title: d.title, path, parent: parent.id, type: 'direction', serviceConfirmed: false, navOrder: 20 + index,
      h1: d.h1,
      intro: d.intro, cta: 'Обсудить проект', detailsLabel: 'Рассмотреть задачу', _status: 'draft',
      sections: [
        { kind: 'compositions', anchor: 'tasks', heading: 'Что важно для этого пространства', cards: d.topics.split(', ').map((title, taskIndex) => ({ title, body: specificTask(d.slug, taskIndex) })) },
        { kind: 'materials', anchor: 'agreement', heading: 'Что обсудить до изготовления', body: agreement(d.slug) },
        { kind: 'conditions', heading: 'Расчёт под согласованный состав', body: 'Размеры и количество окон, материалы, слои, отделка, способ управления и условия установки рассматриваются вместе. Стоимость и график определяются для конкретного заказа после уточнения исходных данных.' },
      ], seo: { title: `AFARA — ${d.title.toLowerCase()}`, description: d.intro },
    }
    report.push(`Новый содержательный черновик: ${path}`)
    if (apply) records.set(path, await p.create({ collection: 'pages', draft: true, data }))
  }
  const yachtPath = 'chastnye-yahty'
  if (!records.has(yachtPath)) {
    report.push(`Новое отдельное направление: ${yachtPath}`)
    if (apply) records.set(yachtPath, await p.create({ collection: 'pages', draft: true, data: {
      title: 'Текстиль для частных яхт', path: yachtPath, type: 'direction', navOrder: 40, serviceConfirmed: false,
      h1: 'Текстиль для частных яхт', intro: 'Индивидуальное текстильное решение для частной яхты начинается с геометрии остекления, сценариев света и особенностей интерьера. Композиция и состав работ согласуются с дизайнером или представителем заказчика.',
      cta: 'Обсудить проект', _status: 'draft', sections: [
        { kind: 'compositions', anchor: 'tasks', heading: 'Геометрия, свет и пользование', cards: [
          { title: 'Сложная геометрия', body: 'Наклонные и криволинейные поверхности, размеры проёмов и доступ к ним задают исходные ограничения. Возможное решение рассматривается по материалам конкретной яхты.' },
          { title: 'Связь с интерьером', body: 'Цвет, пластика и объём текстиля согласуются с отделкой, мебелью и назначением каждой зоны. Фотография референса помогает обсудить характер, но не заменяет согласования.' },
          { title: 'Удобство использования', body: 'В обсуждение включаются доступ к остеклению, способ управления и обслуживание. Состав комплектации определяется после уточнения условий на объекте.' },
        ] },
        { kind: 'process', anchor: 'agreement', heading: 'Согласование с представителем заказчика', body: 'В начале проекта определяются контактное лицо, актуальные исходные данные и порядок утверждения. До изготовления согласуются композиция, выбранные материалы, отделка и состав работ. Изменения рассматриваются с ответственным участником проекта.' },
        { kind: 'materials', anchor: 'materials', heading: 'Материалы — по документам конкретного решения', body: 'Условия эксплуатации и требования к материалам передаются в задании. Свойства тканей, соответствие морским требованиям и сертификаты подтверждаются документами выбранных материалов; универсальных обещаний для любой яхты нет.' },
        { kind: 'conditions', heading: 'Индивидуальный состав заказа', body: 'На расчёт влияют геометрия, размеры, материалы, отделка, управление и доступ для установки. Стоимость, график и логистика уточняются после изучения конкретного объекта.' },
      ],
    } }))
  }
  if (!records.has('kontakty')) {
    report.push('Страница контактов: подготовлена без вымышленных каналов связи')
    if (apply) records.set('kontakty', await p.create({ collection: 'pages', draft: true, data: {
      title: 'Контакты', path: 'kontakty', type: 'contacts', h1: 'Контакты AFARA', cta: 'Обсудить проект',
      intro: 'Для обсуждения текстильного решения укажите город, тип объекта и коротко опишите задачу. География, способы связи и сведения студии обновляются из единого источника CMS.', _status: 'draft',
    } }))
  }
  const home = records.get('home')
  const latestSite = await p.findGlobal({ slug: 'site', draft: true, depth: 0 })
  const hasSiteDraft = latestSite.updatedAt !== siteBefore.updatedAt
  const sitePatch: Partial<Site> = {}
  if (!latestSite.studio?.body) sitePatch.studio = { ...latestSite.studio, heading: 'О студии AFARA', body: 'AFARA — текстильный дизайн и инженерная студия. Специализация — комплектация сложных частных резиденций и HoReCa: второй свет, эркеры, многослойность, Wave, blackout и моторизация. Базируемся в Санкт-Петербурге. Работаем по всей России.', verified: false }
  if (!latestSite.trust?.length) sitePatch.trust = [
    { kind: 'compositions', anchor: 'scope', heading: 'Что входит в индивидуальный проект', body: 'Состав определяется задачей. Конкретный перечень работ и согласований фиксируется в предложении; отдельные позиции не следует считать включёнными автоматически.', cards: [
      { title: 'Подбор и композиция', body: 'Материалы, слои, пластика и отделка рассматриваются вместе со светом и пропорциями окна.' },
      { title: 'Техническая проработка и изготовление', body: 'В работу передаются согласованные исходные данные и состав решения. Модель ответственности определяется условиями конкретного заказа.' },
      { title: 'Установка и проверка', body: 'Состав монтажа, готовность объекта и приёмка согласуются до выполнения работ.' },
    ] },
    { kind: 'materials', anchor: 'order-agreement', heading: 'Как согласуется заказ', body: 'До изготовления согласуются внешний вид композиции, выбранные материалы, отделка и состав работ. Формат образцов и представления решения определяется задачей проекта. В начале работы важно определить, кто утверждает решение и как фиксируются изменения.\n\nЕсли вы работаете с дизайнером, передайте актуальные исходные материалы и определите ответственного за согласования.' },
    { kind: 'conditions', anchor: 'cost', heading: 'От чего зависит стоимость', body: 'Размеры и количество окон, ткани, число слоёв, отделка, конструкция, способ управления и условия монтажа влияют на расчёт. Одинаковая ширина окна не означает одинаковую стоимость двух композиций.\n\nСрок зависит от согласования решения, доступности материалов, изготовления и готовности объекта. Стоимость и график обсуждаются по конкретному заказу.' },
    { kind: 'faq', anchor: 'questions', heading: 'Перед первым обращением', cards: proposals.faq.filter(f => [1, 2, 4, 5, 7, 8].includes(f.number)).map(f => ({ title: f.question, body: f.answer })) },
  ]
  if (!latestSite.worksHeading) sitePatch.worksHeading = 'Реальные работы AFARA'
  if (!latestSite.contactsLabel) sitePatch.contactsLabel = 'Контакты'
  if (Object.keys(sitePatch).length) {
    report.push(hasSiteDraft ? 'У сайта уже есть черновик: подготовлен только файл сравнения; запись CMS не изменена' : 'Дополнение сайта: только новые незаполненные поля, сохранение черновиком')
    if (apply && !hasSiteDraft) await p.updateGlobal({ slug: 'site', draft: true, data: { ...sitePatch, _status: 'draft' } })
  }
  if (home) {
    const publicHome = before.docs.find(p => p.path === 'home')
    // Never replace the owner's existing draft or filled body text.
    if (publicHome && home.updatedAt === publicHome.updatedAt) {
      const explanations: Record<string, string> = {
        spaces: 'Назначение помещения меняет требования к свету, приватности, движению портьер и уходу. Проект начинается с этих задач — затем выбираются материалы и композиция.',
        compositions: 'Впечатление складывается из нескольких решений: как ткань держит форму, как сочетаются слои, где проходит линия портьеры и как она движется. Эти детали рассматриваются вместе, в масштабе интерьера.',
        details: 'Интерьер целиком, композиция окна и отделка крупным планом показывают разные уровни решения. На этой странице представлены подписанные ИИ-концепции; они не подтверждают выполненные работы AFARA.',
      }
      const sections = home.sections?.map(section => !section.body && section.anchor && explanations[section.anchor] ? { ...section, body: explanations[section.anchor] } : section)
      if (digest(sections) !== digest(home.sections)) {
        report.push('Главная: содержательные пояснения добавлены только в пустые поля нового черновика')
        if (apply) await p.update({ collection: 'pages', id: home.id, draft: true, data: { sections, _status: 'draft' } })
      }
    } else report.push('Черновик главной сохранён без изменений')
    for (const f of proposals.faq) {
      const topic = `faq-${f.number}`
      if ((await p.find({ collection: 'knowledge', where: { topic: { equals: topic } }, draft: true, limit: 1, depth: 0 })).totalDocs) continue
      report.push(`База знаний: черновик ответа ${f.number}`)
      if (apply) await p.create({ collection: 'knowledge', draft: true, data: { question: f.question, answer: f.answer, topic, keywords: keywords[f.number] || '', page: f.number === 12 ? records.get('obshchestvennye-prostranstva/oteli')!.id : home.id, approved: false, _status: 'draft' } })
    }
  }
  const after = await p.find({ collection: 'pages', depth: 0, limit: 100, draft: false, where: { id: { in: before.docs.map(p => p.id) } } })
  const afterSite = await p.findGlobal({ slug: 'site', depth: 0, draft: false })
  if (digest({ pages: after.docs, site: afterSite }) !== baseline) throw new Error('Проверка сохранности опубликованных данных не прошла')
  report.push('Проверено: опубликованные записи страниц и сайта совпадают с исходными целиком. Ничего не опубликовано.')
  if (apply) {
    const directory = process.env.CONTENT_REVIEW_OUTPUT || '/workspace/afara-content-review'
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(`${directory}/proposal.json`, JSON.stringify({ sitePatch, report, publishedSHA256: baseline }, null, 2), { mode: 0o600 })
  }
  console.log(report.join('\n'))
} finally { await p.destroy() }
process.exit(0)

function specificTask(slug: string, index: number) {
  return directionDetails[slug][index] || directionDetails[slug][0]
}
function agreement(slug: string) {
  return `Исходные данные, композиция, материалы, отделка и предусмотренный состав работ уточняются до изготовления. Ответственное за согласование лицо определяется в начале обсуждения. ${['sceny','shkoly-i-detskie-sady'].includes(slug) ? 'Специальные требования объекта и документы на материалы проверяются по конкретной комплектации; наличие сертификатов нельзя определять по фотографии.' : 'Решение рассматривается вместе с интерьером, доступом к окну и условиями дальнейшего использования.'}`
}
