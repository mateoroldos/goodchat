CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text,
	"text" text NOT NULL,
	"created_at" text NOT NULL,
	"metadata" jsonb,
	"user_id" text NOT NULL,
	"adapter_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"bot_name" text NOT NULL,
	"platform" text NOT NULL,
	"adapter_name" text NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"response_text" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_activity_at" text NOT NULL
);
