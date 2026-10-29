/**
 * Muestra en pantalla la idea que saldría ahora, SIN crear la pieza:
 * no escribe en la base, no avisa por Telegram y no publica.
 * Sirve para revisar el tono y comprobar la rotación de pilares antes de dejar
 * que el sistema genere solo.
 *
 * Nota: a diferencia de ContentPilot, acá NO se consume la cola de ideas
 * propias — una vista previa que gastara una idea anotada sería una trampa.
 *
 *   npm run probar-idea
 *   npm run probar-idea -- reclutmatch VIDEO
 *   npm run probar-idea -- reclutmatch CAROUSEL --render
 *   npm run probar-idea -- reclutmatch CAROUSEL "--idea=candidatos: roleplay de la pregunta de renta"
 *
 * Con --render además dibuja las láminas en una carpeta temporal, para ver la
 * pieza completa con imágenes. Sigue sin tocar la base ni Telegram, pero SÍ gasta
 * créditos de imágenes (hasta 4 por carrusel).
 *
 * Con --idea=... prueba una idea concreta en vez de la que toca por rotación: sirve
 * para ver cómo saldría una idea antes de anotarla con /idea. No toca la cola.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../lib/db";
import { pickNextPillar } from "../lib/ideas";
import { generateIdeaWithAI } from "../lib/ideas/ai";
import { parseTopics } from "../lib/brands";
import { elegirRegistro, NOMBRES_VOZ } from "../lib/ideas/voz";
import { audienciaDe, cerrarCaption, negocioParaAudiencia } from "../lib/ideas/audiencia";

async function main() {
  // Las banderas no deben confundirse con el slug o el tipo
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dibujar = process.argv.includes("--render");
  const ideaPropia = process.argv.find((a) => a.startsWith("--idea="))?.slice("--idea=".length).trim() || undefined;
  const slug = args[0];
  const type = (args[1] || "CAROUSEL").toUpperCase() as "CAROUSEL" | "VIDEO";

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
  const turno = await prisma.contentPiece.count({ where: { businessId: business.id } });
  const registro = elegirRegistro(turno);

  const usados = new Set(recent.map((r) => r.pillar.trim().toLowerCase()).filter(Boolean));
  console.log(`Negocio: ${business.name} · Tipo: ${type}`);
  console.log("\nPilares configurados (✓ = ya usado en las últimas 25 piezas):");
  for (const t of parseTopics(business)) {
    console.log(`  ${usados.has(t.trim().toLowerCase()) ? "✓" : "·"} ${t}`);
  }
  console.log(`\nPilar que toca por rotación: ${pilar ?? "(sin pilares configurados)"}\n`);

  console.log(`Voz que toca: (${registro}) ${NOMBRES_VOZ[registro]}`);
  if (ideaPropia) console.log(`Idea a probar: ${ideaPropia}`);
  console.log(`Le habla a: ${audienciaDe(ideaPropia ?? pilar) === "candidatos" ? "personas que buscan trabajo" : "empresas"}`);
  console.log("");
  const idea = await generateIdeaWithAI(business, type, recentTitles, ideaPropia, ideaPropia ? undefined : pilar, turno);

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
  console.log(`CAPTION : ${cerrarCaption(business, idea.pillar, idea.caption)}`);
  console.log(`HASHTAGS: ${idea.hashtags.join(" ")}`);
  console.log("─".repeat(70));
  if (dibujar && type === "CAROUSEL") {
    const { renderCarouselPremium } = await import("../lib/render/carousel");
    const outDir = path.join(os.tmpdir(), `rm-vista-previa-${Date.now()}`);
    fs.mkdirSync(outDir, { recursive: true });
    const r = await renderCarouselPremium(
      negocioParaAudiencia(business, audienciaDe(idea.pillar)),
      {
        title: idea.title,
        hook: idea.hook,
        pillar: idea.pillar,
        slides: idea.slides,
        coverImagePrompt: idea.coverImagePrompt,
        coverPhoto: idea.coverPhoto,
      },
      outDir,
    );
    console.log("");
    console.log(`Láminas dibujadas (${r.files.length}) en: ${outDir}`);
    if (r.avisoRender) console.log(`⚠️  ${r.avisoRender}`);
  } else if (dibujar) {
    console.log("");
    console.log("--render solo dibuja carruseles; el video se arma con el pipeline completo.");
  }

  console.log("\n(Nada de esto se guardó: es solo una vista previa.)");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
