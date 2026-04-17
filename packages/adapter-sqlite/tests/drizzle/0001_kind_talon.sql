CREATE TABLE `ai_run_tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_run_id` text NOT NULL,
	`tool_call_id` text,
	`tool_name` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer,
	`input` text,
	`output` text,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`assistant_message_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`finish_reason` text,
	`had_error` integer NOT NULL,
	`error_code` text,
	`error_message` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`duration_ms` integer,
	`usage` text,
	`provider_metadata` text,
	`created_at` text NOT NULL,
	`finished_at` text
);
