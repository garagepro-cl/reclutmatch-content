import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./brands";

/**
 * Biblioteca de fotos reales por negocio: assets/photos/<slug>/.
 * Los nombres de archivo son descriptivos (ej: "range-rover-sport-negro-taller.jpg")
 * porque la IA elige la foto leyendo el nombre. Cualquier formato que sharp
 * entienda (jpg, png, webp, avif); siempre se normaliza a JPEG para satori.
 */

const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export function photoDir(slug: string): string {
  return path.join(PROJECT_ROOT, "assets", "photos", slug);
}

/** Lista los archivos de foto disponibles para un negocio */
export function listPhotos(slug: string): string[] {
  const dir = photoDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .sort();
}

/**
 * Carga una foto de la biblioteca como data URL JPEG (máx maxDim px por lado).
 * Devuelve null si el archivo no existe o no se puede procesar.
 */
export async function photoDataUrl(
  slug: string,
  file: string,
  maxDim = 1600,
): Promise<string | null> {
  const full = path.join(photoDir(slug), path.basename(file));
  if (!fs.existsSync(full)) return null;
  try {
    const { default: sharp } = await import("sharp");
    const buf = await sharp(full)
      .rotate() // respeta orientación EXIF
      .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error(`[photos] No se pudo procesar ${file}:`, err);
    return null;
  }
}

/** Convierte bytes de imagen (ej: generada por IA) a data URL JPEG normalizado */
export async function bytesToDataUrl(bytes: Buffer, maxDim = 1600): Promise<string> {
  const { default: sharp } = await import("sharp");
  const buf = await sharp(bytes)
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
