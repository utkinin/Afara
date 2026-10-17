import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_documents_kind" ADD VALUE 'analytics';
  ALTER TYPE "public"."enum__documents_v_version_kind" ADD VALUE 'analytics';
  CREATE TABLE "analytics_visitors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"visitor_key" varchar NOT NULL,
  	"consented_at" timestamp(3) with time zone NOT NULL,
  	"consent_version" varchar NOT NULL,
  	"consent_text" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "analytics_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"session_key" varchar NOT NULL,
  	"visitor_id" integer NOT NULL,
  	"landing_path" varchar,
  	"source" varchar,
  	"source_type" varchar,
  	"referrer_host" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"utm_content" varchar,
  	"utm_term" varchar,
  	"search_term" varchar,
  	"query_kind" varchar,
  	"device" varchar,
  	"browser" varchar,
  	"os" varchar,
  	"country" varchar,
  	"last_seen" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "analytics_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_key" varchar NOT NULL,
  	"session_id" integer NOT NULL,
  	"visitor_id" integer NOT NULL,
  	"kind" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"label" varchar,
  	"active_ms" numeric DEFAULT 0,
  	"scroll_percent" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "knowledge" ADD COLUMN "evidence" varchar;
  ALTER TABLE "_knowledge_v" ADD COLUMN "version_evidence" varchar;
  ALTER TABLE "leads" ADD COLUMN "analytics_visitor_id" integer;
  ALTER TABLE "leads" ADD COLUMN "analytics_session_id" integer;
  ALTER TABLE "leads" ADD COLUMN "analytics_consent_version" varchar;
  ALTER TABLE "leads" ADD COLUMN "analytics_consent_text" varchar;
  ALTER TABLE "leads" ADD COLUMN "analytics_consent_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_visitors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "analytics_events_id" integer;
  ALTER TABLE "site" ADD COLUMN "analytics_enabled" boolean DEFAULT false;
  ALTER TABLE "_site_v" ADD COLUMN "version_analytics_enabled" boolean DEFAULT false;
  ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_visitor_id_analytics_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_analytics_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_visitor_id_analytics_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "analytics_visitors_visitor_key_idx" ON "analytics_visitors" USING btree ("visitor_key");
  CREATE INDEX "analytics_visitors_expires_at_idx" ON "analytics_visitors" USING btree ("expires_at");
  CREATE INDEX "analytics_visitors_updated_at_idx" ON "analytics_visitors" USING btree ("updated_at");
  CREATE INDEX "analytics_visitors_created_at_idx" ON "analytics_visitors" USING btree ("created_at");
  CREATE UNIQUE INDEX "analytics_sessions_session_key_idx" ON "analytics_sessions" USING btree ("session_key");
  CREATE INDEX "analytics_sessions_visitor_idx" ON "analytics_sessions" USING btree ("visitor_id");
  CREATE INDEX "analytics_sessions_last_seen_idx" ON "analytics_sessions" USING btree ("last_seen");
  CREATE INDEX "analytics_sessions_updated_at_idx" ON "analytics_sessions" USING btree ("updated_at");
  CREATE INDEX "analytics_sessions_created_at_idx" ON "analytics_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "analytics_events_event_key_idx" ON "analytics_events" USING btree ("event_key");
  CREATE INDEX "analytics_events_session_idx" ON "analytics_events" USING btree ("session_id");
  CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id");
  CREATE INDEX "analytics_events_updated_at_idx" ON "analytics_events" USING btree ("updated_at");
  CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");
  ALTER TABLE "leads" ADD CONSTRAINT "leads_analytics_visitor_id_analytics_visitors_id_fk" FOREIGN KEY ("analytics_visitor_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_analytics_session_id_analytics_sessions_id_fk" FOREIGN KEY ("analytics_session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_visitors_fk" FOREIGN KEY ("analytics_visitors_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_sessions_fk" FOREIGN KEY ("analytics_sessions_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_events_fk" FOREIGN KEY ("analytics_events_id") REFERENCES "public"."analytics_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leads_analytics_visitor_idx" ON "leads" USING btree ("analytics_visitor_id");
  CREATE INDEX "leads_analytics_session_idx" ON "leads" USING btree ("analytics_session_id");
  CREATE INDEX "payload_locked_documents_rels_analytics_visitors_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_visitors_id");
  CREATE INDEX "payload_locked_documents_rels_analytics_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_analytics_events_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_events_id");`)
}

export async function down(args: MigrateDownArgs): Promise<void> {
  void args
  throw new Error('Automatic analytics rollback would delete visit history and consent evidence. Disable analytics in Site settings; restore schema only through a separately reviewed backup/rollback procedure.')
}
