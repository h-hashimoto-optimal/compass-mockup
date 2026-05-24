CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_listing_id" uuid,
	"source_product_id" uuid,
	"type" text NOT NULL,
	"detail" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_product_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"channel_product_id" text,
	"channel_item_id" text,
	"title_ja" text,
	"title_translated" text,
	"list_price" integer,
	"list_currency" text DEFAULT 'KRW' NOT NULL,
	"source_price_jpy_at_list" integer,
	"floor_price_jpy" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"rejected_reason" text,
	"channel_meta" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"date" text PRIMARY KEY NOT NULL,
	"jpy_to_krw" numeric(12, 6),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"brand" text NOT NULL,
	"level" text DEFAULT 'warn' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"tenant_id" uuid,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ng_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"word" text NOT NULL,
	"mode" text DEFAULT 'block' NOT NULL,
	"replacement" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_product_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_price_jpy" integer,
	"source_in_stock" boolean
);
--> statement-breakpoint
CREATE TABLE "source_blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_product_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_product_id" text NOT NULL,
	"url" text,
	"last_price_jpy" integer,
	"last_in_stock" boolean,
	"last_checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"tier" text DEFAULT 'warm' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_channel_settings" (
	"tenant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"sell_fee_rate" numeric(6, 4) DEFAULT '0.11' NOT NULL,
	"price_rounding" integer DEFAULT 10 NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_channel_settings_tenant_id_channel_pk" PRIMARY KEY("tenant_id","channel")
);
--> statement-breakpoint
CREATE TABLE "tenant_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"secrets_enc" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"margin_rate" numeric(6, 4) DEFAULT '0.25' NOT NULL,
	"fx_buffer" numeric(6, 4) DEFAULT '0.03' NOT NULL,
	"domestic_shipping_jpy" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_channel_listing_id_channel_listings_id_fk" FOREIGN KEY ("channel_listing_id") REFERENCES "public"."channel_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_source_product_id_source_products_id_fk" FOREIGN KEY ("source_product_id") REFERENCES "public"."source_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_brands" ADD CONSTRAINT "ip_brands_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ng_words" ADD CONSTRAINT "ng_words_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_blacklist" ADD CONSTRAINT "source_blacklist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_channel_settings" ADD CONSTRAINT "tenant_channel_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_tenant_status_idx" ON "alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_listings_uq" ON "channel_listings" USING btree ("tenant_id","source_product_id","channel") WHERE "channel_listings"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "channel_listings_tenant_status_idx" ON "channel_listings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "channel_listings_source_idx" ON "channel_listings" USING btree ("source_product_id");--> statement-breakpoint
CREATE INDEX "ip_brands_tenant_idx" ON "ip_brands" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ng_words_tenant_word_uq" ON "ng_words" USING btree ("tenant_id","word");--> statement-breakpoint
CREATE INDEX "price_events_source_time_idx" ON "price_events" USING btree ("source_product_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_blacklist_uq" ON "source_blacklist" USING btree ("tenant_id","source","source_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_products_source_id_uq" ON "source_products" USING btree ("source","source_product_id");--> statement-breakpoint
CREATE INDEX "source_products_next_check_idx" ON "source_products" USING btree ("next_check_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_integrations_kind_uq" ON "tenant_integrations" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_channel_listings_updated_at BEFORE UPDATE ON "channel_listings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_tenant_integrations_updated_at BEFORE UPDATE ON "tenant_integrations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_tenant_settings_updated_at BEFORE UPDATE ON "tenant_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER trg_tenant_channel_settings_updated_at BEFORE UPDATE ON "tenant_channel_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();