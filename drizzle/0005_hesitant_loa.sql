ALTER TABLE "channel_listings" ADD COLUMN "coupang_approval_status" text;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD COLUMN "coupang_sales_status" text;--> statement-breakpoint
-- 旧ステータスを新ローカル段階へ移行（pending=出品準備済→ready=送信待ち）
UPDATE "channel_listings" SET "status" = 'ready' WHERE "status" = 'pending';