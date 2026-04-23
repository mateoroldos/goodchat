CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_run_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"ai_run_id" text NOT NULL,
	"tool_call_id" text,
	"tool_name" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"input" jsonb,
	"output" jsonb,
	"error" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"assistant_message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"finish_reason" text,
	"had_error" boolean NOT NULL,
	"error_code" text,
	"error_message" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"duration_ms" integer,
	"usage" jsonb,
	"provider_metadata" jsonb,
	"created_at" text NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;