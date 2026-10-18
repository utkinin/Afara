import type { Payload, PayloadRequest } from 'payload'
import { answerEvidence, answerLibrary } from '../../content/answer-library'
import { sameContent } from './content-identity'

export async function answerImportPlan(p: Payload, req?: Partial<PayloadRequest>) {
  const [pages, existing] = await Promise.all([
    p.find({ collection: 'pages', draft: false, depth: 0, pagination: false, req }),
    p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, req }),
  ])
  const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[\s?!.,;:]+/g, ' ').trim()
  return answerLibrary.map(item => {
    const page = pages.docs.find(page => page.path === item.page && page._status === 'published')
    const duplicate = existing.docs.some(record => record.topic === item.topic || normalize(record.question) === normalize(item.question))
    return { item, pageId: page?.id, action: duplicate ? 'preserve-existing' as const : !page ? 'missing-published-page' as const : 'create-draft' as const }
  })
}

export async function createAnswerDrafts(p: Payload, req: Partial<PayloadRequest>) {
  const plan = await answerImportPlan(p, req), created: number[] = []
  for (const row of plan) if (row.action === 'create-draft' && row.pageId) {
    const { topic, question, answer, keywords } = row.item
    const doc = await p.create({ collection: 'knowledge', draft: true, req, data: { topic, question, answer, keywords, evidence: answerEvidence(row.item), page: row.pageId, approved: false, _status: 'draft' } })
    created.push(doc.id)
  }
  return { plan: plan.map(row => ({ topic: row.item.topic, page: row.item.page, action: row.action })), created }
}

// Explicit editorial publication only. Never approve unrelated owner drafts or
// overwrite a changed answer just because its topic matches the library.
export async function publishReviewedAnswers(p: Payload, req: Partial<PayloadRequest>) {
  const [pages, records] = await Promise.all([
    p.find({ collection: 'pages', draft: false, depth: 0, pagination: false, req }),
    p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false, req }),
  ])
  const published: number[] = [], preserved: string[] = [], unchanged: number[] = []
  for (const item of answerLibrary) {
    const page = pages.docs.find(page => page.path === item.page && page._status === 'published')
    const matching = records.docs.filter(record => record.topic === item.topic)
    const record = matching[0]
    const pageId = typeof record?.page === 'object' ? record.page.id : record?.page
    if (!page || matching.length !== 1 || record.question !== item.question || record.answer !== item.answer || record.keywords !== item.keywords || record.evidence !== answerEvidence(item) || pageId !== page.id) {
      preserved.push(item.topic); continue
    }
    if (record._status === 'published' && record.approved) { unchanged.push(record.id); continue }
    const fresh = await p.findByID({ collection: 'knowledge', id: record.id, draft: true, depth: 0, req })
    if (!sameContent(fresh, record)) throw new Error('Answer changed after editorial review; retry without overwriting it')
    await p.update({ collection: 'knowledge', id: record.id, req, data: { approved: true, _status: 'published' } })
    published.push(record.id)
  }
  return { published, preserved, unchanged }
}
