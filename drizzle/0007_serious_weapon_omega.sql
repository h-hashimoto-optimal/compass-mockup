ALTER TABLE "channel_listings" ADD COLUMN "weight_g_override" integer;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "shipping_rates_json" jsonb;