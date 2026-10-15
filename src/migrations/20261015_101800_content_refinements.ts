import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "redirects" (
    "id" serial PRIMARY KEY NOT NULL,
    "from" varchar NOT NULL,
    "target_id" integer NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "pages_sections_cards" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "pages_sections" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "pages" ADD COLUMN "hero_alt" varchar;
  ALTER TABLE "_pages_v_version_sections_cards" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "_pages_v_version_sections" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_alt" varchar;
  ALTER TABLE "leads" ADD COLUMN "archived" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "redirects_id" integer;
  ALTER TABLE "redirects" ADD CONSTRAINT "redirects_target_id_pages_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_target_idx" ON "redirects" USING btree ("target_id");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leads_archived_idx" ON "leads" USING btree ("archived");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "redirects" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "redirects" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redirects_fk";

  DROP INDEX "leads_archived_idx";
  DROP INDEX "payload_locked_documents_rels_redirects_id_idx";
  ALTER TABLE "pages_sections_cards" DROP COLUMN "image_alt";
  ALTER TABLE "pages_sections" DROP COLUMN "image_alt";
  ALTER TABLE "pages" DROP COLUMN "hero_alt";
  ALTER TABLE "_pages_v_version_sections_cards" DROP COLUMN "image_alt";
  ALTER TABLE "_pages_v_version_sections" DROP COLUMN "image_alt";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_alt";
  ALTER TABLE "leads" DROP COLUMN "archived";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "redirects_id";`)
}
