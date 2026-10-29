import type { Business } from "@prisma/client";

/**
 * A quién le habla una pieza.
 *
 * ReclutMatch nació hablándole a quien CONTRATA (el dueño de una PYME). Desde el
 * 28-oct-2026 también le habla a quien BUSCA TRABAJO, para ofrecerle prepararse
 * para sus entrevistas (pedido de Rodrigo). Son dos públicos con todo distinto: la
 * persona que habla, las imágenes y el cierre. «Evalúa antes de contratar» al final
 * de una pieza para alguien sin trabajo sería un sinsentido.
 *
 * La audiencia viaja en el NOMBRE del pilar o de la idea: los que empiezan con
 * «Candidatos:» son para quien busca trabajo. Así se agregan o quitan temas desde el
 * panel de Negocios, y una idea se anota con `/idea candidatos: ...`, sin tocar código.
 */
export type Audiencia = "empresas" | "candidatos";

const PREFIJO = /^\s*candidatos\s*:/i;

/** Primer texto que declare la audiencia manda; sin ninguno, es para empresas. */
export function audienciaDe(...textos: (string | undefined | null)[]): Audiencia {
  return textos.some((t) => t && PREFIJO.test(t)) ? "candidatos" : "empresas";
}

/** Garantiza que el pilar guardado lleve la marca, para que el render sepa a quién le habla. */
export function marcarPilar(pilar: string, audiencia: Audiencia): string {
  if (audiencia !== "candidatos" || PREFIJO.test(pilar)) return pilar;
  return `Candidatos: ${pilar || "idea propia"}`;
}

/** Quién lee y qué tiene que llevarse, según la audiencia. Va en el prompt de sistema. */
export function lectorDe(audiencia: Audiencia): string {
  return audiencia === "candidatos"
    ? "Esta pieza le habla a una PERSONA QUE BUSCA TRABAJO en Chile: está postulando, va a " +
        "entrevistas, o acaba de salir de un proceso en que no quedó. No le hables a empresas. " +
        "Regla de oro: cada pieza le deja algo concreto que puede hacer en su próxima entrevista.\n"
    : "Audiencia principal: dueños de PYME, gerentes y encargados de selección en Chile (B2B); " +
        "secundaria: candidatos y profesionales interesados en su desarrollo. " +
        "Regla de oro: cada pieza deja al lector sabiendo algo accionable sobre contratar mejor.\n";
}

/**
 * El negocio tal como se debe ver en una pieza de esa audiencia: el cierre y la bajada
 * cambian. Se pueden ajustar sin desplegar con `ctaCandidatos`, `taglineCandidatos` y
 * `ctaButtonCandidatos` dentro del brandJson del negocio.
 */
export function negocioParaAudiencia(business: Business, audiencia: Audiencia): Business {
  if (audiencia !== "candidatos") return business;
  let brand: Record<string, unknown> = {};
  try {
    brand = JSON.parse(business.brandJson || "{}");
  } catch {
    /* brandJson inválido: se usan los valores por defecto */
  }
  const texto = (k: string, porDefecto: string) =>
    typeof brand[k] === "string" && (brand[k] as string).trim() ? (brand[k] as string) : porDefecto;

  const boton = texto("ctaButtonCandidatos", "");
  return {
    ...business,
    ctaText: texto("ctaCandidatos", "Prepara tu próxima entrevista"),
    tagline: texto("taglineCandidatos", "Preparación de entrevistas"),
    brandJson: boton ? JSON.stringify({ ...brand, ctaButton: boton }) : business.brandJson,
  };
}
