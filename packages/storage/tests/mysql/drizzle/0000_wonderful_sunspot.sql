CREATE TABLE `messages` (
	`id` varchar(191) NOT NULL,
	`thread_id` text NOT NULL,
	`role` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`metadata` json,
	`user_id` text NOT NULL,
	`adapter_name` text NOT NULL,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` varchar(191) NOT NULL,
	`bot_name` text NOT NULL,
	`platform` text NOT NULL,
	`adapter_name` text NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`response_text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_activity_at` text NOT NULL,
	CONSTRAINT `threads_id` PRIMARY KEY(`id`)
);
