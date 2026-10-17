import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalReq } from 'payload'
import { cms } from '../src/lib/payload'
import { answerImportPlan, createAnswerDrafts } from '../src/lib/answer-library'

test('real CMS: answer import preserves owner drafts, is idempotent and keeps editorial evidence private', { timeout: 60000 }, async () => {
  assert.equal(process.env.AFARA_STAGE, 'development')
  assert.equal(new URL(process.env.DATABASE_URL || '').pathname, '/afara_ci_acceptance')
  const p = await cms(), tx = await p.db.beginTransaction()
  assert.ok(tx)
  try {
    const req = await createLocalReq({ req: { transactionID: tx } }, p), plan = await answerImportPlan(p, req)
    const row = plan.find(row => row.action === 'create-draft')!
    assert.ok(row?.pageId)
    const owner = await p.create({ collection: 'knowledge', draft: true, req, data: { topic: row.item.topic, question: 'Синтетический черновик владельца', answer: 'Синтетический текст владельца. Сохранить без изменений.', evidence: 'Private synthetic evidence', page: row.pageId, approved: false, _status: 'draft' } })
    const first = await createAnswerDrafts(p, req)
    assert.ok(first.created.length > 0)
    assert.equal(first.plan.find(x => x.topic === row.item.topic)?.action, 'preserve-existing')
    assert.equal((await p.findByID({ collection: 'knowledge', id: owner.id, draft: true, req, depth: 0 })).answer, owner.answer)
    assert.equal((await createAnswerDrafts(p, req)).created.length, 0)
    const publicDrafts = await p.find({ collection: 'knowledge', where: { id: { in: first.created } }, draft: false, overrideAccess: false, depth: 0, req })
    assert.equal(publicDrafts.totalDocs, 0)
    const id = first.created[0]
    const reviewed = await p.update({ collection: 'knowledge', id, draft: false, req, data: { approved: true, _status: 'published' } })
    assert.ok(reviewed.evidence)
    const publicRecord = await p.findByID({ collection: 'knowledge', id, overrideAccess: false, req, depth: 0 })
    assert.equal(publicRecord.answer, reviewed.answer)
    assert.equal(publicRecord.evidence, undefined)
  } finally { await p.db.rollbackTransaction(tx); await p.destroy() }
})
