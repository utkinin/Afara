import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cms } from '../src/lib/payload'
import { careCopy, educationPath } from '../src/lib/care-service'

assert.equal(process.env.AFARA_STAGE, 'development')
assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/afara_care_acceptance')
const p = await cms()
assert.equal((await p.count({ collection: 'pages' })).totalDocs, 7)
const home = (await p.find({ collection: 'pages', where: { path: { equals: 'home' } }, depth: 0 })).docs[0]
const oldImage = await p.create({ collection: 'media', filePath: 'fixtures/editorial/school-desktop.webp', data: { alt: 'SYNTHETIC old hall', source: 'AFARA editorial v1:school:desktop; SYNTHETIC acceptance', origin: 'ai', rightsConfirmed: true, _status: 'published' } })
const school = await p.create({ collection: 'pages', data: { title: 'SYNTHETIC school', path: educationPath, type: 'direction', serviceConfirmed: true, h1: 'SYNTHETIC educational page', intro: 'SYNTHETIC test content, not business evidence.', hero: oldImage.id, cta: 'Обсудить', sections: [{ kind: 'details', anchor: 'visual-collection', heading: 'SYNTHETIC gallery', cards: [{ title: 'School', image: oldImage.id }] }], _status: 'published' } })
function run(...args: string[]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/content-care.ts', ...args], { env: process.env, encoding: 'utf8', timeout: 90000 })
  assert.equal(result.status, 0, result.stderr + result.stdout)
}
run('--apply', '--publish-reviewed')
const afterHome = await p.findByID({ collection: 'pages', id: home.id, depth: 0 })
assert.equal(afterHome.h1, home.h1); assert.equal(afterHome.intro, home.intro)
assert.equal(afterHome.sections?.filter(s => s.anchor === 'curtain-care').length, 1)
const afterSchool = await p.findByID({ collection: 'pages', id: school.id, depth: 0 })
assert.notEqual(afterSchool.hero, oldImage.id)
assert.equal(afterSchool.sections?.find(s => s.anchor === 'visual-collection')?.cards?.length, 2)
const service = (await p.find({ collection: 'pages', where: { path: { equals: careCopy.path } }, depth: 0 })).docs[0]
assert.equal(service._status, 'published'); assert.equal(service.serviceConfirmed, true)
assert.equal((await p.count({ collection: 'knowledge', where: { page: { equals: service.id } } })).totalDocs, 8)
const mediaCount = (await p.count({ collection: 'media' })).totalDocs
const versions = (await p.findVersions({ collection: 'pages', where: { parent: { equals: school.id } } })).totalDocs
await p.update({ collection: 'pages', id: home.id, draft: true, data: { intro: 'SYNTHETIC owner draft retained', _status: 'draft' } })
run('--apply', '--publish-reviewed')
assert.equal((await p.count({ collection: 'media' })).totalDocs, mediaCount)
assert.equal((await p.findVersions({ collection: 'pages', where: { parent: { equals: school.id } } })).totalDocs, versions)
assert.equal((await p.findByID({ collection: 'pages', id: home.id, draft: true, depth: 0 })).intro, 'SYNTHETIC owner draft retained')
assert.equal((await p.count({ collection: 'knowledge', where: { page: { equals: service.id } } })).totalDocs, 8)
await p.destroy()
console.log('Care CMS acceptance passed: reviewed publication, image replacement, eight answers, idempotence and owner draft preservation.')
process.exit(0)
