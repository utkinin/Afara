import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { inquirySchema } from '../src/lib/inquiry-schema'
import { telegramURL, publicContactsURL } from '../src/lib/contact-links'
import { visualCollection } from '../content/visual-collection'

test('messaging can receive a lead without requiring a telephone number', () => {
  const lead = { space: 'Частная яхта', city: 'Санкт-Петербург', description: 'Обсудить текстиль для салона яхты', budget: '', name: 'Тест', channel: 'telegram', contact: '@afara_test', consent: true, consentVersion: 'test', source: 'chastnye-yahty', website: '' }
  assert.equal(inquirySchema.safeParse(lead).success, true)
  for (const contact of ['https://evil.example/name', '@x', '@name with spaces', '<script>']) assert.equal(inquirySchema.safeParse({ ...lead, contact }).success, false)
})

test('contact buttons reject deceptive Telegram destinations and QR preserves a real public base path', () => {
  assert.equal(telegramURL([{ url: 'https://t.me/afara_studio' }]), 'https://t.me/afara_studio')
  for (const url of ['https://t.me.evil.example/afara', 'javascript:alert(1)', 'https://t.me@evil.example/a', 'https://evil@t.me/name', '']) assert.equal(telegramURL([{ url }]), null)
  assert.equal(publicContactsURL('https://utkinin.github.io/Afara/', 'kontakty'), 'https://utkinin.github.io/Afara/kontakty/')
  assert.equal(publicContactsURL('https://example.test', 'kontakty'), 'https://example.test/kontakty/')
  assert.equal(publicContactsURL('http://localhost:3000', 'kontakty'), null)
  assert.equal(publicContactsURL('', 'kontakty'), null)
})

test('all fourteen directions have distinct, compressed desktop assets and tall mobile variants', async () => {
  const manifest = JSON.parse(await readFile('fixtures/editorial/manifest.json', 'utf8')) as { id: string; file: string; mobile: string }[]
  assert.equal(visualCollection.length, 14)
  assert.equal(new Set(visualCollection.map(d => d.asset)).size, 14)
  const hashes = new Set<string>()
  for (const asset of manifest) {
    for (const [file, mobile] of [[asset.file, false], [asset.mobile, true]] as const) {
      const path = `fixtures/editorial/${file}`
      assert.ok((await stat(path)).size < 600_000, `Oversized image: ${file}`)
      const meta = await sharp(path).metadata()
      assert.equal(meta.format, 'webp')
      assert.ok(!meta.exif, 'Location and camera metadata must not be published')
      if (mobile) assert.equal(meta.width! / meta.height!, 0.75)
    }
    const hash = createHash('sha256').update(await readFile(`fixtures/editorial/${asset.file}`)).digest('hex')
    assert.ok(!hashes.has(hash), 'Different spaces must not silently reuse one source photo')
    hashes.add(hash)
  }
  for (const direction of visualCollection) assert.ok(manifest.some(a => a.id === direction.asset), direction.path)
})
