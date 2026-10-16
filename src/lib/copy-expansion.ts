import copy from '../../content/service-copy.json'
import partnerFaq from '../../content/partner-faq.json'
import type { Page, Media, Site } from '../payload-types'
import { collectionDisclosure } from './editorial'

export type PageInput = Omit<Page, 'id' | 'createdAt' | 'updatedAt'>
type Images = (key: string, variant?: 'desktop' | 'mobile') => number | null
export const semanticCopy = copy
export function expansionImages(media: Media[]): Images {
  return (key, variant = 'desktop') => media.find(m => m.source?.startsWith(`AFARA expansion v1:${key}:${variant};`) || m.source?.startsWith(`AFARA editorial v1:${key}:${variant};`))?.id || null
}

export function servicePages(image: Images, ids: Map<string, number>): PageInput[] {
  const item = (path: string) => copy.pages.find(p => p.path === path)!
  const common = (path: string, title: string, h1: string, hero: string): PageInput => ({
    path, title, h1, type: 'service', serviceConfirmed: true, navOrder: path === 'partneram' ? 50 : 60,
    intro: item(path).intro, cta: path === 'partneram' ? 'Обсудить сотрудничество' : 'Обсудить изготовление',
    detailsLabel: 'Как мы работаем', hero: image(hero), heroMobile: image(hero, 'mobile'), heroAlt: `Концепция: ${title}`, conceptLabel: '',
    seo: { title: item(path).seoTitle, description: item(path).intro.split('. ')[0] + '.' }, _status: 'published',
  })
  return [
    { ...common('partneram', 'Партнёрам', 'Текстильная комплектация для дизайнеров и архитекторов', 'partners'), sections: [
      { kind: 'compositions', anchor: 'collaboration', heading: 'Текстильная часть вашего проекта', body: 'Подключаемся к отдельной задаче или согласованной комплектации. Сохраняем замысел автора интерьера; до изготовления уточняем исходные данные и распределяем ответственность.', cards: [
        { title: 'Дизайнерам и студиям', body: 'Подбор тканей, проработка штор и пошив по проекту дизайнера. Обсуждаем фактуры, слои и отделку вместе с интерьером.' },
        { title: 'Архитектурным бюро', body: 'Геометрия окна, ниши, кронштейны и карнизные системы. Для окон высотой от 3 до 6 м заранее обсуждаем управление и доступ для обслуживания.' },
        { title: 'Девелоперам и комплектаторам', body: 'Комплектация апартаментов, жилых и общественных зон. Образцы, состав изделий, этапы и требования объекта согласуем до заказа.' },
      ] },
      { kind: 'materials', anchor: 'white-label', heading: 'White label: под брендом вашей компании', body: copy.whiteLabel, image: image('partners'), cards: [
        { title: 'Коммуникация с заказчиком', body: 'Определяем контактное лицо и формат общения. Прямое взаимодействие с клиентом партнёра ведём в согласованном порядке.' },
        { title: 'Материалы и документы', body: 'Обсуждаем представление образцов, спецификаций и предложений, использование бренда и порядок утверждения изменений.' },
        { title: 'Авторство и конфиденциальность', body: 'Согласуем правила использования материалов и публикации. Работа под брендом партнёра не подменяет авторство интерьерного решения.' },
      ] },
      { kind: 'process', anchor: 'agreement', heading: 'От исходных данных — к изготовлению', cards: [
        { title: 'Задача и проект', body: 'Город, тип объекта, стадия проекта, эскизы и доступные размеры.' },
        { title: 'Состав работы', body: 'Кто выбирает материалы, утверждает решение и проверяет исходные данные.' },
        { title: 'Решение и условия', body: 'Композиция, конструкция, спецификация, стоимость и график.' },
        { title: 'Передача изделий', body: 'Изготовление, доставка и согласованные работы на объекте.' },
      ] },
      { kind: 'compositions', anchor: 'by-sketch', heading: 'У вас уже есть проект?', body: 'Можно передать в работу готовый эскиз и размеры. Поможем уточнить конструкцию и недостающие данные.', cards: [{ title: 'Пошив по эскизам и размерам', body: copy.manufacturing, page: ids.get('poshiv-po-eskizam'), linkLabel: 'Как передать проект в работу' }] },
      { kind: 'materials', anchor: 'geography', heading: 'Санкт-Петербург, Россия и отправка в ОАЭ', body: copy.geography + ' ' + copy.uae },
      { kind: 'faq', anchor: 'partner-questions', heading: 'Вопросы о сотрудничестве', cards: partnerFaq.answers },
      { kind: 'details', anchor: 'illustrations', heading: 'Обсуждаем решение на материалах проекта', body: collectionDisclosure },
    ] },
    { ...common('poshiv-po-eskizam', 'Пошив по эскизам', 'Пошив штор по эскизам и размерам заказчика', 'edge'), sections: [
      { kind: 'compositions', anchor: 'brief', heading: 'Что передать для начала работы', cards: [
        { title: 'Эскиз или дизайн-проект', body: 'Общий вид композиции, слои, пожелания по ткани и отделке. Если часть решений ещё не выбрана, обсудим её отдельно.' },
        { title: 'Размеры и фотографии', body: 'Данные о проёмах, высоте, установленных или запланированных карнизах, нишах и окружающей отделке. До заказа определяем, какие данные ещё нужны и кто их проверяет.' },
        { title: 'Состав и место передачи', body: 'Какие изделия нужны, где находится объект, требуется ли доставка и входят ли работы на объекте в заказ.' },
      ] },
      { kind: 'materials', anchor: 'niches', heading: 'Ниши, карнизы и кронштейны: обсудим до отделки', body: 'Проконсультируем по размерам и расположению ниши для штор, карнизной системе и кронштейнам. Для выбора важны число слоёв, габариты выбранной системы, положение окна и условия крепления. Универсальный размер ниши не заменяет проверку конкретного решения.', image: image('palette') },
      { kind: 'process', anchor: 'agreement', heading: 'Согласование перед изготовлением', cards: [
        { title: 'Проверяем данные', body: 'Уточняем комплектность эскиза и размеров, фиксируем ограничения.' },
        { title: 'Согласуем изделие', body: 'Материалы, отделка, конструкция, управление и состав работ.' },
        { title: 'Утверждаем условия', body: 'Спецификация, стоимость, график и порядок изменений.' },
        { title: 'Изготавливаем и передаём', body: 'Организуем согласованную передачу изделий; доставка и монтаж определяются заказом.' },
      ] },
      { kind: 'compositions', anchor: 'professionals', heading: 'Для проекта вашей студии', cards: [{ title: 'Сотрудничество и white label', body: 'Работаем с дизайнерами, архитектурными бюро, студиями и девелоперами. Обсудим выполнение текстильной части под вашим брендом.', page: ids.get('partneram'), linkLabel: 'Форматы сотрудничества' }] },
      { kind: 'materials', anchor: 'delivery', heading: 'Изготовление в составе удалённого проекта', body: copy.geography + ' ' + copy.uae },
      { kind: 'details', anchor: 'illustrations', heading: 'От иллюстрации к согласованному изделию', body: collectionDisclosure },
    ] },
  ]
}

export function pageUpdates(pages: Page[], image: Images, ids: Map<string, number>) {
  const updates = new Map<string, Partial<Page>>()
  for (const page of pages) {
    const text = copy.pages.find(p => p.path === page.path)
    if (!text) continue
    const intro = page.path === 'home' ? copy.homeIntro : text.intro
    const sections = structuredClone(page.sections || [])
    for (const section of sections) {
      for (const card of section.cards || []) {
        card.body = card.body?.replaceAll('4,5–6 м и выше', 'от 3 до 6 м').replaceAll('от 4,5–6 м', 'от 3 до 6 м')
        const target = typeof card.page === 'object' ? card.page?.id : card.page
        const targetPage = pages.find(p => p.id === target)
        if (section.kind === 'spaces' && targetPage) {
          card.image = targetPage.hero
          card.body = copy.pages.find(p => p.path === targetPage.path)?.intro || card.body
        }
      }
      if (section.kind === 'process' && section.anchor === 'approach') {
        const last = section.cards?.at(-1)
        if (last) { last.title = 'Передаём и оформляем'; last.body = 'Проверяем изделия и согласуем передачу. Доставка, монтаж и настройка системы выполняются в предусмотренном заказом составе.' }
      }
    }
    const patch: Partial<Page> = { intro, sections, seo: { ...page.seo, title: text.seoTitle, description: page.path === 'home' ? 'Шторы на заказ, дизайн и пошив по эскизам. Частные и общественные интерьеры, сотрудничество со студиями. Санкт-Петербург, вся Россия, отправка изделий в ОАЭ.' : intro.split('. ')[0] + '.' } }
    if (page.conceptLabel?.includes('ИИ')) patch.conceptLabel = ''
    if (text.h1) patch.h1 = text.h1
    if (page.path === 'chastnye-interery') { patch.hero = image('residence'); patch.heroMobile = image('residence', 'mobile') }
    if (page.path === 'obshchestvennye-prostranstva') { patch.hero = image('restaurant'); patch.heroMobile = image('restaurant', 'mobile') }
    if (page.path === 'home') {
      const spaces = sections.find(s => s.anchor === 'spaces')!
      spaces.body = 'Шторы для дома и квартиры, текстиль для общественных помещений и частных яхт. В каждом пространстве начинаем со света, приватности и сценариев использования.'
      for (const card of spaces.cards || []) {
        const target = typeof card.page === 'object' ? card.page?.id : card.page
        const targetPath = pages.find(p => p.id === target)?.path
        if (targetPath === 'chastnye-interery') { card.image = image('apartment'); card.body = 'Загородные дома и квартиры. Отдельные комнаты и согласованная комплектация интерьера.' }
        if (targetPath === 'obshchestvennye-prostranstva') { card.image = image('restaurant'); card.body = 'Отели, рестораны, офисы, сцены, школы и детские сады. Состав изделий — по задаче объекта.' }
      }
      const compositions = sections.find(s => s.anchor === 'compositions')!
      compositions.body = 'Сложные портьеры — это композиция, в которой ткань, слои, складка и управление работают вместе. Прорабатываем внешний вид и конструкцию с учётом окна и интерьера.'
      const compositionImages = ['bedroom', 'textile', 'residence']
      compositions.cards?.forEach((c, i) => { c.image = image(compositionImages[i]); c.imageAlt = `Концепция: ${c.title}` })
      const high = compositions.cards?.find(c => c.title.includes('Высокие'))
      if (high) high.body = 'Второй свет, эркеры и остекление высотой от 3 до 6 м. Заранее обсуждаем управление и доступ для обслуживания.'
      const details = sections.find(s => s.anchor === 'details')!
      details.kicker = '02 / Разбор решения'
      details.body = 'Рассматриваем решение на трёх уровнях: интерьер целиком, композиция окна и отделка крупным планом. Пропорции, движение портьер и детали согласуем как части одного проекта.'
      details.cards?.forEach((c, i) => { c.image = image(['living', 'hotel', 'edge'][i]); c.imageAlt = `Концепция: ${c.title}` })
      const materials = sections.find(s => s.anchor === 'materials')!
      materials.image = image('palette'); materials.imageAlt = 'Концепция: палитра тканей и эскиз окна'
      const at = Math.max(0, sections.findIndex(s => s.anchor === 'approach'))
      if (!sections.some(s => s.anchor === 'partners')) sections.splice(at, 0,
        { kind: 'compositions', anchor: 'partners', kicker: '/ Партнёрам', heading: 'Текстильная часть вашего проекта — с AFARA', body: 'Работаем с дизайнерами, архитектурными бюро, студиями, девелоперами и комплектаторами. Подключаемся к отдельной задаче или к согласованной комплектации; возможен формат white label.', cards: [{ title: 'Сотрудничество и white label', body: 'Под брендом вашей компании, с согласованными правилами общения, конфиденциальности и представления проекта.', image: image('partners'), imageAlt: 'Концепция: ткани и архитектурный эскиз', page: ids.get('partneram'), linkLabel: 'Форматы сотрудничества' }] },
        { kind: 'compositions', anchor: 'by-sketch', heading: 'Можно прийти со своим эскизом', body: copy.manufacturing, cards: [{ title: 'Пошив по эскизам и размерам', body: 'Изготовление по готовому проекту с уточнением исходных данных.', page: ids.get('poshiv-po-eskizam'), linkLabel: 'Как передать эскиз в работу' }] },
      )
    }
    if (page.path === 'obshchestvennye-prostranstva/sceny') {
      const first = sections.find(s => s.anchor === 'tasks')?.cards?.[0]
      if (first?.title.includes('без публичных')) first.title = 'Занавес, кулисы и согласованный состав комплекта'
    }
    if (page.path === 'kontakty' && !sections.some(s => s.anchor === 'oae')) sections.push({ kind: 'materials', anchor: 'oae', heading: 'Отправка штор и текстиля в ОАЭ', body: copy.uae, cards: [{ title: 'У вас уже есть эскиз?', body: 'Передайте проект, размеры и фотографии. До изготовления уточним состав заказа и необходимые согласования.', page: ids.get('poshiv-po-eskizam'), linkLabel: 'Изготовление по вашим данным' }, { title: 'Проект вашей студии', body: 'Можно работать в команде дизайнера или под брендом партнёра.', page: ids.get('partneram'), linkLabel: 'Сотрудничество' }] })
    updates.set(page.path, patch)
  }
  return updates
}

export function siteUpdate(site: Site): Partial<Site> {
  return { geography: copy.geography, studio: { ...site.studio, body: copy.positioning }, _status: 'published' }
}

export const newKnowledge = [
  { topic: 'partner-white-label', page: 'partneram', question: 'Работаете ли вы с дизайнерами и под брендом нашей студии?', answer: copy.whiteLabel, keywords: 'white label вайт лейбл партнёры дизайнер студия архитектор бюро девелопер комплектатор сотрудничество сотрудничать под брендом' },
  { topic: 'manufacturing-from-sketch', page: 'poshiv-po-eskizam', question: 'Можно ли заказать пошив штор по своим эскизам и размерам?', answer: copy.manufacturing, keywords: 'пошив изготовление шторы эскиз размеры заказчика готовый проект чертеж' },
  { topic: 'niche-bracket-consultation', page: 'poshiv-po-eskizam', question: 'Вы консультируете по размерам ниш и кронштейнам для штор?', answer: 'Да. Проконсультируем по нишам, карнизам и кронштейнам с учётом окна, числа слоёв, выбранной системы и условий крепления. Размеры и конструкцию уточняем до изготовления; универсальный размер ниши для любых штор не предлагаем.', keywords: 'ниша ниши размер глубина ширина карниз кронштейн крепление консультация' },
  { topic: 'delivery-uae', page: 'kontakty', question: 'Отправляете ли вы шторы и текстиль в ОАЭ?', answer: copy.uae, keywords: 'ОАЭ Дубай Эмираты доставка отправка изделия шторы текстиль' },
]
