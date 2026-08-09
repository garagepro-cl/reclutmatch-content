/**
 * Muestra en pantalla la idea que saldría ahora, SIN crear la pieza:
 * no escribe en la base, no renderiza, no avisa por Telegram y no publica.
 * Sirve para revisar el tono y comprobar la rotación de pilares antes de dejar
 * que el sistema genere solo.
 *
 * Nota: a diferencia de ContentPilot, acá NO se consume la cola de ideas
 * propias — una vista previa que gastara una idea anotada sería una trampa.
 *
 *   npm run probar-idea
 *   npm run probar-idea -- reclutmatch VIDEO
 */
import { prisma } from "../lib/db";
import { pickNextPillar } from "../lib/ideas";
import { generateIdeaWithAI } from "../lib/ideas/ai";
import { parseTopics } from "../lib/brands";

async function main() {
  const slug = process.argv[2];
  const type = (process.argv[3] || "CAROUSEL").toUpperCase() as "CAROUSEL" | "VIDEO";

  const business = slug
    ? await prisma.business.findUniqueOrThrow({ where: { slug } })
    : await prisma.business.findFirstOrThrow({ where: { active: true } });

  const recent = await prisma.contentPiece.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { title: true, pillar: true, status: true },
  });
  const recentTitles = recent.filter((r) => r.status !== "REJECTED").map((r) => r.title);
  const pilar = pickNextPillar(business, recent);

  const usados = new Set(recent.map((r) => r.pillar.trim().toLowerCase()).filter(Boolean));
  console.log(`Negocio: ${business.name} · Tipo: ${type}`);
  console.log("\nPilares configurados (✓ = ya usado en las últimas 25 piezas):");
  for (const t of parseTopics(business)) {
    console.log(`  ${usados.has(t.trim().toLowerCase()) ? "✓" : "·"} ${t}`);
  }
  console.log(`\nPilar que toca por rotación: ${pilar ?? "(sin pilares configurados)"}\n`);

  const idea = await generateIdeaWithAI(business, type, recentTitles, undefined, pilar);

  console.log("─".repeat(70));
  console.log(`PILAR   : ${idea.pillar}`);
  console.log(`TÍTULO  : ${idea.title}`);
  console.log(`GANCHO  : ${idea.hook}`);
  console.log("─".repeat(70));
  idea.slides.forEach((s, i) => {
    console.log(`\n[${i + 1}] (${s.layout ?? "split"}) ${s.title}`);
    if (s.body) console.log(`    ${s.body}`);
    if (s.bullets?.length) s.bullets.forEach((b) => console.log(`    · ${b}`));
    if (s.compareLeft?.length) console.log(`    ✗ ${s.compareLeft.join(" / ")}`);
    if (s.compareRight?.length) console.log(`    ✓ ${s.compareRight.join(" / ")}`);
    if (s.photo) console.log(`    [foto real: ${s.photo}]`);
    else if (s.imagePrompt) console.log(`    [imagen IA: ${s.imagePrompt.slice(0, 90)}]`);
  });
  console.log("\n" + "─".repeat(70));
  console.log(`CAPTION : ${idea.caption}`);
  console.log(`HASHTAGS: ${idea.hashtags.join(" ")}`);
  console.log("─".repeat(70));
  console.log("\n(Nada de esto se guardó: es solo una vista previa.)");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
