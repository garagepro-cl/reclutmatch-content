/**
 * Verifica que las piezas para quien busca trabajo (desde el 28-oct-2026) no se
 * mezclen con las que le hablan a empresas: lector, voz, imágenes y cierre.
 *
 *   npm run test-audiencia
 */
import type { Business } from "@prisma/client";
import { audienciaDe, marcarPilar, negocioParaAudiencia, lectorDe } from "../lib/ideas/audiencia";
import { vozDeMarca } from "../lib/ideas/voz";
import { styleWrap } from "../lib/render/carousel";

let fallas = 0;
const chk = (ok: boolean, d: string) => { console.log((ok ? "  OK   " : "  MAL  ") + d); if (!ok) fallas++; };

const negocio = {
  slug: "reclutmatch", name: "ReclutMatch", tagline: "Selección · Headhunting · Evaluación",
  description: "Ayuda a PYMEs a contratar", ctaText: "Evalúa antes de contratar",
  brandJson: JSON.stringify({ ctaButton: "Escríbenos en reclutmatch.cl", primary: "#8840F8" }),
} as unknown as Business;

// 1. Detección por el nombre del pilar o de la idea
chk(audienciaDe("Candidatos: te fue bien y nadie te llamó") === "candidatos", "pilar \"Candidatos: ...\" -> candidatos");
chk(audienciaDe("  candidatos:prepárate") === "candidatos", "mayúsculas y espacios no importan");
chk(audienciaDe("fit empresarial (el match candidato-empresa)") === "empresas", "un pilar que solo MENCIONA candidatos sigue siendo para empresas");
chk(audienciaDe(undefined, "candidatos: idea anotada por /idea") === "candidatos", "una idea anotada con /idea candidatos: también cuenta");
chk(audienciaDe(undefined, undefined) === "empresas", "sin datos -> empresas (lo de siempre)");

// 2. El pilar guardado lleva la marca, para que el render sepa a quién le habla
chk(marcarPilar("preparar la entrevista", "candidatos") === "Candidatos: preparar la entrevista", "pilar sin marca se marca");
chk(marcarPilar("Candidatos: x", "candidatos") === "Candidatos: x", "no se marca dos veces");
chk(marcarPilar("fit empresarial", "empresas") === "fit empresarial", "empresas no se toca");

// 3. El cierre
const cand = negocioParaAudiencia(negocio, "candidatos");
chk(cand.ctaText === "Prepara tu próxima entrevista", `cierre para candidatos: "${cand.ctaText}"`);
chk(!/contratar/i.test(cand.ctaText + cand.tagline), "el cierre para candidatos no habla de contratar");
chk(negocioParaAudiencia(negocio, "empresas") === negocio, "empresas: el negocio queda idéntico");
const conAjuste = negocioParaAudiencia({ ...negocio, brandJson: JSON.stringify({ ctaCandidatos: "Agenda tu asesoría", ctaButtonCandidatos: "Escríbenos por WhatsApp" }) } as Business, "candidatos");
chk(conAjuste.ctaText === "Agenda tu asesoría" && JSON.parse(conAjuste.brandJson).ctaButton === "Escríbenos por WhatsApp",
  "el cierre se ajusta desde brandJson sin desplegar");
chk(negocioParaAudiencia({ ...negocio, brandJson: "{roto" } as Business, "candidatos").ctaText === "Prepara tu próxima entrevista",
  "brandJson roto no rompe la pieza");

// 4. Quién lee y quién habla
chk(lectorDe("candidatos").includes("BUSCA TRABAJO") && !lectorDe("candidatos").includes("dueños de PYME"), "lector candidatos: no le habla a empresas");
chk(lectorDe("empresas").includes("dueños de PYME"), "lector empresas: sin cambios");
for (const r of ["a", "b", "c"] as const) {
  const v = vozDeMarca(r, "candidatos");
  chk(v.includes("nunca prometas que va a conseguir el trabajo") && v.includes("ganarle"),
    `voz candidatos (${r}) trae los límites: no promete trabajo, no enseña a engañar tests`);
  chk(!v.includes("dueño de una PYME"), `voz candidatos (${r}) no se le coló la persona B2B`);
}
chk(vozDeMarca("a").includes("dueño de una PYME"), "voz empresas sin cambios");

// 5. Imágenes
const imgs = Array.from({ length: 12 }, (_, i) => styleWrap("x", negocio, i, 0, "candidatos"));
chk(!imgs.some((s) => /hardware store|warehouse|restaurant|construction|accounting firm|retail store/.test(s)),
  "imágenes para candidatos nunca usan escenas de PYME");
chk(imgs.every((s) => s.includes("looking for a job")), "imágenes para candidatos: contexto de quien postula");
chk(styleWrap("x", negocio, 0, 0).includes("Ayuda a PYMEs"), "imágenes para empresas sin cambios");

console.log(fallas === 0 ? "\nTodo en orden." : `\n${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
