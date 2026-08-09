/**
 * Prueba rápida del motor de carruseles sin tocar la base de datos de piezas.
 * Uso: npx tsx scripts/test-render.ts [slug]
 */
import path from "node:path";
import { prisma } from "../lib/db";
import { IDEA_BANK } from "../lib/ideas/bank";
import { renderCarousel } from "../lib/render/carousel";

async function main() {
  const slug = process.argv[2] || "reclutmatch";
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw new Error(`Negocio no encontrado: ${slug}`);

  const idea = IDEA_BANK[slug].find((i) => i.type === "CAROUSEL")!;
  const outDir = path.join(process.cwd(), "data", "output", `test-${slug}`);

  const result = await renderCarousel(
    business,
    { title: idea.title, hook: idea.hook, pillar: idea.pillar, slides: idea.slides },
    outDir,
  );
  console.log(`✔ ${result.files.length} slides renderizadas en ${outDir}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
