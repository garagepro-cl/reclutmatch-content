/**
 * Prueba del motor premium con una idea simulada que ejercita todos los
 * layouts (portada, split, list, compare, statement, CTA) SIN llamar a la
 * IA ni gastar crédito (no hay fotos de biblioteca: los split degradan a
 * panel de texto, que es el caso base sin KIE).
 * Uso: npx tsx scripts/test-premium.ts [slug]
 */
import path from "node:path";
import { prisma } from "../lib/db";
import { renderCarouselPremium } from "../lib/render/carousel";
import type { PremiumRenderData } from "../lib/render/premium";

const MOCK: PremiumRenderData = {
  title: "El candidato perfecto que fue un desastre",
  hook: "Currículum impecable no es sinónimo de encaje. Esto es lo que faltó medir.",
  pillar: "fit empresarial (el match candidato-empresa)",
  slides: [
    {
      title: "La historia se repite",
      body:
        "Gran CV, buenas referencias, entrevista brillante. A los 4 meses, renuncia o hay " +
        "que pedírsela. ¿Te suena?",
      layout: "split",
    },
    {
      title: "Qué es el fit real",
      body: "El match se mide en tres capas:",
      layout: "list",
      bullets: [
        "Persona y cargo: rasgos vs exigencias",
        "Persona y equipo: cómo colabora",
        "Persona y empresa: ritmo y cultura",
      ],
    },
    {
      title: "¿Cómo decides hoy?",
      layout: "compare",
      body: "",
      compareLeftLabel: "Solo CV",
      compareLeft: [
        "Dice qué hizo",
        "No dice cómo trabaja",
        "Se maquilla fácil",
      ],
      compareRightLabel: "CV + evaluación",
      compareRight: [
        "Muestra cómo es",
        "Predice cómo rendirá",
        "Se compara con el cargo",
      ],
    },
    {
      title: "Un excelente profesional en el cargo equivocado rinde menos que uno promedio en el correcto",
      body: "Eso es el encaje.",
      layout: "statement",
    },
    {
      title: "Medirlo antes de contratar",
      body:
        "ReclutMatch compara al candidato contra 35 perfiles de cargo calibrados y te " +
        "muestra el ranking de encaje en un informe profesional.",
      layout: "split",
    },
  ],
};

async function main() {
  const slug = process.argv[2] || "reclutmatch";
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw new Error(`Negocio no encontrado: ${slug}`);

  const outDir = path.join(process.cwd(), "data", "output", `test-premium-${slug}`);
  const result = await renderCarouselPremium(business, MOCK, outDir);
  console.log(`✔ ${result.files.length} slides renderizadas en ${outDir}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
