// CI-only additions to the seven-page development fixture, never an application startup task.
import assert from 'node:assert/strict'
import { cms } from '../src/lib/payload'
import { publicContactText } from '../src/cms/contact-knowledge'
assert.equal(process.env.AFARA_STAGE, 'development')
assert.match(new URL(process.env.DATABASE_URL!).pathname, /_acceptance$/, 'An isolated acceptance database is required')
const p = await cms()
try {
  assert.equal((await p.count({ collection: 'pages' })).totalDocs, 7, 'Use only the fresh development fixture')
  assert.equal((await p.count({ collection: 'knowledge' })).totalDocs, 0, 'Existing knowledge must never be replaced')
  assert.equal((await p.count({ collection: 'users' })).totalDocs, 0, 'Existing owner data must never be replaced')
  const contacts = await p.create({ collection: 'pages', data: { title: 'Контакты', path: 'kontakty', type: 'contacts', h1: 'Контакты AFARA', intro: 'Синтетическая контактная страница автоматической проверки.', cta: 'Обсудить проект', _status: 'published' } })
  const site = await p.updateGlobal({ slug: 'site', data: { assistant: { enabled: true, title: 'Задать вопрос', intro: 'Синтетический тестовый консультант. Не вводите личные данные.', placeholder: 'Вопрос' }, _status: 'published' } })
  const home = (await p.find({ collection: 'pages', where: { path: { equals: 'home' } }, depth: 0, limit: 1 })).docs[0]
  await p.create({ collection: 'knowledge', data: { question: 'Где работает AFARA?', answer: publicContactText(site), topic: 'contacts', keywords: 'география адрес телефон email контакты где работаете как связаться AFARA', page: contacts.id, approved: true, _status: 'published' } })
  await p.create({ collection: 'knowledge', data: { question: 'С какими задачами можно обратиться в AFARA?', answer: 'Синтетический публичный ответ автоматической проверки. Не условия реального заказа.', topic: 'ci-public-faq', page: home.id, approved: true, _status: 'published' } })
  console.log('Isolated CI fixture ready. No existing CMS records were replaced.')
} finally { await p.destroy() }
process.exit(0)
