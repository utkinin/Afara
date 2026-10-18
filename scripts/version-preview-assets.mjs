import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

export async function versionPreviewAssets(output, base, pages, hasStudy) {
  const names = ['preview-controls.js', ...(hasStudy ? ['material-study-preview.js'] : [])]
  const entries = await Promise.all(names.map(async name => [name, createHash('sha256').update(await readFile(path.join(output, name))).digest('hex').slice(0, 16)]))
  for (const page of pages) {
    const file = path.join(output, page.replace(/^\//, ''), 'index.html')
    let html = await readFile(file, 'utf8')
    for (const [name, hash] of entries) html = html.replaceAll(`src="${base}/${name}"`, `src="${base}/${name}?v=${hash}"`)
    await writeFile(file, html)
  }
}
