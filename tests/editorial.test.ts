import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import jsQR from 'jsqr'
import { contactPublicURL, messageURL } from '../src/lib/editorial'
import { createContactQR } from '../src/lib/editorial-qr'

test('public QR preserves deployment prefix and decodes locally; invalid bases hide it', async () => {
  assert.equal(contactPublicURL('https://utkinin.github.io/Afara/?a=b#old'), 'https://utkinin.github.io/Afara/kontakty/')
  for (const value of ['', 'http://example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://192.168.1.1/', 'https://[::1]/', 'https://app.internal', 'https://example.test', 'https://user:secret@example.com', 'https://example.com:8443/']) assert.equal(contactPublicURL(value), null)
  assert.equal(messageURL({ messengers: [] }), '#consultation')
  assert.equal(messageURL({ messengers: [{ label: 'Telegram', url: 'https://t.me/afara_example' }] }), 'https://t.me/afara_example')
  assert.equal(messageURL({ messengers: [{ label: 'Telegram', url: 'https://t.me.evil.example/afara' }] }), '#consultation')
    const code = await createContactQR('https://utkinin.github.io/Afara/')
    const source = code!.src.split(',')[1]
    const { data, info } = await sharp(Buffer.from(source, 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, 'https://utkinin.github.io/Afara/kontakty/')
    assert.equal(await createContactQR('http://localhost:3000'), null)
})
