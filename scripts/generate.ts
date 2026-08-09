/**
 * Genera contenido desde la terminal.
 * Uso:
 *   npm run generate                        → una pieza por negocio activo (alterna tipo)
 *   npm run generate -- reclutmatch          → una pieza para ese negocio
 *   npm run generate -- reclutmatch VIDEO    → tipo específico (CAROUSEL | VIDEO)
 */
import { prisma } from "../lib/db";
import { createPiece } from "../lib/pipeline";

async function main() {
  const slug = process.argv[2];
  const typeArg = process.argv[3]?.toUpperCase();
  const type =
    typeArg === "CAROUSEL" || typeArg === "VIDEO" ? typeArg : undefined;

  const businesses = slug
    ? await prisma.business.findMany({ where: { slug } })
    : await prisma.business.findMany({ where: { active: true } });

  if (businesses.length === 0) {
    console.error(slug ? `Negocio no encontrado: ${slug}` : "No hay negocios activos");
    process.exit(1);
  }

  for (const b of businesses) {
    console.log(`⚙️  Generando para ${b.name}…`);
    const piece = await createPiece(b.slug, type);
    console.log(
      `✔ ${piece.type === "CAROUSEL" ? "Carrusel" : "Video"} "${piece.title}" ` +
      `(${piece.slideCount} slides, fuente: ${piece.source}) → estado ${piece.status}`,
    );
    console.log(`  Archivos: ${piece.outputDir}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
