CREATE TABLE "cs_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text DEFAULT 'coupang' NOT NULL,
	"channel_inquiry_id" text NOT NULL,
	"type" text,
	"content" text,
	"status" text DEFAULT 'open' NOT NULL,
	"received_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text DEFAULT 'coupang' NOT NULL,
	"receipt_id" text NOT NULL,
	"channel_order_id" text,
	"reason" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cs_inquiries" ADD CONSTRAINT "cs_inquiries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cs_inquiries_uq" ON "cs_inquiries" USING btree ("tenant_id","channel","channel_inquiry_id");--> statement-breakpoint
CREATE INDEX "cs_inquiries_tenant_idx" ON "cs_inquiries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_uq" ON "return_requests" USING btree ("tenant_id","channel","receipt_id");--> statement-breakpoint
CREATE INDEX "return_requests_tenant_idx" ON "return_requests" USING btree ("tenant_id","status");