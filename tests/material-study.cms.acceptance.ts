import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cms } from '../src/lib/payload'

// This explicit CI entry point must never run against an owner's CMS.
if (new URL(process.env.DATABASE_URL || '').pathname !== '/afara_material_study_acceptance' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('A dedicated material study acceptance database is required')
function apply() {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--env-file-if-exists=.env.local', 'scripts/content-material-study.ts', '--apply'], { encoding: 'utf8', timeout: 60000, env: process.env })
  assert.equal(child.status, 0, child.stderr || 'Material study import failed')
  const start = child.stdout.lastIndexOf('{\n  "applied"')
  assert.ok(start >= 0, 'The importer returned its result')
  return JSON.parse(child.stdout.slice(start)) as { applied: boolean; pages: string[]; report: string[] }
}
const p = await cms()
try {
  const home = (await p.find({ collection: 'pages', where: { path: { equals: 'home' } }, depth: 0 })).docs[0]
  assert.ok(home && !home.sections?.some(s => s.anchor === 'material-study'))
  const beforeMedia = (await p.count({ collection: 'media' })).totalDocs
  const beforeKnowledge = (await p.count({ collection: 'knowledge' })).totalDocs
  const result = apply()
  assert.equal(result.applied, true)
  assert.ok(result.pages.includes('home'))
  const published = await p.findByID({ collection: 'pages', id: home.id, draft: false, depth: 0 })
  const study = published.sections?.find(s => s.anchor === 'material-study')
  assert.equal(study?.cards?.length, 3)
  assert.deepEqual(published.sections?.filter(s => s.anchor !== 'material-study'), home.sections)
  assert.equal((await p.count({ collection: 'media' })).totalDocs, beforeMedia + 3)
  assert.equal((await p.count({ collection: 'knowledge' })).totalDocs, beforeKnowledge + 2)
  for (const card of study!.cards!) {
    const image = await p.findByID({ collection: 'media', id: card.image as number, overrideAccess: false })
    assert.equal(image._status, 'published')
    assert.ok(image.url && image.sizes?.thumb?.url && image.sizes?.tablet?.url)
    assert.equal('source' in image, false, 'Private provenance is not exposed anonymously')
  }
  assert.equal(apply().applied, false, 'A second run preserves the existing block')
  assert.equal((await p.count({ collection: 'media' })).totalDocs, beforeMedia + 3)
  await p.update({ collection: 'pages', id: home.id, draft: true, data: { h1: 'Синтетический черновик владельца', _status: 'draft' } })
  const draft = await p.findByID({ collection: 'pages', id: home.id, draft: true, depth: 0 })
  assert.equal(apply().applied, false)
  assert.deepEqual(await p.findByID({ collection: 'pages', id: home.id, draft: true, depth: 0 }), draft)
  assert.deepEqual(await p.findByID({ collection: 'pages', id: home.id, draft: false, depth: 0 }), published)
  console.log('Material study CMS acceptance: publication, media processing, private provenance, idempotence and owner draft preservation passed in the dedicated database.')
} finally { await p.destroy() }
process.exit(0)
