CREATE TABLE "ingest_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text DEFAULT 'amazon' NOT NULL,
	"query" text,
	"url" text,
	"captured_at" timestamp with time zone,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_listings" ADD COLUMN "ingest_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "ingest_batches" ADD CONSTRAINT "ingest_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_batches_tenant_idx" ON "ingest_batches" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_ingest_batch_id_ingest_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batches"("id") ON DELETE set null ON UPDATE no action;