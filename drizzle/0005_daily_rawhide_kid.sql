CREATE TABLE `claimPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`imageData` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claimPhotos_id` PRIMARY KEY(`id`),
	CONSTRAINT `claimPhotos_participantId_unique` UNIQUE(`participantId`)
);
