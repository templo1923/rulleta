CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(180) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`settings` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaigns_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`whatsapp` varchar(40) NOT NULL,
	`email` varchar(320) NOT NULL,
	`normalizedEmail` varchar(320) NOT NULL,
	`normalizedWhatsapp` varchar(40) NOT NULL,
	`status` enum('registered','spun','claimed') NOT NULL DEFAULT 'registered',
	`prizeId` int,
	`prizeTitle` varchar(180),
	`spinCount` int NOT NULL DEFAULT 0,
	`bonusUsed` int NOT NULL DEFAULT 0,
	`photoUrl` text,
	`advice` int NOT NULL DEFAULT 0,
	`platform` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`spunAt` timestamp,
	`claimedAt` timestamp,
	CONSTRAINT `participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `participants_campaign_email_uq` UNIQUE(`campaignId`,`normalizedEmail`),
	CONSTRAINT `participants_campaign_whatsapp_uq` UNIQUE(`campaignId`,`normalizedWhatsapp`)
);
--> statement-breakpoint
CREATE TABLE `prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`subtitle` varchar(120) NOT NULL,
	`icon` varchar(16) NOT NULL,
	`kind` enum('win','retry','again') NOT NULL DEFAULT 'win',
	`weight` int NOT NULL DEFAULT 1,
	`stock` int,
	`active` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `participants_campaign_status_idx` ON `participants` (`campaignId`,`status`);--> statement-breakpoint
CREATE INDEX `prizes_campaign_idx` ON `prizes` (`campaignId`);