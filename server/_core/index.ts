import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import * as db from "../db";
import { chooseWeighted, defaultPrizes, defaultSettings, normalizeEmail, normalizeWhatsapp } from "../campaign";
import { verifyPassword } from "./localAuth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword } from "./localAuth";
import { ENV } from "./env";

const json = (value: unknown) => JSON.stringify(value);
const campaignResponse = async (includeInactive = false) => {
  const campaign = await db.ensureDefaultCampaign();
  if (!campaign) throw new Error("La base de datos no está disponible");
  const prizeRows = includeInactive ? await db.getAllCampaignPrizes(campaign.id) : await db.getCampaignPrizes(campaign.id);
  return { campaign: { id: campaign.id, slug: campaign.slug, name: campaign.name, active: campaign.active }, settings: (campaign.settings || defaultSettings) as typeof defaultSettings, prizes: prizeRows };
};
const sendError = (res: Response, status: number, error: string) => res.status(status).json({ ok: false, error });
async function adminUser(req: Request) {
  try {
    let user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      const promoted = await db.promoteIfNoAdmin(user.openId);
      if (promoted) user = (await db.getUserByOpenId(user.openId)) ?? user;
    }
    if (user.role !== "admin") return null;
    return user;
  } catch { return null; }
}
function validateContact(name: unknown, whatsapp: unknown, email: unknown) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 180) return "Escribe un nombre válido.";
  if (normalizeWhatsapp(String(whatsapp || "")).length < 7 || normalizeWhatsapp(String(whatsapp || "")).length > 40) return "Escribe un WhatsApp válido.";
  if (typeof email !== "string" || email.trim().length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Escribe un correo válido.";
  return null;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "ruletaflex" }));
  app.get("/install", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instalar Ruleta Flex</title><style>body{font-family:Arial,sans-serif;background:#f4f2ff;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#fff;max-width:430px;width:calc(100% - 32px);padding:28px;border-radius:20px;box-shadow:0 15px 50px #20135b20}h1{margin-top:0;color:#21164f}label{display:block;margin:14px 0;color:#514b6e;font-weight:700}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddd8ef;border-radius:10px;margin-top:6px;font-size:16px}button{width:100%;border:0;border-radius:10px;background:#f5c941;padding:14px;font-weight:800;font-size:16px;margin-top:10px;cursor:pointer}.hint{color:#67617d;font-size:14px;line-height:1.5}.error{color:#a52b37;background:#fff0f1;padding:10px;border-radius:8px}</style></head><body><main class="card"><h1>Instalar Ruleta Flex</h1><p class="hint">Usa este formulario una sola vez para crear el primer administrador. Necesitas la clave temporal INSTALL_KEY configurada en Hostinger.</p><form method="post" action="/install"><label>Clave de instalación<input name="installKey" type="password" required></label><label>Nombre<input name="name" value="Administrador" required></label><label>Correo<input name="email" type="email" required></label><label>Contraseña<input name="password" type="password" minlength="8" required></label><button>Crear administrador</button></form></main></body></html>`);
  });
  app.post("/install", async (req, res) => {
    if (!ENV.installKey || String(req.body?.installKey || "") !== ENV.installKey) return sendError(res, 403, "Clave de instalación inválida.");
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const name = String(req.body?.name || "Administrador").trim();
      const password = String(req.body?.password || "");
      if (!email || !name || password.length < 8) return sendError(res, 400, "Completa los datos. La contraseña debe tener al menos 8 caracteres.");
      await db.createInitialAdmin(email, name, await hashPassword(password));
      res.send("<h1>Administrador creado correctamente</h1><p>Elimina INSTALL_KEY de Hostinger y borra o bloquea esta ruta antes de usar el sistema.</p><p><a href=\"/admin\">Ir al panel</a></p>");
    } catch (error: any) {
      if (error?.message === "ADMIN_ALREADY_EXISTS") return sendError(res, 409, "Ya existe un administrador. El instalador está cerrado.");
      console.error("installer", error); sendError(res, 500, "No se pudo crear el administrador.");
    }
  });
  app.get("/api/platform/config.js", (_req, res) => res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript()));

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) return sendError(res, 400, "Escribe tu correo y contraseña.");
      const user = await db.getUserByEmail(email);
      if (!user || user.status !== "active" || !(await verifyPassword(password, user.passwordHash))) return sendError(res, 401, "Correo o contraseña incorrectos.");
      await db.touchUserLogin(user.id);
      const token = await sdk.createSessionToken(user.openId, { name: user.name || email });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) { console.error("local login", error); sendError(res, 500, "No se pudo iniciar sesión."); }
  });
  app.post("/api/auth/logout", (_req, res) => { res.clearCookie(COOKIE_NAME, { path: "/", secure: true, sameSite: "none" }); res.json({ ok: true }); });

  app.get("/api/campaign", async (_req, res) => {
    try { res.json(await campaignResponse()); } catch (error) { console.error(error); sendError(res, 503, "La campaña aún no está disponible."); }
  });

  app.post("/api/register", async (req, res) => {
    const error = validateContact(req.body?.name, req.body?.whatsapp, req.body?.email);
    if (error) return sendError(res, 400, error);
    try {
      const campaign = await db.ensureDefaultCampaign();
      if (!campaign) return sendError(res, 503, "La base de datos aún no está disponible.");
      if (Number(req.body?.campaignId) !== campaign.id) return sendError(res, 400, "Campaña inválida.");
      if (!campaign.active) return sendError(res, 409, "La campaña está cerrada.");
      const existing = await db.findParticipant(campaign.id, req.body.email, req.body.whatsapp);
      if (existing) return sendError(res, 409, "Ya existe una participación con estos datos.");
      const participant = await db.createParticipant(campaign.id, req.body.name.trim(), String(req.body.whatsapp).trim(), req.body.email.trim());
      if (!participant) return sendError(res, 503, "No se pudo crear la participación.");
      res.json({ ok: true, participantId: participant.id, participationToken: participant.participationToken });
    } catch (error: any) { console.error("register", error); if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) return sendError(res, 409, "Ya existe una participación con estos datos."); sendError(res, 500, "No se pudo registrar la participación."); }
  });

  app.post("/api/spin", async (req, res) => {
    try {
      const campaign = await db.ensureDefaultCampaign();
      if (!campaign) return sendError(res, 503, "La campaña aún no está disponible.");
      if (Number(req.body?.campaignId) !== campaign.id) return sendError(res, 400, "Campaña inválida.");
      if (!campaign.active) return sendError(res, 409, "La campaña está cerrada.");
      const participant = await db.getParticipant(campaign.id, Number(req.body?.participantId), String(req.body?.participationToken || ""));
      if (!participant) return sendError(res, 404, "Participante no encontrado.");
      const bonus = Boolean(req.body?.bonus);
      const settings = (campaign.settings || defaultSettings) as typeof defaultSettings;
      if (bonus && !settings.allowBonus) return sendError(res, 409, "Los giros extra están desactivados.");
      const rows = await db.getCampaignPrizes(campaign.id);
      const previousPrize = rows.find(row => row.id === participant.prizeId);
      const isAgain = previousPrize?.kind === "again";
      if (bonus && (participant.spinCount === 0 || previousPrize?.kind !== "retry")) return sendError(res, 409, "Este participante no tiene un giro extra disponible.");
      if (participant.spinCount > 0 && !isAgain && (!bonus || participant.bonusUsed)) return sendError(res, 409, "Este participante ya no tiene giros disponibles.");
      const usage = await Promise.all(rows.map(async row => ({ row, usedToday: row.maxDaily === null ? 0 : await db.getPrizeDailyUses(campaign.id, row.id) })));
      const availableRows = usage.filter(item => item.row.maxDaily === null || item.usedToday < item.row.maxDaily).map(item => item.row);
      const selected = chooseWeighted(availableRows);
      if (!selected) return sendError(res, 409, "No hay premios activos disponibles.");
      const spinCount = participant.spinCount + 1;
      await db.saveSpin(participant.id, selected, spinCount, bonus ? 1 : participant.bonusUsed);
      const prizeIndex = rows.findIndex(row => row.id === selected.id);
      res.json({ ok: true, prize: selected, prizeIndex, spinCount, bonusUsed: bonus || Boolean(participant.bonusUsed) });
    } catch (error) { console.error("spin", error); sendError(res, 500, "No se pudo realizar el giro."); }
  });

  app.post("/api/claim", async (req, res) => {
    try {
      const campaign = await db.ensureDefaultCampaign();
      if (!campaign) return sendError(res, 503, "La campaña aún no está disponible.");
      if (Number(req.body?.campaignId) !== campaign.id) return sendError(res, 400, "Campaña inválida.");
      const participant = await db.getParticipant(campaign.id, Number(req.body?.participantId), String(req.body?.participationToken || ""));
      if (!participant || !participant.prizeId) return sendError(res, 400, "No hay un premio listo para reclamar.");
      if (participant.status === "claimed") return sendError(res, 409, "Este premio ya fue reclamado.");
      const claimedPrize = await db.getPrizeById(campaign.id, participant.prizeId);
      if (!claimedPrize || claimedPrize.kind !== "win") return sendError(res, 400, "El premio no puede reclamarse.");
      const settings = (campaign.settings || defaultSettings) as typeof defaultSettings;
      if (!settings.allowAdvice && req.body?.advice) return sendError(res, 400, "La asesoría está desactivada.");
      let photoData: string | null = null;
      let photoMime: string | null = null;
      const photo = req.body?.photoBase64;
      if (photo) {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(String(photo));
        if (!match) return sendError(res, 400, "La foto no tiene un formato válido.");
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length > settings.maxPhotoMb * 1024 * 1024) return sendError(res, 400, `La foto supera el límite de ${settings.maxPhotoMb} MB.`);
        photoData = match[2];
        photoMime = match[1];
      } else if (settings.requirePhoto) return sendError(res, 400, "La foto es obligatoria para reclamar.");
      const claimCode = await db.saveClaim(campaign.id, participant.id, { photoData, photoMime, advice: Boolean(req.body?.advice), platform: String(req.body?.platform || "") });
      if (!claimCode) return sendError(res, 409, "Esta reclamación ya fue registrada.");
      res.json({ ok: true, prize: claimedPrize, claimId: participant.id, claimCode, deliveryStatus: "pending" });
    } catch (error) { console.error("claim", error); sendError(res, 500, "No se pudo guardar la reclamación."); }
  });

  app.get("/api/admin/me", async (req, res) => {
    const user = await adminUser(req);
    res.json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null });
  });
  app.get("/api/admin/data", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    try { const campaign = await campaignResponse(true); const rows = await db.listParticipants(campaign.campaign.id); res.json({ campaign, participants: rows, users: await db.listUsers(), totals: await db.adminTotals(campaign.campaign.id) }); } catch { sendError(res, 500, "No se pudo cargar el panel."); }
  });
  app.get("/api/admin/participants/:id/photo", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    const photo = await db.getClaimPhoto(Number(req.params.id));
    if (!photo) return sendError(res, 404, "Foto no encontrada.");
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(photo.imageData, "base64"));
  });
  app.put("/api/admin/campaign", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    try {
      const campaign = await db.ensureDefaultCampaign();
      if (!campaign) return sendError(res, 503, "Base de datos no disponible.");
      const saved = await db.updateCampaignSettings(campaign.id, String(req.body?.name || campaign.name), req.body?.settings || defaultSettings);
      if (!saved) return sendError(res, 503, "No se pudo conectar con la base de datos.");
      res.json({ ok: true, saved: { name: saved.name, settings: saved.settings } });
    } catch (error) {
      console.error("campaign settings save", error);
      const dbError = error as { code?: string; errno?: number; sqlState?: string; sqlMessage?: string; message?: string };
      const detail = [dbError.code, dbError.errno, dbError.sqlState].filter(Boolean).join("/") || "UNKNOWN";
      const safeMessage = String(dbError.sqlMessage || dbError.message || "Error de escritura").replace(/mysql:\/\/[^\s]+/gi, "mysql://[oculto]").slice(0, 180);
      sendError(res, 500, `MySQL rechazó el guardado [${detail}]: ${safeMessage}`);
    }
  });
  app.put("/api/admin/prizes", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    try { const campaign = await db.ensureDefaultCampaign(); if (!campaign) return sendError(res, 503, "Base de datos no disponible."); await db.replacePrizes(campaign.id, Array.isArray(req.body?.prizes) ? req.body.prizes : []); res.json({ ok: true }); } catch { sendError(res, 500, "No se pudieron guardar los premios."); }
  });
  app.put("/api/admin/participants/:id/delivery", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    const status = req.body?.status;
    if (!["pending", "sent", "delivered", "cancelled"].includes(status)) return sendError(res, 400, "Estado de entrega inválido.");
    try {
      const campaign = await db.ensureDefaultCampaign();
      if (!campaign) return sendError(res, 503, "Base de datos no disponible.");
      const updated = await db.updateDeliveryStatus(campaign.id, Number(req.params.id), status);
      if (!updated) return sendError(res, 404, "Reclamación no encontrada.");
      res.json({ ok: true, status });
    } catch { sendError(res, 500, "No se pudo actualizar la entrega."); }
  });
  app.put("/api/admin/users/:id/role", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    const role = req.body?.role;
    if (role !== "admin" && role !== "user") return sendError(res, 400, "Rol inválido.");
    try { const updated = await db.updateUserRole(Number(req.params.id), role); if (!updated) return sendError(res, 404, "Usuario no encontrado."); res.json({ ok: true, role }); }
    catch (error: any) { if (error?.message === "LAST_ADMIN") return sendError(res, 409, "Debe existir al menos un administrador."); sendError(res, 500, "No se pudo actualizar el acceso."); }
  });
  app.get("/api/admin/export", async (req, res) => {
    const user = await adminUser(req);
    if (!user) return sendError(res, 403, "Necesitas iniciar sesión como administrador.");
    const campaign = await db.ensureDefaultCampaign();
    if (!campaign) return sendError(res, 503, "Base de datos no disponible.");
    const rows = await db.listParticipants(campaign.id);
    const header = "id,nombre,whatsapp,correo,estado,premio,codigo_reclamo,estado_entrega,asesoria,plataforma,creado,reclamado\n";
    const csv = rows.map(row => [row.id, row.name, row.whatsapp, row.email, row.status, row.prizeTitle || "", row.claimCode || "", row.deliveryStatus, row.advice ? "si" : "no", row.platform || "", row.createdAt?.toISOString?.() || "", row.claimedAt?.toISOString?.() || ""].map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=ruleta-flex-participantes.csv"); res.send("\ufeff" + header + csv);
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  const port = Number(process.env.PORT || "3000");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}
startServer().catch(error => { console.error(error); process.exit(1); });
