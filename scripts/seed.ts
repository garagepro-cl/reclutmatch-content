/**
 * Crea/actualiza el negocio inicial: ReclutMatch.
 * Uso: npm run seed
 */
import { prisma } from "../lib/db";

async function main() {
  await prisma.business.upsert({
    where: { slug: "reclutmatch" },
    create: {
      slug: "reclutmatch",
      name: "ReclutMatch",
      tagline: "Selección · Headhunting · Evaluación",
      description:
        "Servicio chileno de reclutamiento, headhunting y evaluación psicométrica online. " +
        "Test de personalidad IPIP-120 (Big Five) con informe profesional y ranking de " +
        "encaje contra 35 perfiles de cargo calibrados. Ayuda a PYMEs y equipos de RRHH " +
        "a contratar con evidencia y no con corazonadas. Consentimiento informado y " +
        "resguardo de datos según la Ley 21.719. El match perfecto entre el talento y tu empresa.",
      website: "reclutmatch.cl",
      instagram: "@reclutmatch",
      facebook: "",
      phone: "",
      ctaText: "Evalúa antes de contratar",
      brandJson: JSON.stringify({
        bg: "#181048",
        panel: "#221A57",
        text: "#FFFFFF",
        muted: "#A29ECB",
        primary: "#8840F8",
        primaryLight: "#A970FF",
        silver: "#C9C4E4",
        accent: "#5B8CFF",
        logoFile: "logo.png",
        logoAspect: 5.6,
        ctaButton: "Escríbenos en reclutmatch.cl",
      }),
      topicsJson: JSON.stringify([
        "fit empresarial (el match candidato-empresa)",
        "errores de contratación y su costo",
        "educación en selección (tests, Big Five, entrevistas)",
        "producto ReclutMatch (informe, perfiles de cargo)",
        "tendencias RRHH Chile (Ley 21.719, mercado laboral)",
      ]),
      platformsJson: JSON.stringify(["instagram", "facebook", "linkedin"]),
    },
    update: {},
  });

  const count = await prisma.business.count();
  console.log(`✔ Seed listo. Negocios en la base: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
