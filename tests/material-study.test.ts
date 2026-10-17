import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { pleatPath, studyQuestion } from '../src/lib/material-study-controls'
import { materialStudySection } from '../content/material-study'

test('study prepares a bounded discussion brief and never invents niche dimensions or material quantities', () => {
  const question = studyQuestion({ view: 'Тёплый свет', fullness: 1.7, layers: 2 })
  assert.match(question, /1,7/)
  assert.match(question, /слоёв: 2/)
  assert.ok(question.length < 500)
  assert.doesNotMatch(question, /15\s*см|16\s*см|метров ткани|100%|80%/)
  assert.match(studyQuestion({ view: 'Фактура', fullness: Number.NaN, layers: 1 }), /1,7; слоёв: 1/)
  for (const coefficient of [1.5, 1.7, 2]) assert.match(pleatPath(coefficient), /^M [\d\s.,CS]+$/)
  assert.equal(new Set([1.5, 1.7, 2].map(pleatPath)).size, 3)
  const section = materialStudySection({ neutral: 1, warm: 2, detail: 3 })
  assert.equal(section.kind, 'materials')
  assert.equal(section.anchor, 'material-study')
  assert.deepEqual(section.cards?.map(c => c.image), [1, 2, 3])
})

test('the three illustrative views have bounded responsive WebP assets with verified provenance', async () => {
  const manifest = JSON.parse(await readFile(new URL('../fixtures/material-study/manifest.json', import.meta.url), 'utf8'))
  assert.deepEqual(manifest.images.map((i: { id: string }) => i.id), ['neutral', 'warm', 'detail'])
  const originals = new Set<string>()
  for (const image of manifest.images) {
    assert.equal(image.origin, 'ai')
    assert.ok(image.prompt)
    for (const variant of image.variants) {
      assert.ok([480, 960, 1536].includes(variant.width))
      const bytes = await readFile(new URL('../fixtures/material-study/' + variant.file, import.meta.url))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256)
      assert.ok(bytes.length < 300000)
      const meta = await sharp(bytes).metadata()
      assert.equal(meta.format, 'webp')
      assert.equal(meta.exif, undefined)
      if (variant.width === 1536) originals.add(variant.sha256)
    }
  }
  assert.equal(originals.size, 3)
})
