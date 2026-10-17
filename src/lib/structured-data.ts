import type { Knowledge, Page, Site } from '../payload-types'
import { pageURL } from './urls'

type Answer = { question: string; answer: string }
export function visibleAnswers(page: Page, site: Site, knowledge: Knowledge[]): Answer[] {
  const approved = knowledge.filter(k => k.approved && k._status === 'published' && (typeof k.page === 'object' ? k.page.id : k.page) === page.id)
  const sections = [...(page.sections || []), ...(page.type === 'home' ? (site.trust || []).filter(s => !(s.kind === 'faq' && approved.length)) : [])]
  const answers = [...sections.filter(s => s.visible !== false && s.kind === 'faq').flatMap(s => (s.cards || []).map(c => ({ question: c.title, answer: c.body || '' }))), ...approved.map(k => ({ question: k.question, answer: k.answer }))]
  const seen = new Set<string>()
  return answers.filter(item => { const key = item.question.toLocaleLowerCase('ru-RU').trim(); if (!item.question || !item.answer || seen.has(key)) return false; seen.add(key); return true })
}

export function structuredData(page: Page, pages: Page[], site: Site, knowledge: Knowledge[], appURL: string | undefined): object | null {
  if (page._status !== 'published' || site._status !== 'published') return null
  let base: string
  try { const url = new URL(appURL || ''); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null; base = url.href.replace(/\/$/, '') } catch { return null }
  const absolute = (path: string) => base + path
  const url = absolute(pageURL(page)), answers = visibleAnswers(page, site, knowledge)
  const org = { '@type': 'Organization', '@id': absolute('/#organization'), name: site.brand, url: absolute('/'), ...(site.phone ? { telephone: site.phone } : {}), ...(site.email ? { email: site.email } : {}), ...(site.address ? { address: site.address } : {}) }
  const parentId = typeof page.parent === 'object' ? page.parent?.id : page.parent
  const parent = pages.find(p => p.id === parentId && p._status === 'published')
  const crumbs = [{ name: site.brand, path: '/' }, ...(page.type === 'home' ? [] : [...(parent ? [{ name: parent.title, path: pageURL(parent) }] : []), { name: page.title, path: pageURL(page) }])]
  const graph: object[] = [org, { '@type': 'WebSite', '@id': absolute('/#website'), name: site.brand, url: absolute('/'), publisher: { '@id': org['@id'] }, inLanguage: 'ru-RU' },
    { '@type': answers.length ? 'FAQPage' : 'WebPage', '@id': url + '#page', url, name: page.h1, ...(page.intro ? { description: page.intro } : {}), inLanguage: 'ru-RU', isPartOf: { '@id': absolute('/#website') }, ...(answers.length ? { mainEntity: answers.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) } : {}) },
  ]
  if (crumbs.length > 1) graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumbs', itemListElement: crumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.path) })) })
  if (['direction', 'service'].includes(page.type) && page.serviceConfirmed) graph.push({ '@type': 'Service', '@id': url + '#service', name: page.h1, ...(page.intro ? { description: page.intro } : {}), url, provider: { '@id': org['@id'] }, mainEntityOfPage: { '@id': url + '#page' } })
  return { '@context': 'https://schema.org', '@graph': graph }
}
export const serializeStructuredData = (value: object) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
