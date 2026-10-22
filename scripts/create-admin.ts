import "dotenv/config";
import { createLocalUser } from "../server/db";
import { hashPassword } from "../server/_core/localAuth";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const name = String(process.env.ADMIN_NAME || "Administrador").trim();

if (!email || !password) {
  console.error("Uso: ADMIN_EMAIL=admin@dominio.com ADMIN_PASSWORD='una-clave-segura' pnpm admin:create");
  process.exit(1);
}

try {
  const user = await createLocalUser(email, name, await hashPassword(password), "admin");
  console.log(`Administrador listo: ${user?.email || email}`);
} catch (error) {
  console.error("No se pudo crear el administrador:", error instanceof Error ? error.message : error);
  process.exit(1);
}
