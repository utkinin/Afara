import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('ADMIN', 'EDITOR');
  CREATE TYPE "public"."enum_media_origin" AS ENUM('work', 'concept', 'ai');
  CREATE TYPE "public"."enum_media_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__media_v_version_origin" AS ENUM('work', 'concept', 'ai');
  CREATE TYPE "public"."enum__media_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_sections_kind" AS ENUM('spaces', 'compositions', 'details', 'materials', 'process', 'conditions', 'faq');
  CREATE TYPE "public"."enum_pages_type" AS ENUM('home', 'overview', 'direction');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_sections_kind" AS ENUM('spaces', 'compositions', 'details', 'materials', 'process', 'conditions', 'faq');
  CREATE TYPE "public"."enum__pages_v_version_type" AS ENUM('home', 'overview', 'direction');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_documents_kind" AS ENUM('privacy', 'consent');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__documents_v_version_kind" AS ENUM('privacy', 'consent');
  CREATE TYPE "public"."enum__documents_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'active', 'closed', 'spam');
  CREATE TYPE "public"."enum_leads_delivery_status" AS ENUM('pending', 'processing', 'sent', 'failed');
  CREATE TYPE "public"."enum_site_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "users_sessions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "created_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "role" "enum_users_role" DEFAULT 'EDITOR' NOT NULL,
    "name" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "email" varchar NOT NULL,
    "reset_password_token" varchar,
    "reset_password_expiration" timestamp(3) with time zone,
    "salt" varchar,
    "hash" varchar,
    "reset_password_requested_at" timestamp(3) with time zone,
    "login_attempts" numeric DEFAULT 0,
    "lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "media" (
    "id" serial PRIMARY KEY NOT NULL,
    "alt" varchar,
    "caption" varchar,
    "origin" "enum_media_origin",
    "source" varchar,
    "rights_confirmed" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_media_status" DEFAULT 'draft',
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric,
    "sizes_thumb_url" varchar,
    "sizes_thumb_width" numeric,
    "sizes_thumb_height" numeric,
    "sizes_thumb_mime_type" varchar,
    "sizes_thumb_filesize" numeric,
    "sizes_thumb_filename" varchar,
    "sizes_tablet_url" varchar,
    "sizes_tablet_width" numeric,
    "sizes_tablet_height" numeric,
    "sizes_tablet_mime_type" varchar,
    "sizes_tablet_filesize" numeric,
    "sizes_tablet_filename" varchar,
    "sizes_wide_url" varchar,
    "sizes_wide_width" numeric,
    "sizes_wide_height" numeric,
    "sizes_wide_mime_type" varchar,
    "sizes_wide_filesize" numeric,
    "sizes_wide_filename" varchar
  );

  CREATE TABLE "_media_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_alt" varchar,
    "version_caption" varchar,
    "version_origin" "enum__media_v_version_origin",
    "version_source" varchar,
    "version_rights_confirmed" boolean DEFAULT false,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__media_v_version_status" DEFAULT 'draft',
    "version_url" varchar,
    "version_thumbnail_u_r_l" varchar,
    "version_filename" varchar,
    "version_mime_type" varchar,
    "version_filesize" numeric,
    "version_width" numeric,
    "version_height" numeric,
    "version_focal_x" numeric,
    "version_focal_y" numeric,
    "version_sizes_thumb_url" varchar,
    "version_sizes_thumb_width" numeric,
    "version_sizes_thumb_height" numeric,
    "version_sizes_thumb_mime_type" varchar,
    "version_sizes_thumb_filesize" numeric,
    "version_sizes_thumb_filename" varchar,
    "version_sizes_tablet_url" varchar,
    "version_sizes_tablet_width" numeric,
    "version_sizes_tablet_height" numeric,
    "version_sizes_tablet_mime_type" varchar,
    "version_sizes_tablet_filesize" numeric,
    "version_sizes_tablet_filename" varchar,
    "version_sizes_wide_url" varchar,
    "version_sizes_wide_width" numeric,
    "version_sizes_wide_height" numeric,
    "version_sizes_wide_mime_type" varchar,
    "version_sizes_wide_filesize" numeric,
    "version_sizes_wide_filename" varchar,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "pages_sections_cards" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "image_id" integer,
    "page_id" integer,
    "link_label" varchar
  );

  CREATE TABLE "pages_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "kind" "enum_pages_sections_kind",
    "visible" boolean DEFAULT true,
    "anchor" varchar,
    "kicker" varchar,
    "heading" varchar,
    "body" varchar,
    "image_id" integer
  );

  CREATE TABLE "pages" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "path" varchar,
    "type" "enum_pages_type",
    "parent_id" integer,
    "h1" varchar,
    "intro" varchar,
    "hero_id" integer,
    "hero_mobile_id" integer,
    "hero_position" numeric DEFAULT 65,
    "cta" varchar DEFAULT 'Обсудить проект',
    "details_label" varchar DEFAULT 'Рассмотреть детали',
    "concept_label" varchar,
    "seo_title" varchar,
    "seo_description" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_pages_status" DEFAULT 'draft'
  );

  CREATE TABLE "_pages_v_version_sections_cards" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "body" varchar,
    "image_id" integer,
    "page_id" integer,
    "link_label" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_pages_v_version_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "kind" "enum__pages_v_version_sections_kind",
    "visible" boolean DEFAULT true,
    "anchor" varchar,
    "kicker" varchar,
    "heading" varchar,
    "body" varchar,
    "image_id" integer,
    "_uuid" varchar
  );

  CREATE TABLE "_pages_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_title" varchar,
    "version_path" varchar,
    "version_type" "enum__pages_v_version_type",
    "version_parent_id" integer,
    "version_h1" varchar,
    "version_intro" varchar,
    "version_hero_id" integer,
    "version_hero_mobile_id" integer,
    "version_hero_position" numeric DEFAULT 65,
    "version_cta" varchar DEFAULT 'Обсудить проект',
    "version_details_label" varchar DEFAULT 'Рассмотреть детали',
    "version_concept_label" varchar,
    "version_seo_title" varchar,
    "version_seo_description" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__pages_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar,
    "title" varchar,
    "body" varchar,
    "version" varchar,
    "kind" "enum_documents_kind",
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_documents_status" DEFAULT 'draft'
  );

  CREATE TABLE "_documents_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_slug" varchar,
    "version_title" varchar,
    "version_body" varchar,
    "version_version" varchar,
    "version_kind" "enum__documents_v_version_kind",
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__documents_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "leads" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "contact" varchar NOT NULL,
    "channel" varchar NOT NULL,
    "space" varchar NOT NULL,
    "city" varchar NOT NULL,
    "description" varchar NOT NULL,
    "budget" varchar,
    "source" varchar NOT NULL,
    "consent_version" varchar NOT NULL,
    "consent_text" varchar NOT NULL,
    "idempotency_key" varchar NOT NULL,
    "request_hash" varchar NOT NULL,
    "status" "enum_leads_status" DEFAULT 'new',
    "notes" varchar,
    "delivery_status" "enum_leads_delivery_status" DEFAULT 'pending',
    "attempts" numeric DEFAULT 0,
    "retry_at" timestamp(3) with time zone,
    "lease_until" timestamp(3) with time zone,
    "lease_token" varchar,
    "delivery_error" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "audit" (
    "id" serial PRIMARY KEY NOT NULL,
    "actor" varchar,
    "action" varchar NOT NULL,
    "object" varchar,
    "version" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "rate_limits" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "count" numeric DEFAULT 1,
    "expires_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer,
    "media_id" integer,
    "pages_id" integer,
    "documents_id" integer,
    "leads_id" integer,
    "audit_id" integer,
    "rate_limits_id" integer
  );

  CREATE TABLE "payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "site_menu" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar,
    "anchor" varchar
  );

  CREATE TABLE "site_form_spaces" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar
  );

  CREATE TABLE "site" (
    "id" serial PRIMARY KEY NOT NULL,
    "brand" varchar DEFAULT 'AFARA',
    "tagline" varchar DEFAULT 'BESPOKE ATELIER',
    "phone" varchar,
    "email" varchar,
    "address" varchar,
    "geography" varchar,
    "hours" varchar,
    "form_heading" varchar,
    "form_intro" varchar,
    "form_step_one" varchar,
    "form_step_two" varchar,
    "form_space" varchar,
    "form_city" varchar,
    "form_description" varchar,
    "form_budget" varchar,
    "form_name" varchar,
    "form_channel" varchar,
    "form_phone" varchar,
    "form_email" varchar,
    "form_next" varchar,
    "form_back" varchar,
    "form_submit" varchar,
    "form_success" varchar,
    "form_again" varchar,
    "form_consent_label" varchar,
    "form_error" varchar,
    "footer_text" varchar,
    "_status" "enum_site_status" DEFAULT 'draft',
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  CREATE TABLE "_site_v_version_menu" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "label" varchar,
    "anchor" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_site_v_version_form_spaces" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "label" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_site_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "version_brand" varchar DEFAULT 'AFARA',
    "version_tagline" varchar DEFAULT 'BESPOKE ATELIER',
    "version_phone" varchar,
    "version_email" varchar,
    "version_address" varchar,
    "version_geography" varchar,
    "version_hours" varchar,
    "version_form_heading" varchar,
    "version_form_intro" varchar,
    "version_form_step_one" varchar,
    "version_form_step_two" varchar,
    "version_form_space" varchar,
    "version_form_city" varchar,
    "version_form_description" varchar,
    "version_form_budget" varchar,
    "version_form_name" varchar,
    "version_form_channel" varchar,
    "version_form_phone" varchar,
    "version_form_email" varchar,
    "version_form_next" varchar,
    "version_form_back" varchar,
    "version_form_submit" varchar,
    "version_form_success" varchar,
    "version_form_again" varchar,
    "version_form_consent_label" varchar,
    "version_form_error" varchar,
    "version_footer_text" varchar,
    "version__status" "enum__site_v_version_status" DEFAULT 'draft',
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "recipient" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_media_v" ADD CONSTRAINT "_media_v_parent_id_media_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_sections_cards" ADD CONSTRAINT "pages_sections_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_sections_cards" ADD CONSTRAINT "pages_sections_cards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_sections_cards" ADD CONSTRAINT "pages_sections_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_sections" ADD CONSTRAINT "pages_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_sections" ADD CONSTRAINT "pages_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_id_media_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_mobile_id_media_id_fk" FOREIGN KEY ("hero_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections_cards" ADD CONSTRAINT "_pages_v_version_sections_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections_cards" ADD CONSTRAINT "_pages_v_version_sections_cards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections_cards" ADD CONSTRAINT "_pages_v_version_sections_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_version_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections" ADD CONSTRAINT "_pages_v_version_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections" ADD CONSTRAINT "_pages_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_parent_id_pages_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_id_media_id_fk" FOREIGN KEY ("version_hero_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_mobile_id_media_id_fk" FOREIGN KEY ("version_hero_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_limits_fk" FOREIGN KEY ("rate_limits_id") REFERENCES "public"."rate_limits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_menu" ADD CONSTRAINT "site_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_form_spaces" ADD CONSTRAINT "site_form_spaces_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_menu" ADD CONSTRAINT "_site_v_version_menu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_v_version_form_spaces" ADD CONSTRAINT "_site_v_version_form_spaces_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE INDEX "media__status_idx" ON "media" USING btree ("_status");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_tablet_sizes_tablet_filename_idx" ON "media" USING btree ("sizes_tablet_filename");
  CREATE INDEX "media_sizes_wide_sizes_wide_filename_idx" ON "media" USING btree ("sizes_wide_filename");
  CREATE INDEX "_media_v_parent_idx" ON "_media_v" USING btree ("parent_id");
  CREATE INDEX "_media_v_version_version_updated_at_idx" ON "_media_v" USING btree ("version_updated_at");
  CREATE INDEX "_media_v_version_version_created_at_idx" ON "_media_v" USING btree ("version_created_at");
  CREATE INDEX "_media_v_version_version__status_idx" ON "_media_v" USING btree ("version__status");
  CREATE INDEX "_media_v_version_version_filename_idx" ON "_media_v" USING btree ("version_filename");
  CREATE INDEX "_media_v_version_sizes_thumb_version_sizes_thumb_filenam_idx" ON "_media_v" USING btree ("version_sizes_thumb_filename");
  CREATE INDEX "_media_v_version_sizes_tablet_version_sizes_tablet_filen_idx" ON "_media_v" USING btree ("version_sizes_tablet_filename");
  CREATE INDEX "_media_v_version_sizes_wide_version_sizes_wide_filename_idx" ON "_media_v" USING btree ("version_sizes_wide_filename");
  CREATE INDEX "_media_v_created_at_idx" ON "_media_v" USING btree ("created_at");
  CREATE INDEX "_media_v_updated_at_idx" ON "_media_v" USING btree ("updated_at");
  CREATE INDEX "_media_v_latest_idx" ON "_media_v" USING btree ("latest");
  CREATE INDEX "pages_sections_cards_order_idx" ON "pages_sections_cards" USING btree ("_order");
  CREATE INDEX "pages_sections_cards_parent_id_idx" ON "pages_sections_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_sections_cards_image_idx" ON "pages_sections_cards" USING btree ("image_id");
  CREATE INDEX "pages_sections_cards_page_idx" ON "pages_sections_cards" USING btree ("page_id");
  CREATE INDEX "pages_sections_order_idx" ON "pages_sections" USING btree ("_order");
  CREATE INDEX "pages_sections_parent_id_idx" ON "pages_sections" USING btree ("_parent_id");
  CREATE INDEX "pages_sections_image_idx" ON "pages_sections" USING btree ("image_id");
  CREATE UNIQUE INDEX "pages_path_idx" ON "pages" USING btree ("path");
  CREATE INDEX "pages_parent_idx" ON "pages" USING btree ("parent_id");
  CREATE INDEX "pages_hero_idx" ON "pages" USING btree ("hero_id");
  CREATE INDEX "pages_hero_mobile_idx" ON "pages" USING btree ("hero_mobile_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_version_sections_cards_order_idx" ON "_pages_v_version_sections_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_version_sections_cards_parent_id_idx" ON "_pages_v_version_sections_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_version_sections_cards_image_idx" ON "_pages_v_version_sections_cards" USING btree ("image_id");
  CREATE INDEX "_pages_v_version_sections_cards_page_idx" ON "_pages_v_version_sections_cards" USING btree ("page_id");
  CREATE INDEX "_pages_v_version_sections_order_idx" ON "_pages_v_version_sections" USING btree ("_order");
  CREATE INDEX "_pages_v_version_sections_parent_id_idx" ON "_pages_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_version_sections_image_idx" ON "_pages_v_version_sections" USING btree ("image_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_path_idx" ON "_pages_v" USING btree ("version_path");
  CREATE INDEX "_pages_v_version_version_parent_idx" ON "_pages_v" USING btree ("version_parent_id");
  CREATE INDEX "_pages_v_version_version_hero_idx" ON "_pages_v" USING btree ("version_hero_id");
  CREATE INDEX "_pages_v_version_version_hero_mobile_idx" ON "_pages_v" USING btree ("version_hero_mobile_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "documents_slug_idx" ON "documents" USING btree ("slug");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "documents__status_idx" ON "documents" USING btree ("_status");
  CREATE INDEX "_documents_v_parent_idx" ON "_documents_v" USING btree ("parent_id");
  CREATE INDEX "_documents_v_version_version_slug_idx" ON "_documents_v" USING btree ("version_slug");
  CREATE INDEX "_documents_v_version_version_updated_at_idx" ON "_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_documents_v_version_version_created_at_idx" ON "_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_documents_v_version_version__status_idx" ON "_documents_v" USING btree ("version__status");
  CREATE INDEX "_documents_v_created_at_idx" ON "_documents_v" USING btree ("created_at");
  CREATE INDEX "_documents_v_updated_at_idx" ON "_documents_v" USING btree ("updated_at");
  CREATE INDEX "_documents_v_latest_idx" ON "_documents_v" USING btree ("latest");
  CREATE UNIQUE INDEX "leads_idempotency_key_idx" ON "leads" USING btree ("idempotency_key");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX "audit_updated_at_idx" ON "audit" USING btree ("updated_at");
  CREATE INDEX "audit_created_at_idx" ON "audit" USING btree ("created_at");
  CREATE UNIQUE INDEX "rate_limits_key_idx" ON "rate_limits" USING btree ("key");
  CREATE INDEX "rate_limits_updated_at_idx" ON "rate_limits" USING btree ("updated_at");
  CREATE INDEX "rate_limits_created_at_idx" ON "rate_limits" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_id");
  CREATE INDEX "payload_locked_documents_rels_rate_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("rate_limits_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_menu_order_idx" ON "site_menu" USING btree ("_order");
  CREATE INDEX "site_menu_parent_id_idx" ON "site_menu" USING btree ("_parent_id");
  CREATE INDEX "site_form_spaces_order_idx" ON "site_form_spaces" USING btree ("_order");
  CREATE INDEX "site_form_spaces_parent_id_idx" ON "site_form_spaces" USING btree ("_parent_id");
  CREATE INDEX "site__status_idx" ON "site" USING btree ("_status");
  CREATE INDEX "_site_v_version_menu_order_idx" ON "_site_v_version_menu" USING btree ("_order");
  CREATE INDEX "_site_v_version_menu_parent_id_idx" ON "_site_v_version_menu" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_form_spaces_order_idx" ON "_site_v_version_form_spaces" USING btree ("_order");
  CREATE INDEX "_site_v_version_form_spaces_parent_id_idx" ON "_site_v_version_form_spaces" USING btree ("_parent_id");
  CREATE INDEX "_site_v_version_version__status_idx" ON "_site_v" USING btree ("version__status");
  CREATE INDEX "_site_v_created_at_idx" ON "_site_v" USING btree ("created_at");
  CREATE INDEX "_site_v_updated_at_idx" ON "_site_v" USING btree ("updated_at");
  CREATE INDEX "_site_v_latest_idx" ON "_site_v" USING btree ("latest");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "_media_v" CASCADE;
  DROP TABLE "pages_sections_cards" CASCADE;
  DROP TABLE "pages_sections" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_version_sections_cards" CASCADE;
  DROP TABLE "_pages_v_version_sections" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "_documents_v" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "audit" CASCADE;
  DROP TABLE "rate_limits" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_menu" CASCADE;
  DROP TABLE "site_form_spaces" CASCADE;
  DROP TABLE "site" CASCADE;
  DROP TABLE "_site_v_version_menu" CASCADE;
  DROP TABLE "_site_v_version_form_spaces" CASCADE;
  DROP TABLE "_site_v" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_media_origin";
  DROP TYPE "public"."enum_media_status";
  DROP TYPE "public"."enum__media_v_version_origin";
  DROP TYPE "public"."enum__media_v_version_status";
  DROP TYPE "public"."enum_pages_sections_kind";
  DROP TYPE "public"."enum_pages_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_sections_kind";
  DROP TYPE "public"."enum__pages_v_version_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_documents_kind";
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum__documents_v_version_kind";
  DROP TYPE "public"."enum__documents_v_version_status";
  DROP TYPE "public"."enum_leads_status";
  DROP TYPE "public"."enum_leads_delivery_status";
  DROP TYPE "public"."enum_site_status";
  DROP TYPE "public"."enum__site_v_version_status";`)
}
