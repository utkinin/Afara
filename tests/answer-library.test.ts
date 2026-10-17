import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { Payload } from 'payload'
import { answerEvidence, answerLibrary, answerSources } from '../content/answer-library'
import copy from '../content/service-copy.json'
import { createAnswerDrafts } from '../src/lib/answer-library'

test('32 editorial drafts map to existing sections, have evidence and never prescribe a universal niche or care mode', () => {
  const readable = readFileSync('docs/ANSWER_LIBRARY.md', 'utf8')
  assert.equal(answerLibrary.length, 32)
  assert.equal(new Set(answerLibrary.map(x => x.topic)).size, answerLibrary.length)
  assert.equal(new Set(answerLibrary.map(x => x.question)).size, answerLibrary.length)
  for (const item of answerLibrary) {
    assert.ok(readable.includes(item.question) && readable.includes(item.answer), 'Readable library stays in sync')
    assert.ok(copy.pages.some(page => page.path === item.page), item.page)
    assert.match(item.topic, /^[a-z0-9-]{2,80}$/)
    assert.ok(item.answer.length <= 2400 && item.keywords.length <= 500)
    assert.ok(item.answer.split(/\s+/).length >= 30)
    assert.ok(item.sources.length && item.limitation)
    for (const key of item.sources) assert.equal(new URL(answerSources[key].url).protocol, 'https:')
    assert.ok(answerEvidence(item).includes('Не прошёл инженерную приёмку'))
    assert.doesNotMatch(item.answer, /минимальная ширина.*составляет 15|блокирует 100%|все.*стирать.*30|в наличии|гарантирован/i)
  }
})
test('offline list emits only JSON and does not initialize CMS, SMTP or a database connection', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/content-answers.ts', '--list'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, AFARA_STAGE: '', DATABASE_URL: '', SMTP_HOST: 'not-connected.invalid' } })
  const result = JSON.parse(output)
  assert.equal(result.answers.length, 32)
  assert.equal(result.status, 'editorial-drafts')
})
test('answer import only creates drafts, preserves owner edits, skips missing pages and is repeatable', async () => {
  const pages = [{ id: 1, path: 'home', _status: 'published' }, { id: 2, path: 'partneram', _status: 'draft' }]
  const records = [{ topic: answerLibrary[0].topic, question: 'Вопрос владельца', answer: 'Текст владельца', page: 1 }]
  let nextId = 100
  const p = { find: async ({ collection }: { collection: string }) => ({ docs: collection === 'pages' ? pages : records }), create: async ({ collection, draft, data }: { collection: string; draft: boolean; data: typeof records[number] & { approved: boolean; _status: string } }) => { assert.equal(collection, 'knowledge'); assert.equal(draft, true); assert.equal(data.approved, false); assert.equal(data._status, 'draft'); records.push(data); return { id: nextId++ } } } as unknown as Payload
  const first = await createAnswerDrafts(p, {})
  assert.equal(first.created.length, 1)
  assert.equal(first.plan.find(x => x.topic === answerLibrary[0].topic)?.action, 'preserve-existing')
  assert.equal(first.plan.find(x => x.topic === 'white-label-responsibility')?.action, 'missing-published-page')
  assert.equal(records[0].answer, 'Текст владельца')
  assert.equal((await createAnswerDrafts(p, {})).created.length, 0)
})
