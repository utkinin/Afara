import { cms } from '../src/lib/payload'

// A narrowly scoped bridge for this existing development database with a legacy
// schema-push history. Never rerun initial migrations over an existing CMS.
if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Use development with AFARA_DB_PUSH=false')
const p = await cms()
try {
  const result = await p.db.pool.query("SELECT to_regclass('public.pages') IS NOT NULL AS present")
  if (!result.rows[0].present) throw new Error('For an empty database use the complete migration sequence')
  await p.db.pool.query('ALTER TYPE "public"."enum_pages_type" ADD VALUE IF NOT EXISTS \'service\'')
  await p.db.pool.query('ALTER TYPE "public"."enum__pages_v_version_type" ADD VALUE IF NOT EXISTS \'service\'')
  const name = '20261016_120000_service_pages'
  if (!(await p.find({ collection: 'payload-migrations', where: { name: { equals: name } }, depth: 0, limit: 1 })).totalDocs) {
    const last = await p.find({ collection: 'payload-migrations', sort: '-batch', limit: 1, depth: 0 })
    await p.create({ collection: 'payload-migrations', data: { name, batch: Math.max(0, last.docs[0]?.batch || 0) + 1 } })
  }
  console.log('Added service template to existing page/version enums. Content was not rewritten.')
} finally { await p.destroy() }
process.exit(0)
