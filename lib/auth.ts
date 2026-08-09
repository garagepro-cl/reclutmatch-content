import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "cp_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SECRET_FILE = path.join(process.cwd(), "data", ".session-secret");

let cachedSecret: string | null = null;

/** Clave para firmar sesiones: usa SESSION_SECRET si existe, o genera/persiste una en data/ */
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  try {
    cachedSecret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  } catch {
    cachedSecret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

/** Crea un token de sesión firmado con expiración de 30 días */
export function createSessionToken(): string {
  const expires = Date.now() + SESSION_DURATION_MS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

/** Valida un token de sesión: firma correcta y no expirado */
export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}

/** Para usar en Server Components / Route Handlers */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}
