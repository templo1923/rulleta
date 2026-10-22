ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','blocked') DEFAULT 'active' NOT NULL;