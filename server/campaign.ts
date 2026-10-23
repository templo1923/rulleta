export type CampaignSettings = {
  brand: string;
  logoText: string;
  wheelCenterText: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  footer: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  ctaText: string;
  spinText: string;
  claimText: string;
  retryText: string;
  endText: string;
  contactText: string;
  maxPhotoMb: number;
  requirePhoto: boolean;
  allowBonus: boolean;
  allowAdvice: boolean;
  socialLinks: { label: string; url: string; icon: string; active?: boolean }[];
};

export const defaultSettings: CampaignSettings = {
  brand: "Ruleta Flex",
  logoText: "RF",
  wheelCenterText: "Ruleta Flex",
  eyebrow: "CAMPAÑA PROMOCIONAL",
  title: "Gira y gana algo grande",
  highlight: "Tu oportunidad está a un giro",
  description: "Déjanos tus datos, gira la ruleta y descubre tu premio. Todo queda registrado para que tu experiencia sea clara y rápida.",
  footer: "Campaña EmprendeRed · Personaliza cada detalle desde tu panel",
  primaryColor: "#f7c948",
  secondaryColor: "#33246f",
  accentColor: "#17c6d8",
  backgroundColor: "#100b2e",
  cardColor: "#fffdf7",
  ctaText: "Participar y girar",
  spinText: "GIRAR AHORA",
  claimText: "Reclamar premio",
  retryText: "Intentar otra vez",
  endText: "¡Gracias por participar!",
  contactText: "Te contactaremos para coordinar la entrega.",
  maxPhotoMb: 5,
  requirePhoto: false,
  allowBonus: true,
  allowAdvice: true,
  socialLinks: [
    { label: "Instagram", url: "https://instagram.com/", icon: "◎", active: true },
    { label: "Facebook", url: "https://facebook.com/", icon: "f", active: true },
    { label: "TikTok", url: "https://tiktok.com/", icon: "♪", active: true },
  ],
};

export const defaultPrizes = [
  { title: "1 mes de Leodora", subtitle: "1 mes|Leodora", icon: "🌿", kind: "win" as const, internalCode: "LEODORA_1M", deliveryType: "digital" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Para la próxima", subtitle: "Para la|próxima", icon: "🎁", kind: "retry" as const, internalCode: "RETRY_01", deliveryType: "digital" as const, weight: 3, stock: null, maxDaily: null },
  { title: "15 créditos FullGEN", subtitle: "15 créd.|FullGEN", icon: "🪙", kind: "win" as const, internalCode: "FULLGEN_15", deliveryType: "coupon" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Gira de nuevo", subtitle: "Gira de|nuevo", icon: "↻", kind: "again" as const, internalCode: "AGAIN_01", deliveryType: "digital" as const, weight: 2, stock: null, maxDaily: null },
  { title: "1 cuenta de diseño", subtitle: "Cuenta|Diseño", icon: "✦", kind: "win" as const, internalCode: "DESIGN_01", deliveryType: "advice" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Para la próxima", subtitle: "Para la|próxima", icon: "🎁", kind: "retry" as const, internalCode: "RETRY_02", deliveryType: "digital" as const, weight: 3, stock: null, maxDaily: null },
  { title: "1 cuenta de entretenimiento", subtitle: "Cuenta|Entret.", icon: "◉", kind: "win" as const, internalCode: "ENTRET_01", deliveryType: "digital" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Gira de nuevo", subtitle: "Gira de|nuevo", icon: "↻", kind: "again" as const, internalCode: "AGAIN_02", deliveryType: "digital" as const, weight: 2, stock: null, maxDaily: null },
  { title: "1 mes CallPOS", subtitle: "1 mes|CallPOS", icon: "▣", kind: "win" as const, internalCode: "CALLPOS_1M", deliveryType: "digital" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Para la próxima", subtitle: "Para la|próxima", icon: "🎁", kind: "retry" as const, internalCode: "RETRY_03", deliveryType: "digital" as const, weight: 3, stock: null, maxDaily: null },
  { title: "1 landing gratis", subtitle: "Landing|gratis", icon: "⌁", kind: "win" as const, internalCode: "LANDING_01", deliveryType: "advice" as const, weight: 1, stock: null, maxDaily: null },
  { title: "Premio sorpresa", subtitle: "Premio|sorpresa", icon: "✹", kind: "win" as const, internalCode: "SURPRISE_01", deliveryType: "physical" as const, weight: 1, stock: null, maxDaily: null },
];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeWhatsapp(value: string) {
  return value.replace(/\D/g, "");
}

export function chooseWeighted<T extends { weight: number; stock?: number | null }>(items: T[]) {
  const available = items.filter(item => item.weight > 0 && (item.stock === null || item.stock === undefined || item.stock > 0));
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return available[0];
  let cursor = Math.random() * total;
  for (const item of available) {
    cursor -= item.weight;
    if (cursor < 0) return item;
  }
  return available[available.length - 1];
}
