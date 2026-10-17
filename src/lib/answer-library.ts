import type { Payload, PayloadRequest } from 'payload'
import { answerEvidence, answerLibrary } from '../../content/answer-library'

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
