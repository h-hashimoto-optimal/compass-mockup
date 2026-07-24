ALTER TABLE "tenant_monitoring_settings" ADD COLUMN "auto_stop_on_loss" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_monitoring_settings" ADD COLUMN "auto_stop_on_oos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_monitoring_settings" ADD COLUMN "auto_stop_min_age_min" integer DEFAULT 30 NOT NULL;