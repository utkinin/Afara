import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerEvidence, answerLibrary, answerLibraryVersion } from '../content/answer-library'
import { answerImportPlan, createAnswerDrafts, publishReviewedAnswers } from '../src/lib/answer-library'

if (process.argv.includes('--list')) {
  console.log(JSON.stringify({ version: answerLibraryVersion, status: 'editorial-drafts', answers: answerLibrary.map(item => ({ ...item, evidence: answerEvidence(item) })) }, null, 2))
} else {
  if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false' || !process.env.DATABASE_URL) throw new Error('Use the existing development CMS, DATABASE_URL and AFARA_DB_PUSH=false. This command never creates a database.')
  const publish = process.argv.includes('--publish-reviewed')
  if (publish && !process.argv.includes('--apply')) throw new Error('--publish-reviewed requires explicit --apply after editorial review')
  const { createLocalReq } = await import('payload'), { cms } = await import('../src/lib/payload')
  const p = await cms(), apply = process.argv.includes('--apply')
  let tx: string | number | null = null
  try {
    if (apply) {
      const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), backup = process.env.AFARA_CONTENT_BACKUP_DIR
      const resolved = backup && path.resolve(backup)
      if (!backup || !path.isAbsolute(backup) || resolved === root || resolved!.startsWith(root + path.sep)) throw new Error('Set AFARA_CONTENT_BACKUP_DIR to a private absolute directory outside the checkout')
      await mkdir(backup, { recursive: true, mode: 0o700 })
      if ((await stat(backup)).mode & 0o077) throw new Error('Backup directory must have mode 0700')
      const before = await p.find({ collection: 'knowledge', draft: true, depth: 0, pagination: false })
      await writeFile(path.join(backup, `answer-library-${Date.now()}.json`), JSON.stringify(before.docs), { mode: 0o600, flag: 'wx' })
      tx = await p.db.beginTransaction()
      if (!tx) throw new Error('Transaction required')
      const req = await createLocalReq({ req: { transactionID: tx } }, p)
      const result = await createAnswerDrafts(p, req)
      const publication = publish ? await publishReviewedAnswers(p, req) : { published: [], preserved: [], unchanged: [] }
      await p.create({ collection: 'audit', req, data: { actor: 'answer-library-cli', action: publish ? 'publish-reviewed-answers' : 'create-answer-drafts', object: String(publish ? publication.published.length : result.created.length), version: createHash('sha256').update(JSON.stringify(answerLibrary)).digest('hex') } })
      await p.db.commitTransaction(tx); tx = null
      console.log(JSON.stringify({ version: answerLibraryVersion, ...result, ...publication, note: publish ? 'Опубликованы только проверенные неизменённые ответы библиотеки; правки владельца сохранены.' : 'Созданы только черновики; публикация требует отдельного явного --publish-reviewed.' }, null, 2))
    } else {
      const plan = await answerImportPlan(p)
      console.log(JSON.stringify({ applied: false, plan: plan.map(row => ({ topic: row.item.topic, page: row.item.page, action: row.action })), note: 'План без записи. --apply создаёт только новые черновики.' }, null, 2))
    }
  } catch (error) { if (tx) await p.db.rollbackTransaction(tx); throw error }
  finally { await p.destroy() }
}
// Finish the CLI after awaited transactions and destroy(), including piped JSON.
process.stdout.write('', () => process.exit(0))
