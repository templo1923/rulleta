export type Prize = { id: number | null; title: string; subtitle: string; icon: string; kind: "win" | "retry" | "again"; internalCode?: string | null; deliveryType: "digital" | "physical" | "coupon" | "advice"; weight: number; stock: number | null; maxDaily?: number | null; active: number; sortOrder: number };
export type SocialLink = { label: string; url: string; icon: string; active?: boolean };
export type CampaignSettings = { brand: string; logoText: string; wheelCenterText?: string; eyebrow: string; title: string; highlight: string; description: string; footer: string; primaryColor: string; secondaryColor: string; accentColor: string; backgroundColor: string; cardColor: string; ctaText: string; spinText: string; claimText: string; retryText: string; endText: string; contactText: string; maxPhotoMb: number; requirePhoto: boolean; allowBonus: boolean; allowAdvice: boolean; socialLinks: SocialLink[] };
export type CampaignPayload = { campaign: { id: number; slug: string; name: string; active: number }; settings: CampaignSettings; prizes: Prize[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud");
  return payload as T;
}

export function getCampaign() { return request<CampaignPayload>("/api/campaign"); }
export function registerParticipant(body: { campaignId: number; name: string; whatsapp: string; email: string }) { return request<{ ok: true; participantId: number; participationToken: string }>("/api/register", { method: "POST", body: JSON.stringify(body) }); }
export function spinParticipant(body: { campaignId: number; participantId: number; participationToken: string; bonus: boolean }) { return request<{ ok: true; prize: Prize; prizeIndex: number; spinCount: number; bonusUsed: boolean }>("/api/spin", { method: "POST", body: JSON.stringify(body) }); }
export function claimPrize(body: { campaignId: number; participantId: number; participationToken: string; prizeId: number; photoBase64?: string | null; advice: boolean; platform: string }) { return request<{ ok: true; prize: Prize; claimId: number; claimCode: string; deliveryStatus: string }>("/api/claim", { method: "POST", body: JSON.stringify(body) }); }
export function getMe() { return request<{ user: { id: number; name: string | null; email: string | null; role: string } | null }>("/api/admin/me"); }
export function login(email: string, password: string) { return request<{ ok: true; user: { id: number; name: string | null; email: string | null; role: string } }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
export function logout() { return request<{ ok: true }>("/api/auth/logout", { method: "POST" }); }
export function updateCampaign(body: { settings: CampaignSettings; name: string }) { return request<{ ok: true }>("/api/admin/campaign", { method: "PUT", body: JSON.stringify(body) }); }
export function updatePrizes(prizes: Partial<Prize>[]) { return request<{ ok: true }>("/api/admin/prizes", { method: "PUT", body: JSON.stringify({ prizes }) }); }
export function getAdminData() { return request<{ campaign: CampaignPayload; participants: any[]; totals: { participants: number; claimed: number; wins: number } }>("/api/admin/data"); }
export function updateDeliveryStatus(participantId: number, status: "pending" | "sent" | "delivered" | "cancelled") { return request<{ ok: true; status: string }>(`/api/admin/participants/${participantId}/delivery`, { method: "PUT", body: JSON.stringify({ status }) }); }
export function updateUserRole(userId: number, role: "user" | "admin") { return request<{ ok: true; role: string }>(`/api/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }); }
export function exportCsv() { window.location.href = "/api/admin/export"; }
