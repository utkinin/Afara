import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Input is a local map produced after generation. Nothing is fetched from third-party image sites.
let stdin = ''
for await (const chunk of process.stdin) stdin += chunk
const input = JSON.parse(stdin)
const directory = new URL('../fixtures/editorial/', import.meta.url)
await mkdir(directory, { recursive: true })
const output = []
for (const item of input) {
  if (!/^[a-z-]+$/.test(item.id)) throw new Error('Unsafe asset name')
  const original = sharp(item.source, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate()
  const file = `${item.id}.webp`, mobile = `${item.id}-mobile.webp`
  await original.clone().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 84, effort: 5 }).toFile(fileURLToPath(new URL(file, directory)))
  await original.clone().resize(900, 1200, { fit: 'cover', position: item.id === 'curtain-detail' ? 'right' : 'centre' }).webp({ quality: 82, effort: 5 }).toFile(fileURLToPath(new URL(mobile, directory)))
  output.push({ id: item.id, file, mobile, origin: 'ai', generatedAt: '2026-10-16', generator: 'Built-in imagegen; model identifier not exposed', prompt: item.prompt })
}
await writeFile(new URL('manifest.json', directory), JSON.stringify(output, null, 2) + '\n')
console.log(`Prepared ${output.length} original concepts and mobile variants. Publication requires the explicit CMS import.`)
