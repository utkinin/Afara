import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_knowledge_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__knowledge_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_works_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__works_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_trust_kind" AS ENUM('spaces', 'compositions', 'details', 'materials', 'process', 'conditions', 'faq');
  CREATE TYPE "public"."enum__site_v_version_trust_kind" AS ENUM('spaces', 'compositions', 'details', 'materials', 'process', 'conditions', 'faq');
  ALTER TYPE "public"."enum_pages_type" ADD VALUE 'contacts';
  ALTER TYPE "public"."enum__pages_v_version_type" ADD VALUE 'contacts';
  CREATE TABLE "knowledge" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"topic" varchar,
  	"keywords" varchar,
  	"page_id" integer,
  	"approved" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_knowledge_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_knowledge_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_question" varchar,
  	"version_answer" varchar,
  	"version_topic" varchar,
  	"version_keywords" varchar,
  	"version_page_id" integer,
  	"version_approved" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__knowledge_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "short_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"target_id" integer NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "works_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "works" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"task" varchar,
  	"space" varchar,
  	"solution" varchar,
  	"verified" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_works_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_works_v_version_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_works_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_task" varchar,
  	"version_space" varchar,
  	"version_solution" varchar,
  	"version_verified" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__works_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "site_messengers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "site_trust_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_alt" varchar,
  	"page_id" integer,
  	"link_label" varchar
  );
  
  CREATE TABLE "site_trust" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_site_trust_kind",
  	"visible" boolean DEFAULT true,
  	"anchor" varchar,
  	"kicker" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_alt" varchar
  );
  
  CREATE TABLE "_site_v_version_messengers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_v_version_trust_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_alt" varchar,
  	"page_id" integer,
  	"link_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_v_version_trust" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum__site_v_version_trust_kind",
  	"visible" boolean DEFAULT true,
  	"anchor" varchar,
  	"kicker" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_alt" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "pages" ADD COLUMN "service_confirmed" boolean DEFAULT false;
  ALTER TABLE "pages" ADD COLUMN "nav_order" numeric DEFAULT 0;
  ALTER TABLE "_pages_v" ADD COLUMN "version_service_confirmed" boolean DEFAULT false;
  ALTER TABLE "_pages_v" ADD COLUMN "version_nav_order" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "knowledge_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "short_links_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "works_id" integer;
  ALTER TABLE "site" ADD COLUMN "timezone" varchar;
  ALTER TABLE "site" ADD COLUMN "meeting" varchar;
  ALTER TABLE "site" ADD COLUMN "legal_details" varchar;
  ALTER TABLE "site" ADD COLUMN "studio_heading" varchar;
  ALTER TABLE "site" ADD COLUMN "studio_body" varchar;
  ALTER TABLE "site" ADD COLUMN "studio_name" varchar;
  ALTER TABLE "site" ADD COLUMN "studio_role" varchar;
  ALTER TABLE "site" ADD COLUMN "studio_photo_id" integer;
  ALTER TABLE "site" ADD COLUMN "studio_verified" boolean DEFAULT false;
  ALTER TABLE "site" ADD COLUMN "works_heading" varchar;
  ALTER TABLE "site" ADD COLUMN "contacts_label" varchar DEFAULT 'Контакты';
  ALTER TABLE "site" ADD COLUMN "assistant_enabled" boolean DEFAULT false;
  ALTER TABLE "site" ADD COLUMN "assistant_title" varchar DEFAULT 'Задать вопрос';
  ALTER TABLE "site" ADD COLUMN "assistant_intro" varchar DEFAULT 'Ответы по опубликованным материалам AFARA со ссылками на источники. Не вводите личные данные. Чтобы передать контакт, воспользуйтесь формой заявки.';
  ALTER TABLE "site" ADD COLUMN "assistant_placeholder" varchar DEFAULT 'Что вы хотите узнать о работе AFARA?';
  ALTER TABLE "_site_v" ADD COLUMN "version_timezone" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_meeting" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_legal_details" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_heading" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_body" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_name" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_role" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_photo_id" integer;
  ALTER TABLE "_site_v" ADD COLUMN "version_studio_verified" boolean DEFAULT false;
  ALTER TABLE "_site_v" ADD COLUMN "version_works_heading" varchar;
  ALTER TABLE "_site_v" ADD COLUMN "version_contacts_label" varchar DEFAULT 'Контакты';
  ALTER TABLE "_site_v" ADD COLUMN "version_assistant_enabled" boolean DEFAULT false;
  ALTER TABLE "_site_v" ADD COLUMN "version_assistant_title" varchar DEFAULT 'Задать вопрос';
  ALTER TABLE "_site_v" ADD COLUMN "version_assistant_intro" varchar DEFAULT 'Ответы по опубликованным материалам AFARA со ссылками на источники. Не вводите личные данные. Чтобы передать контакт, воспользуйтесь формой заявки.';
  ALTER TABLE "_site_v" ADD COLUMN "version_assistant_placeholder" varchar DEFAULT 'Что вы хотите узнать о работе AFARA?';
  ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_knowledge_v" ADD CONSTRAINT "_knowledge_v_parent_id_knowledge_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_knowledge_v" ADD CONSTRAINT "_knowledge_v_version_page_id_pages_id_fk" FOREIGN KEY ("version_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "short_links" ADD CONSTRAINT "short_links_target_id_pages_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "works_photos" ADD CONSTRAINT "works_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "works_photos" ADD CONSTRAINT "works_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_works_v_version_photos" ADD CONSTRAINT "_works_v_version_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_works_v_version_photos" ADD CONSTRAINT "_works_v_version_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_works_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_works_v" ADD CONSTRAINT "_works_v_parent_id_works_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."works"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_messengers" ADD CONSTRAINT "site_messengers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_trust_cards" ADD CONSTRAINT "site_trust_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_trust_cards" ADD CONSTRAINT "site_trust_cards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_trust_cards" ADD CONSTRAINT "site_trust_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_trust"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_trust" ADD CONSTRAINT "site_trust_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_trust" ADD CONSTRAINT "site_trust_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_messengers" ADD CONSTRAINT "_site_v_version_messengers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_trust_cards" ADD CONSTRAINT "_site_v_version_trust_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v_version_trust_cards" ADD CONSTRAINT "_site_v_version_trust_cards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v_version_trust_cards" ADD CONSTRAINT "_site_v_version_trust_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v_version_trust"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_trust" ADD CONSTRAINT "_site_v_version_trust_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v_version_trust" ADD CONSTRAINT "_site_v_version_trust_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  UPDATE "pages" SET "service_confirmed"=true WHERE "_status"='published' AND "type" IN ('overview','direction');
  UPDATE "_pages_v" SET "version_service_confirmed"=true WHERE "parent_id" IN (SELECT id FROM pages WHERE service_confirmed=true);
  CREATE INDEX "knowledge_public_search_idx" ON "knowledge" USING gin(to_tsvector('russian', question || ' ' || COALESCE(keywords, '') || ' ' || answer)) WHERE _status='published' AND approved IS TRUE;
  CREATE INDEX "knowledge_topic_idx" ON "knowledge" USING btree ("topic");
  CREATE INDEX "knowledge_page_idx" ON "knowledge" USING btree ("page_id");
  CREATE INDEX "knowledge_updated_at_idx" ON "knowledge" USING btree ("updated_at");
  CREATE INDEX "knowledge_created_at_idx" ON "knowledge" USING btree ("created_at");
  CREATE INDEX "knowledge__status_idx" ON "knowledge" USING btree ("_status");
  CREATE INDEX "_knowledge_v_parent_idx" ON "_knowledge_v" USING btree ("parent_id");
  CREATE INDEX "_knowledge_v_version_version_topic_idx" ON "_knowledge_v" USING btree ("version_topic");
  CREATE INDEX "_knowledge_v_version_version_page_idx" ON "_knowledge_v" USING btree ("version_page_id");
  CREATE INDEX "_knowledge_v_version_version_updated_at_idx" ON "_knowledge_v" USING btree ("version_updated_at");
  CREATE INDEX "_knowledge_v_version_version_created_at_idx" ON "_knowledge_v" USING btree ("version_created_at");
  CREATE INDEX "_knowledge_v_version_version__status_idx" ON "_knowledge_v" USING btree ("version__status");
  CREATE INDEX "_knowledge_v_created_at_idx" ON "_knowledge_v" USING btree ("created_at");
  CREATE INDEX "_knowledge_v_updated_at_idx" ON "_knowledge_v" USING btree ("updated_at");
  CREATE INDEX "_knowledge_v_latest_idx" ON "_knowledge_v" USING btree ("latest");
  CREATE UNIQUE INDEX "short_links_slug_idx" ON "short_links" USING btree ("slug");
  CREATE INDEX "short_links_target_idx" ON "short_links" USING btree ("target_id");
  CREATE INDEX "short_links_updated_at_idx" ON "short_links" USING btree ("updated_at");
  CREATE INDEX "short_links_created_at_idx" ON "short_links" USING btree ("created_at");
  CREATE INDEX "works_photos_order_idx" ON "works_photos" USING btree ("_order");
  CREATE INDEX "works_photos_parent_id_idx" ON "works_photos" USING btree ("_parent_id");
  CREATE INDEX "works_photos_image_idx" ON "works_photos" USING btree ("image_id");
  CREATE INDEX "works_updated_at_idx" ON "works" USING btree ("updated_at");
  CREATE INDEX "works_created_at_idx" ON "works" USING btree ("created_at");
  CREATE INDEX "works__status_idx" ON "works" USING btree ("_status");
  CREATE INDEX "_works_v_version_photos_order_idx" ON "_works_v_version_photos" USING btree ("_order");
  CREATE INDEX "_works_v_version_photos_parent_id_idx" ON "_works_v_version_photos" USING btree ("_parent_id");
  CREATE INDEX "_works_v_version_photos_image_idx" ON "_works_v_version_photos" USING btree ("image_id");
  CREATE INDEX "_works_v_parent_idx" ON "_works_v" USING btree ("parent_id");
  CREATE INDEX "_works_v_version_version_updated_at_idx" ON "_works_v" USING btree ("version_updated_at");
  CREATE INDEX "_works_v_version_version_created_at_idx" ON "_works_v" USING btree ("version_created_at");
  CREATE INDEX "_works_v_version_version__status_idx" ON "_works_v" USING btree ("version__status");
  CREATE INDEX "_works_v_created_at_idx" ON "_works_v" USING btree ("created_at");
  CREATE INDEX "_works_v_updated_at_idx" ON "_works_v" USING btree ("updated_at");
  CREATE INDEX "_works_v_latest_idx" ON "_works_v" USING btree ("latest");
  CREATE INDEX "site_messengers_order_idx" ON "site_messengers" USING btree ("_order");
  CREATE INDEX "site_messengers_parent_id_idx" ON "site_messengers" USING btree ("_parent_id");
  CREATE INDEX "site_trust_cards_order_idx" ON "site_trust_cards" USING btree ("_order");
  CREATE INDEX "site_trust_cards_parent_id_idx" ON "site_trust_cards" USING btree ("_parent_id");
  CREATE INDEX "site_trust_cards_image_idx" ON "site_trust_cards" USING btree ("image_id");
  CREATE INDEX "site_trust_cards_page_idx" ON "site_trust_cards" USING btree ("page_id");
  CREATE INDEX "site_trust_order_idx" ON "site_trust" USING btree ("_order");
  CREATE INDEX "site_trust_parent_id_idx" ON "site_trust" USING btree ("_parent_id");
  CREATE INDEX "site_trust_image_idx" ON "site_trust" USING btree ("image_id");
  CREATE INDEX "_site_v_version_messengers_order_idx" ON "_site_v_version_messengers" USING btree ("_order");
  CREATE INDEX "_site_v_version_messengers_parent_id_idx" ON "_site_v_version_messengers" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_trust_cards_order_idx" ON "_site_v_version_trust_cards" USING btree ("_order");
  CREATE INDEX "_site_v_version_trust_cards_parent_id_idx" ON "_site_v_version_trust_cards" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_trust_cards_image_idx" ON "_site_v_version_trust_cards" USING btree ("image_id");
  CREATE INDEX "_site_v_version_trust_cards_page_idx" ON "_site_v_version_trust_cards" USING btree ("page_id");
  CREATE INDEX "_site_v_version_trust_order_idx" ON "_site_v_version_trust" USING btree ("_order");
  CREATE INDEX "_site_v_version_trust_parent_id_idx" ON "_site_v_version_trust" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_trust_image_idx" ON "_site_v_version_trust" USING btree ("image_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_knowledge_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_short_links_fk" FOREIGN KEY ("short_links_id") REFERENCES "public"."short_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_works_fk" FOREIGN KEY ("works_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_studio_photo_id_media_id_fk" FOREIGN KEY ("studio_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_v" ADD CONSTRAINT "_site_v_version_studio_photo_id_media_id_fk" FOREIGN KEY ("version_studio_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_knowledge_id_idx" ON "payload_locked_documents_rels" USING btree ("knowledge_id");
  CREATE INDEX "payload_locked_documents_rels_short_links_id_idx" ON "payload_locked_documents_rels" USING btree ("short_links_id");
  CREATE INDEX "payload_locked_documents_rels_works_id_idx" ON "payload_locked_documents_rels" USING btree ("works_id");
  CREATE INDEX "site_studio_studio_photo_idx" ON "site" USING btree ("studio_photo_id");
  CREATE INDEX "_site_v_version_studio_version_studio_photo_idx" ON "_site_v" USING btree ("version_studio_photo_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "knowledge_public_search_idx";
   ALTER TABLE "knowledge" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_knowledge_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "short_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "works_photos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "works" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_works_v_version_photos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_works_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_messengers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_trust_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_trust" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_messengers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_trust_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_v_version_trust" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "knowledge" CASCADE;
  DROP TABLE "_knowledge_v" CASCADE;
  DROP TABLE "short_links" CASCADE;
  DROP TABLE "works_photos" CASCADE;
  DROP TABLE "works" CASCADE;
  DROP TABLE "_works_v_version_photos" CASCADE;
  DROP TABLE "_works_v" CASCADE;
  DROP TABLE "site_messengers" CASCADE;
  DROP TABLE "site_trust_cards" CASCADE;
  DROP TABLE "site_trust" CASCADE;
  DROP TABLE "_site_v_version_messengers" CASCADE;
  DROP TABLE "_site_v_version_trust_cards" CASCADE;
  DROP TABLE "_site_v_version_trust" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_knowledge_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_short_links_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_works_fk";
  
  ALTER TABLE "site" DROP CONSTRAINT "site_studio_photo_id_media_id_fk";
  
  ALTER TABLE "_site_v" DROP CONSTRAINT "_site_v_version_studio_photo_id_media_id_fk";
  
  ALTER TABLE "pages" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_pages_type";
  CREATE TYPE "public"."enum_pages_type" AS ENUM('home', 'overview', 'direction');
  ALTER TABLE "pages" ALTER COLUMN "type" SET DATA TYPE "public"."enum_pages_type" USING "type"::"public"."enum_pages_type";
  ALTER TABLE "_pages_v" ALTER COLUMN "version_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__pages_v_version_type";
  CREATE TYPE "public"."enum__pages_v_version_type" AS ENUM('home', 'overview', 'direction');
  ALTER TABLE "_pages_v" ALTER COLUMN "version_type" SET DATA TYPE "public"."enum__pages_v_version_type" USING "version_type"::"public"."enum__pages_v_version_type";
  DROP INDEX "payload_locked_documents_rels_knowledge_id_idx";
  DROP INDEX "payload_locked_documents_rels_short_links_id_idx";
  DROP INDEX "payload_locked_documents_rels_works_id_idx";
  DROP INDEX "site_studio_studio_photo_idx";
  DROP INDEX "_site_v_version_studio_version_studio_photo_idx";
  ALTER TABLE "pages" DROP COLUMN "service_confirmed";
  ALTER TABLE "pages" DROP COLUMN "nav_order";
  ALTER TABLE "_pages_v" DROP COLUMN "version_service_confirmed";
  ALTER TABLE "_pages_v" DROP COLUMN "version_nav_order";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "knowledge_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "short_links_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "works_id";
  ALTER TABLE "site" DROP COLUMN "timezone";
  ALTER TABLE "site" DROP COLUMN "meeting";
  ALTER TABLE "site" DROP COLUMN "legal_details";
  ALTER TABLE "site" DROP COLUMN "studio_heading";
  ALTER TABLE "site" DROP COLUMN "studio_body";
  ALTER TABLE "site" DROP COLUMN "studio_name";
  ALTER TABLE "site" DROP COLUMN "studio_role";
  ALTER TABLE "site" DROP COLUMN "studio_photo_id";
  ALTER TABLE "site" DROP COLUMN "studio_verified";
  ALTER TABLE "site" DROP COLUMN "works_heading";
  ALTER TABLE "site" DROP COLUMN "contacts_label";
  ALTER TABLE "site" DROP COLUMN "assistant_enabled";
  ALTER TABLE "site" DROP COLUMN "assistant_title";
  ALTER TABLE "site" DROP COLUMN "assistant_intro";
  ALTER TABLE "site" DROP COLUMN "assistant_placeholder";
  ALTER TABLE "_site_v" DROP COLUMN "version_timezone";
  ALTER TABLE "_site_v" DROP COLUMN "version_meeting";
  ALTER TABLE "_site_v" DROP COLUMN "version_legal_details";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_heading";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_body";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_name";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_role";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_photo_id";
  ALTER TABLE "_site_v" DROP COLUMN "version_studio_verified";
  ALTER TABLE "_site_v" DROP COLUMN "version_works_heading";
  ALTER TABLE "_site_v" DROP COLUMN "version_contacts_label";
  ALTER TABLE "_site_v" DROP COLUMN "version_assistant_enabled";
  ALTER TABLE "_site_v" DROP COLUMN "version_assistant_title";
  ALTER TABLE "_site_v" DROP COLUMN "version_assistant_intro";
  ALTER TABLE "_site_v" DROP COLUMN "version_assistant_placeholder";
  DROP TYPE "public"."enum_knowledge_status";
  DROP TYPE "public"."enum__knowledge_v_version_status";
  DROP TYPE "public"."enum_works_status";
  DROP TYPE "public"."enum__works_v_version_status";
  DROP TYPE "public"."enum_site_trust_kind";
  DROP TYPE "public"."enum__site_v_version_trust_kind";`)
}
