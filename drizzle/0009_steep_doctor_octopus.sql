CREATE TABLE "coupang_category_meta" (
	"display_category_code" integer PRIMARY KEY NOT NULL,
	"category_name" text,
	"notice_categories" jsonb,
	"attributes" jsonb,
	"required_documents" jsonb,
	"admissible" boolean,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
