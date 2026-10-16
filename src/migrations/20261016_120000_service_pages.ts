import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_pages_type" ADD VALUE IF NOT EXISTS 'service'`)
  await db.execute(sql`ALTER TYPE "public"."enum__pages_v_version_type" ADD VALUE IF NOT EXISTS 'service'`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot remove a used enum value safely without rewriting user data.
  await db.execute(sql`SELECT 1`)
}
