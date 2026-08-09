/**
 * Prueba del motor de video. Uso: npx tsx scripts/test-video.ts [slug]
 */
import path from "node:path";
import { prisma } from "../lib/db";
import { IDEA_BANK } from "../lib/ideas/bank";
import { renderVideo } from "../lib/render/video";

async function main() {
  const slug = process.argv[2] || "reclutmatch";
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw new Error(`Negocio no encontrado: ${slug}`);

  const idea = IDEA_BANK[slug].find((i) => i.type === "VIDEO")!;
  const outDir = path.join(process.cwd(), "data", "output", `test-video-${slug}`);

  const t0 = Date.now();
  const result = await renderVideo(
    business,
    { title: idea.title, hook: idea.hook, pillar: idea.pillar, slides: idea.slides },
    outDir,
  );
  console.log(
    `✔ Video de ${result.durationSeconds.toFixed(1)}s (${result.slideFiles.length} slides, ` +
    `música: ${result.hasMusic ? "sí" : "no"}) en ${(Date.now() - t0) / 1000}s → ${path.join(outDir, result.videoFile)}`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
