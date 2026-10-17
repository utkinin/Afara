import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { customerTasksSection } from '../content/customer-tasks'

if (process.argv.includes('--list')) console.log(JSON.stringify(customerTasksSection(), null, 2))
else {
  if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false' || !process.env.DATABASE_URL) throw new Error('Existing development CMS and AFARA_DB_PUSH=false required; no database is created')
  const { cms } = await import('../src/lib/payload'), { createLocalReq } = await import('payload')
  const { addCustomerTasks, customerTasksPlan } = await import('../src/lib/customer-tasks-import')
  const p = await cms(), apply = process.argv.includes('--apply')
  let tx: string | number | null = null
  try {
    const plan = await customerTasksPlan(p)
    if (apply && plan.action === 'add-section') {
      const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), backup = process.env.AFARA_CONTENT_BACKUP_DIR
      const resolved = backup && path.resolve(backup)
      if (!backup || !path.isAbsolute(backup) || resolved === root || resolved!.startsWith(root + path.sep)) throw new Error('Private absolute AFARA_CONTENT_BACKUP_DIR outside checkout required')
      await mkdir(backup, { recursive: true, mode: 0o700 })
      if ((await stat(backup)).mode & 0o077) throw new Error('Backup directory must have mode 0700')
      await writeFile(path.join(backup, `customer-tasks-${Date.now()}.json`), JSON.stringify(plan.home), { mode: 0o600, flag: 'wx' })
      tx = await p.db.beginTransaction({ isolationLevel: 'serializable' })
      if (!tx) throw new Error('Transaction required')
      const req = await createLocalReq({ req: { transactionID: tx } }, p)
      const result = await addCustomerTasks(p, req, plan.baseline)
      await p.db.commitTransaction(tx); tx = null
      console.log(JSON.stringify(result))
    } else console.log(JSON.stringify({ applied: false, action: plan.action, note: 'Без --apply нет записи; существующие блоки и черновики владельца сохраняются.' }))
  } catch (error) { if (tx) await p.db.rollbackTransaction(tx); throw error }
  finally { await p.destroy() }
}
