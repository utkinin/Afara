import type { Payload, PayloadRequest } from 'payload'
import { customerTasksAnchor, customerTasksSection } from '../../content/customer-tasks'

export async function customerTasksPlan(p: Payload, req?: Partial<PayloadRequest>) {
  const home = (await p.find({ collection: 'pages', draft: false, req, depth: 0, limit: 1, where: { and: [{ path: { equals: 'home' } }, { _status: { equals: 'published' } }] } })).docs[0]
  if (!home) return { action: 'missing-published-home' as const }
  const latest = await p.findByID({ collection: 'pages', id: home.id, draft: true, depth: 0, req })
  if (latest._status === 'draft' || latest.updatedAt !== home.updatedAt) return { action: 'preserve-owner-draft' as const }
  const site = await p.findGlobal({ slug: 'site', draft: true, depth: 0, req })
  if ([...(home.sections || []), ...(site.trust || [])].some(section => section.anchor === customerTasksAnchor)) return { action: 'preserve-existing-section' as const }
  return { action: 'add-section' as const, home, baseline: JSON.stringify(latest) }
}

export async function addCustomerTasks(p: Payload, req: Partial<PayloadRequest>, expectedBaseline?: string) {
  const plan = await customerTasksPlan(p, req)
  if (plan.action !== 'add-section') return { applied: false, action: plan.action }
  if (expectedBaseline && plan.baseline !== expectedBaseline) throw new Error('Home changed after backup; no content was replaced')
  const fresh = await p.findByID({ collection: 'pages', id: plan.home.id, draft: true, depth: 0, req })
  if (JSON.stringify(fresh) !== plan.baseline) throw new Error('Concurrent home edit preserved; retry after reviewing the current draft')
  const sections = [...(plan.home.sections || [])], spaces = sections.findIndex(section => section.kind === 'spaces')
  sections.splice(spaces < 0 ? 0 : spaces + 1, 0, customerTasksSection())
  await p.update({ collection: 'pages', id: plan.home.id, draft: false, req, data: { sections, _status: 'published' } })
  await p.create({ collection: 'audit', req, data: { actor: 'customer-tasks-cli', action: 'add-customer-task-section', object: String(plan.home.id), version: '2026-10-18.1' } })
  return { applied: true, action: 'add-section' as const }
}
