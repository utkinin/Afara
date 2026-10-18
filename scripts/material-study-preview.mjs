import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { createHash } from 'node:crypto'

export async function writeMaterialStudyPreview(output) {
  const source = await readFile(new URL('../src/lib/material-study-controls.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, removeComments: true } }).outputText
  await writeFile(path.join(output, 'material-study-controls.js'), compiled)
  const hash = createHash('sha256').update(compiled).digest('hex').slice(0, 16)
  await writeFile(path.join(output, 'material-study-preview.js'), `for (const root of document.querySelectorAll('[data-material-study]')) {
  const start = async () => {observer?.disconnect(); const {initMaterialStudy} = await import('./material-study-controls.js?v=${hash}'); initMaterialStudy(root)};
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {if(entries.some(e=>e.isIntersecting))start()}, {rootMargin:'500px'});
  if(observer)observer.observe(root);else start();
}
`)
  return compiled
}
