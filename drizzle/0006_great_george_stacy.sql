ALTER TABLE "channel_listings" ADD COLUMN "margin_override" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "channel_listings" ADD COLUMN "coupang_category_code" integer;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD COLUMN "coupang_category_name" text;