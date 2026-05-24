CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"channel_order_id" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"buyer_name" text,
	"total_amount" integer,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"ordered_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_monitoring_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"detect_loss" boolean DEFAULT true NOT NULL,
	"detect_oos" boolean DEFAULT true NOT NULL,
	"loss_buffer_pct" numeric(6, 4) DEFAULT '0' NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL,
	"notify_chatwork" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_monitoring_settings" ADD CONSTRAINT "tenant_monitoring_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_uq" ON "orders" USING btree ("tenant_id","channel","channel_order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");