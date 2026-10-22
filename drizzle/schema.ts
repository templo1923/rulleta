import { index, int, json, longtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Internal identity key, for example local:email. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "blocked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  active: int("active").default(1).notNull(),
  settings: json("settings").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const prizes = mysqlTable("prizes", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subtitle: varchar("subtitle", { length: 120 }).notNull(),
  icon: varchar("icon", { length: 16 }).notNull(),
  kind: mysqlEnum("kind", ["win", "retry", "again"]).default("win").notNull(),
  internalCode: varchar("internalCode", { length: 64 }),
  deliveryType: mysqlEnum("deliveryType", ["digital", "physical", "coupon", "advice"]).default("digital").notNull(),
  weight: int("weight").default(1).notNull(),
  stock: int("stock"),
  maxDaily: int("maxDaily"),
  active: int("active").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => ({
  campaignIndex: index("prizes_campaign_idx").on(table.campaignId),
}));

export const participants = mysqlTable("participants", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  participationToken: varchar("participationToken", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 40 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  normalizedEmail: varchar("normalizedEmail", { length: 320 }).notNull(),
  normalizedWhatsapp: varchar("normalizedWhatsapp", { length: 40 }).notNull(),
  status: mysqlEnum("status", ["registered", "spun", "claimed"]).default("registered").notNull(),
  prizeId: int("prizeId"),
  prizeTitle: varchar("prizeTitle", { length: 180 }),
  claimCode: varchar("claimCode", { length: 32 }).unique(),
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "sent", "delivered", "cancelled"]).default("pending").notNull(),
  spinCount: int("spinCount").default(0).notNull(),
  bonusUsed: int("bonusUsed").default(0).notNull(),
  photoUrl: text("photoUrl"),
  advice: int("advice").default(0).notNull(),
  platform: varchar("platform", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  spunAt: timestamp("spunAt"),
  claimedAt: timestamp("claimedAt"),
  deliverySentAt: timestamp("deliverySentAt"),
  deliveredAt: timestamp("deliveredAt"),
}, table => ({
  campaignEmailIndex: uniqueIndex("participants_campaign_email_uq").on(table.campaignId, table.normalizedEmail),
  campaignWhatsappIndex: uniqueIndex("participants_campaign_whatsapp_uq").on(table.campaignId, table.normalizedWhatsapp),
  campaignStatusIndex: index("participants_campaign_status_idx").on(table.campaignId, table.status),
}));

export const claimPhotos = mysqlTable("claimPhotos", {
  id: int("id").autoincrement().primaryKey(),
  participantId: int("participantId").notNull().unique(),
  mimeType: varchar("mimeType", { length: 80 }).notNull(),
  imageData: longtext("imageData").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type Prize = typeof prizes.$inferSelect;
export type Participant = typeof participants.$inferSelect;
