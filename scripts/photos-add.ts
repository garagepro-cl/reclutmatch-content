/**
 * Agrega fotos a la biblioteca de un negocio, normalizadas a JPEG.
 * El nombre de destino debe ser DESCRIPTIVO (la IA elige la foto por el nombre).
 *
 * Uso:
 *   npx tsx scripts/photos-add.ts <slug> "<ruta-origen>=nombre-descriptivo.jpg" [...]
 * Ejemplo:
 *   npx tsx scripts/photos-add.ts garage-pro "C:\fotos\IMG_001.jpg=volvo-xc60-en-elevador.jpg"
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MAX_DIM = 2000;

async function main() {
  const [slug, ...pairs] = process.argv.slice(2);
  if (!slug || pairs.length === 0) {
    console.error("Uso: npx tsx scripts/photos-add.ts <slug> \"<origen>=<nombre.jpg>\" [...]");
    process.exit(1);
  }
  const destDir = path.join(process.cwd(), "assets", "photos", slug);
  fs.mkdirSync(destDir, { recursive: true });

  for (const pair of pairs) {
    const eq = pair.lastIndexOf("=");
    if (eq < 1) {
      console.error(`Par inválido (falta '='): ${pair}`);
      continue;
    }
    const src = pair.slice(0, eq);
    let name = pair.slice(eq + 1).trim().toLowerCase().replace(/\s+/g, "-");
    if (!name.endsWith(".jpg")) name += ".jpg";

    try {
      const img = sharp(src).rotate();
      const meta = await img.metadata();
      if ((meta.width ?? 0) < 600 && (meta.height ?? 0) < 600) {
        console.warn(`⚠ ${path.basename(src)}: muy chica (${meta.width}x${meta.height}), omitida`);
        continue;
      }
      await img
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toFile(path.join(destDir, name));
      console.log(`✓ ${name} (${meta.width}x${meta.height} → máx ${MAX_DIM}px)`);
    } catch (err) {
      console.error(`✗ ${path.basename(src)}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nBiblioteca: ${destDir}`);
}

void main();
