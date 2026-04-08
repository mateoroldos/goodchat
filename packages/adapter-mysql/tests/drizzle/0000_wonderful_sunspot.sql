CREATE TABLE `goodchat_messages` (
	`id` varchar(191) NOT NULL,
	`thread_id` text NOT NULL,
	`role` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`metadata` json,
	`user_id` text NOT NULL,
	`adapter_name` text NOT NULL,
	CONSTRAINT `goodchat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goodchat_threads` (
	`id` varchar(191) NOT NULL,
	`bot_id` text NOT NULL,
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
	CONSTRAINT `goodchat_threads_id` PRIMARY KEY(`id`)
);
