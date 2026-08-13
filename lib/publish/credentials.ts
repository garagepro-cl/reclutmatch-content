import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../brands";

/**
 * Credenciales POR NEGOCIO, en data/credentials/<slug>.json (fuera de git).
 * Estructura:
 * {
 *   "meta": {
 *     "pageId": "id de la página de Facebook",
 *     "igUserId": "id de la cuenta Instagram Business",
 *     "accessToken": "token de página de larga duración"
 *   },
 *   "linkedin": {
 *     "organizationId": "id numérico de la página de empresa",
 *     "accessToken": "token OAuth con w_organization_social",
 *     "personUrn": "urn:li:person:xxx (alternativa: publicar como perfil)"
 *   },
 *   "youtube": {
 *     "clientId": "...", "clientSecret": "...", "refreshToken": "..."
 *   }
 * }
 */
export interface MetaCredentials {
  pageId?: string;
  igUserId?: string;
  accessToken?: string;
}

export interface LinkedInCredentials {
  /** Id numérico de la página de empresa (urn:li:organization:<id>) */
  organizationId?: string;
  /** Token OAuth 2.0 con scope w_organization_social (o w_member_social para perfil) */
  accessToken?: string;
  /** Alternativa a organizationId: publicar como perfil personal (urn:li:person:xxx) */
  personUrn?: string;
  /**
   * Opcionales, solo para `npm run probar-linkedin`: con ellos se puede
   * preguntarle a LinkedIn si el token sigue vivo y qué permisos trae, en vez
   * de descubrirlo cuando falla una publicación. Publicar no los necesita.
   */
  clientId?: string;
  clientSecret?: string;
}

export interface YouTubeCredentials {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface BusinessCredentials {
  meta?: MetaCredentials;
  linkedin?: LinkedInCredentials;
  youtube?: YouTubeCredentials;
}

export function credentialsPath(slug: string): string {
  return path.join(PROJECT_ROOT, "data", "credentials", `${slug}.json`);
}

export function loadCredentials(slug: string): BusinessCredentials {
  const file = credentialsPath(slug);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    console.error(`[credentials] JSON inválido en ${file}`);
    return {};
  }
}

export function saveCredentials(slug: string, creds: BusinessCredentials): void {
  const file = credentialsPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(creds, null, 2));
}
