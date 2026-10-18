import { open, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { createLocalReq } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { cms } from '../src/lib/payload'
import { up } from '../src/migrations/20261017_203641_analytics'
import { migrations } from '../src/migrations'
import { schemaCatalogSQL } from '../src/lib/database-schema'
import { sameContent } from '../src/lib/content-identity'

// The original development CMS has a legacy schema-push history. Do not replay
// initial migrations or mark them applied without validating a separate baseline.
if (process.env.AFARA_STAGE !== 'development' || process.env.AFARA_DB_PUSH !== 'false') throw new Error('Existing development CMS with AFARA_DB_PUSH=false required')
const backup = process.env.AFARA_DB_BACKUP, root = process.cwd()
if (!backup || !path.isAbsolute(backup) || path.resolve(backup).startsWith(root + path.sep)) throw new Error('An existing private database dump outside the checkout is required')
if ((await stat(backup)).mode & 0o077) throw new Error('The database dump must have private permissions')
const file = await open(backup, 'r')
try {
  const header = Buffer.alloc(5); await file.read(header, 0, 5, 0)
  if (header.toString() !== 'PGDMP') throw new Error('A PostgreSQL custom-format backup is required')
} finally { await file.close() }

const p = await cms(), name = '20261017_203641_analytics'
try {
  await p.db.drizzle.transaction(async db => {
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('afara-upgrade-existing'))`)
    const history = await db.execute<{ name: string }>(sql`SELECT name FROM payload_migrations`)
    const tables = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`)
    const names = new Set(tables.rows.map(row => row.tablename))
    if (!['pages', 'knowledge', 'site', 'leads'].every(table => names.has(table))) throw new Error('Use complete migrations for a new database')
    const analytics = ['analytics_visitors', 'analytics_sessions', 'analytics_events']
    if (history.rows.some(row => row.name === name)) {
      if (!analytics.every(table => names.has(table))) throw new Error('Migration history and schema disagree; no changes made')
      console.log('Existing CMS upgrade already applied; content was not changed.'); return
    }
    const columns = await db.execute(sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='knowledge' AND column_name='evidence') OR (table_name='site' AND column_name='analytics_enabled'))`)
    if (analytics.some(table => names.has(table)) || columns.rows.length) throw new Error('Partial schema detected; restore/review it before continuing')
    await up({ db, payload: p, req: await createLocalReq({}, p) })
    await db.execute(sql`INSERT INTO payload_migrations (name,batch) SELECT ${name},GREATEST(COALESCE(MAX(batch),0),0)+1 FROM payload_migrations`)
    console.log('Applied only the analytics/editorial metadata migration. Existing content and legacy history preserved; analytics remains disabled.')
  })
  if (process.argv.includes('--verify-baseline')) {
    const referenceName = process.env.AFARA_REFERENCE_DATABASE
    if (!referenceName || !/^afara_[a-z0-9_]+_acceptance$/.test(referenceName)) throw new Error('A separately migrated reference database ending _acceptance is required')
    const url = new URL(process.env.DATABASE_URL!)
    if (url.pathname === '/' + referenceName) throw new Error('Reference and working databases must differ')
    url.pathname = '/' + referenceName
    if (!p.db.pg) throw new Error('PostgreSQL driver required')
    const reference = new p.db.pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 3000 })
    try {
      const [schema, history] = await Promise.all([
        reference.query(schemaCatalogSQL),
        reference.query('SELECT name,batch FROM payload_migrations'),
      ])
      if (history.rows.some(row => row.batch < 0) || !migrations.every(migration => history.rows.some(row => row.name === migration.name))) throw new Error('Reference must have the full migration sequence and no schema-push history')
      await p.db.drizzle.transaction(async db => {
        await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('afara-upgrade-existing'))`)
        const actual = await db.execute(sql.raw(schemaCatalogSQL))
        if (!sameContent(actual.rows[0], schema.rows[0])) throw new Error('Schemas differ; migration history has not been adopted')
        const fingerprint = createHash('sha256').update(JSON.stringify(schema.rows[0])).digest('hex')
        const legacy = await db.execute(sql`SELECT name FROM payload_migrations WHERE batch=-1`)
        if (legacy.rows.some(row => row.name !== 'dev')) throw new Error('Unknown legacy migration marker; preserve it for review')
        if (legacy.rows.length) {
          await db.execute(sql`UPDATE payload_migrations SET name='legacy-schema-push-verified-20261018',batch=0 WHERE name='dev' AND batch=-1`)
          for (const migration of migrations) await db.execute(sql`INSERT INTO payload_migrations (name,batch) SELECT ${migration.name},1 WHERE NOT EXISTS(SELECT 1 FROM payload_migrations WHERE name=${migration.name})`)
          await db.execute(sql`INSERT INTO audit (actor,action,object,version) VALUES ('deployment-cli','confirm-schema-baseline','payload-migrations',${fingerprint})`)
        }
        console.log('Verified complete schema parity with the independently migrated reference. Migration baseline:', fingerprint)
      })
    } finally { await reference.end() }
  }
} finally { await p.destroy() }
process.exit(0)
