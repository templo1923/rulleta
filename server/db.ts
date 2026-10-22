import { and, count, desc, eq, gte, gt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { campaigns, claimPhotos, InsertUser, participants, prizes, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { defaultPrizes, defaultSettings, normalizeEmail, normalizeWhatsapp, type CampaignSettings } from './campaign';

let _db: ReturnType<typeof drizzle> | null = null;
let _migrationsReady = false;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.dbUrl) {
    try {
      _db = drizzle(ENV.dbUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function prepareDatabase() {
  const db = await getDb();
  if (!db || _migrationsReady) return db;
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  _migrationsReady = true;
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return result[0] ?? undefined;
}

export async function createLocalUser(email: string, name: string, passwordHash: string, role: "user" | "admin" = "user") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = normalizeEmail(email);
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) return existing;
  const inserted = await db.insert(users).values({ openId: `local:${normalizedEmail}`, email: normalizedEmail, name, passwordHash, loginMethod: "password", role, status: "active" }).$returningId();
  return (await db.select().from(users).where(eq(users.id, inserted[0].id)).limit(1))[0];
}

export async function createInitialAdmin(email: string, name: string, passwordHash: string) {
  const db = await prepareDatabase();
  if (!db) throw new Error("Database is not available");
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admins.length) throw new Error("ADMIN_ALREADY_EXISTS");
  const normalizedEmail = normalizeEmail(email);
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    await db.update(users).set({ name, passwordHash, role: "admin", status: "active", loginMethod: "password" }).where(eq(users.id, existing.id));
    return (await db.select().from(users).where(eq(users.id, existing.id)).limit(1))[0];
  }
  const inserted = await db.insert(users).values({ openId: `local:${normalizedEmail}`, email: normalizedEmail, name, passwordHash, loginMethod: "password", role: "admin", status: "active" }).$returningId();
  return (await db.select().from(users).where(eq(users.id, inserted[0].id)).limit(1))[0];
}

export async function touchUserLogin(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

/**
 * Bootstrap only: permits the first authenticated project owner to claim the
 * admin role when the project has no administrator configured yet. Once an
 * admin exists, this function never promotes another account.
 */
export async function promoteIfNoAdmin(openId: string) {
  const db = await getDb();
  if (!db) return false;
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admins.length > 0) return false;
  const updated = await db.update(users).set({ role: "admin" }).where(eq(users.openId, openId));
  return Boolean(updated[0]?.affectedRows);
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return false;
  if (role === "user") {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    if (admins.length <= 1 && admins[0]?.id === userId) throw new Error("LAST_ADMIN");
  }
  const updated = await db.update(users).set({ role }).where(eq(users.id, userId));
  return Boolean(updated[0]?.affectedRows);
}

export async function getCampaignBySlug(slug = "demo") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function getCampaignPrizes(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prizes).where(and(eq(prizes.campaignId, campaignId), eq(prizes.active, 1))).orderBy(prizes.sortOrder);
}

export async function getAllCampaignPrizes(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prizes).where(eq(prizes.campaignId, campaignId)).orderBy(prizes.sortOrder);
}

export async function getPrizeById(campaignId: number, prizeId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(prizes).where(and(eq(prizes.id, prizeId), eq(prizes.campaignId, campaignId))).limit(1);
  return result[0] ?? null;
}

export async function getPrizeDailyUses(campaignId: number, prizeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await db.select({ total: count() }).from(participants).where(and(eq(participants.campaignId, campaignId), eq(participants.prizeId, prizeId), gte(participants.spunAt, start)));
  return Number(result[0]?.total || 0);
}

export async function ensureDefaultCampaign() {
  const db = await getDb();
  if (!db) return null;
  let campaign = await getCampaignBySlug("demo");
  if (!campaign) {
    const inserted = await db.insert(campaigns).values({ slug: "demo", name: "Campaña Demo", active: 1, settings: defaultSettings }).$returningId();
    campaign = (await db.select().from(campaigns).where(eq(campaigns.id, inserted[0].id)).limit(1))[0] ?? null;
    if (campaign) await db.insert(prizes).values(defaultPrizes.map((item, index) => ({ ...item, campaignId: campaign!.id, sortOrder: index, active: 1 })));
  }
  return campaign;
}

export async function findParticipant(campaignId: number, email: string, whatsapp: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(participants).where(and(eq(participants.campaignId, campaignId), or(eq(participants.normalizedEmail, normalizeEmail(email)), eq(participants.normalizedWhatsapp, normalizeWhatsapp(whatsapp))))).limit(1);
  return result[0] ?? null;
}

export async function createParticipant(campaignId: number, name: string, whatsapp: string, email: string) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(participants).values({ campaignId, participationToken: randomUUID() + randomUUID(), name, whatsapp, email, normalizedEmail: normalizeEmail(email), normalizedWhatsapp: normalizeWhatsapp(whatsapp), status: "registered", spinCount: 0, bonusUsed: 0, advice: 0 }).$returningId();
  return (await db.select().from(participants).where(eq(participants.id, inserted[0].id)).limit(1))[0] ?? null;
}

export async function getParticipant(campaignId: number, participantId: number, participationToken: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(participants).where(and(eq(participants.id, participantId), eq(participants.campaignId, campaignId), eq(participants.participationToken, participationToken))).limit(1);
  return result[0] ?? null;
}

export async function saveSpin(participantId: number, prize: typeof prizes.$inferSelect, spinCount: number, bonusUsed: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    if (prize.maxDaily !== null) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const daily = await tx.select({ total: count() }).from(participants).where(and(eq(participants.prizeId, prize.id), gte(participants.spunAt, start)));
      if (Number(daily[0]?.total || 0) >= prize.maxDaily) throw new Error("PRIZE_DAILY_LIMIT");
    }
    if (prize.stock !== null) {
      const stockUpdate = await tx.update(prizes).set({ stock: sql`${prizes.stock} - 1` }).where(and(eq(prizes.id, prize.id), gt(prizes.stock, 0)));
      if (!stockUpdate[0]?.affectedRows) throw new Error("PRIZE_STOCK_EXHAUSTED");
    }
    const participantUpdate = await tx.update(participants).set({ prizeId: prize.id, prizeTitle: prize.title, status: "spun", spinCount, bonusUsed, spunAt: new Date() }).where(and(eq(participants.id, participantId), eq(participants.spinCount, spinCount - 1)));
    if (!participantUpdate[0]?.affectedRows) throw new Error("PARTICIPANT_ALREADY_SPUN");
  });
}

export async function saveClaim(campaignId: number, participantId: number, data: { photoData?: string | null; photoMime?: string | null; advice: boolean; platform: string }) {
  const db = await getDb();
  if (!db) return null;
  const claimCode = `RF-${randomBytes(4).toString("hex").toUpperCase()}`;
  const updated = await db.transaction(async tx => {
    const result = await tx.update(participants).set({ status: "claimed", claimCode, deliveryStatus: "pending", photoUrl: data.photoData ? `/api/admin/participants/${participantId}/photo` : null, advice: data.advice ? 1 : 0, platform: data.platform || null, claimedAt: new Date() }).where(and(eq(participants.id, participantId), eq(participants.campaignId, campaignId), eq(participants.status, "spun")));
    if (!result[0]?.affectedRows) return false;
    if (data.photoData && data.photoMime) await tx.insert(claimPhotos).values({ participantId, mimeType: data.photoMime, imageData: data.photoData });
    return true;
  });
  if (!updated) return null;
  return claimCode;
}

export async function getClaimPhoto(participantId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(claimPhotos).where(eq(claimPhotos.participantId, participantId)).limit(1);
  return result[0] ?? null;
}

export async function listParticipants(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(participants).where(eq(participants.campaignId, campaignId)).orderBy(desc(participants.createdAt));
}

export async function updateCampaignSettings(campaignId: number, name: string, settings: CampaignSettings) {
  const db = await getDb();
  if (!db) return;
  const current = await db.select({ settings: campaigns.settings }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  const currentSettings = (current[0]?.settings && typeof current[0].settings === "object") ? current[0].settings as CampaignSettings : defaultSettings;
  const mergedSettings = { ...defaultSettings, ...currentSettings, ...settings, socialLinks: Array.isArray(settings.socialLinks) ? settings.socialLinks : currentSettings.socialLinks };
  await db.update(campaigns).set({ name: String(name).slice(0, 180), settings: mergedSettings }).where(eq(campaigns.id, campaignId));
  const saved = await db.select({ name: campaigns.name, settings: campaigns.settings }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!saved[0]) throw new Error("La campaña no quedó guardada en MySQL.");
  return saved[0];
}

export async function replacePrizes(campaignId: number, incoming: Array<Partial<typeof prizes.$inferInsert> & { id?: number }>) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: prizes.id }).from(prizes).where(eq(prizes.campaignId, campaignId));
  const existingIds = new Set(existing.map(item => item.id));
  await db.update(prizes).set({ active: 0 }).where(eq(prizes.campaignId, campaignId));
  for (const [index, item] of incoming.entries()) {
    const values = { campaignId, title: String(item.title || "Premio").slice(0, 180), subtitle: String(item.subtitle || "Premio").slice(0, 120), icon: String(item.icon || "✦").slice(0, 16), kind: (item.kind || "win") as "win" | "retry" | "again", internalCode: item.internalCode ? String(item.internalCode).slice(0, 64) : `PREMIO_${item.id ?? index + 1}`, deliveryType: (item.deliveryType || "digital") as "digital" | "physical" | "coupon" | "advice", weight: Math.max(0, Number(item.weight || 0)), stock: item.stock === null || item.stock === undefined ? null : Math.max(0, Number(item.stock)), maxDaily: item.maxDaily === null || item.maxDaily === undefined ? null : Math.max(0, Number(item.maxDaily)), active: item.active === 0 ? 0 : 1, sortOrder: index };
    if (item.id && existingIds.has(Number(item.id))) await db.update(prizes).set(values).where(and(eq(prizes.id, Number(item.id)), eq(prizes.campaignId, campaignId)));
    else await db.insert(prizes).values(values);
  }
}

export async function updateDeliveryStatus(campaignId: number, participantId: number, status: "pending" | "sent" | "delivered" | "cancelled") {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const updated = await db.update(participants).set({ deliveryStatus: status, deliverySentAt: status === "sent" ? now : undefined, deliveredAt: status === "delivered" ? now : undefined }).where(and(eq(participants.id, participantId), eq(participants.campaignId, campaignId), eq(participants.status, "claimed")));
  return Boolean(updated[0]?.affectedRows);
}

export async function adminTotals(campaignId: number) {
  const rows = await listParticipants(campaignId);
  return { participants: rows.length, claimed: rows.filter(row => row.status === "claimed").length, wins: rows.filter(row => row.prizeId && row.prizeTitle && !row.prizeTitle.toLowerCase().includes("próxima") && !row.prizeTitle.toLowerCase().includes("nuevo")).length };
}
