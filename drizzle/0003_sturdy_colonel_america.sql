ALTER TABLE `participants` ADD `claimCode` varchar(32);--> statement-breakpoint
ALTER TABLE `participants` ADD `deliveryStatus` enum('pending','sent','delivered','cancelled') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `deliverySentAt` timestamp;--> statement-breakpoint
ALTER TABLE `participants` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `prizes` ADD `internalCode` varchar(64);--> statement-breakpoint
ALTER TABLE `prizes` ADD `deliveryType` enum('digital','physical','coupon','advice') DEFAULT 'digital' NOT NULL;--> statement-breakpoint
ALTER TABLE `prizes` ADD `maxDaily` int;--> statement-breakpoint
ALTER TABLE `participants` ADD CONSTRAINT `participants_claimCode_unique` UNIQUE(`claimCode`);