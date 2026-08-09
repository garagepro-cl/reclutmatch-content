import path from "node:path";
import type { Business } from "@prisma/client";

/** Tokens visuales de una marca, guardados en Business.brandJson */
export interface Brand {
  /** Fondo principal (oscuro) */
  bg: string;
  /** Fondo de paneles/tarjetas */
  panel: string;
  /** Color de texto principal */
  text: string;
  /** Texto secundario */
  muted: string;
  /** Color protagonista (titulares, chips, CTA) */
  primary: string;
  /** Variante clara del primario para gradientes */
  primaryLight: string;
  /** Tono claro neutro para bordes y detalles */
  silver: string;
  /** Acento secundario */
  accent: string;
  /** Archivo de logo dentro de assets/brands/<slug>/ */
  logoFile: string;
  /** Proporción ancho/alto del logo, para dimensionarlo en plantillas */
  logoAspect: number;
  /** Texto del botón del slide de cierre (CTA) */
  ctaButton?: string;
}

export const DEFAULT_BRAND: Brand = {
  bg: "#0B0B0D",
  panel: "#16161A",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  primary: "#F2B705",
  primaryLight: "#FFD54A",
  silver: "#C9CDD1",
  accent: "#2F6FE4",
  logoFile: "logo.png",
  logoAspect: 3,
};

export function parseBrand(business: Business): Brand {
  try {
    return { ...DEFAULT_BRAND, ...JSON.parse(business.brandJson) };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

export function parseTopics(business: Business): string[] {
  try {
    const t = JSON.parse(business.topicsJson);
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}

export function parsePlatforms(business: Business): string[] {
  try {
    const p = JSON.parse(business.platformsJson);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export const PROJECT_ROOT = process.cwd();

export function brandAssetDir(slug: string): string {
  return path.join(PROJECT_ROOT, "assets", "brands", slug);
}

export function outputDirFor(pieceId: string): string {
  return path.join(PROJECT_ROOT, "data", "output", pieceId);
}
