CREATE TABLE `ai_run_tool_calls` (
	`id` varchar(191) NOT NULL,
	`ai_run_id` text NOT NULL,
	`tool_call_id` text,
	`tool_name` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` int,
	`input` json,
	`output` json,
	`error` json,
	`created_at` text NOT NULL,
	CONSTRAINT `ai_run_tool_calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_runs` (
	`id` varchar(191) NOT NULL,
	`thread_id` text NOT NULL,
	`assistant_message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`finish_reason` text,
	`had_error` boolean NOT NULL,
	`error_code` text,
	`error_message` text,
	`input_tokens` int,
	`output_tokens` int,
	`total_tokens` int,
	`duration_ms` int,
	`usage` json,
	`provider_metadata` json,
	`created_at` text NOT NULL,
	`finished_at` text,
	CONSTRAINT `ai_runs_id` PRIMARY KEY(`id`)
);
