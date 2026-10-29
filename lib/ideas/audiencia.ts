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
        "Regla de oro: cada pieza le deja algo concreto que puede hacer en su próxima entrevista. " +
        "No escribas números de teléfono ni enlaces: el contacto por WhatsApp se agrega solo " +
        "al final del caption.\n"
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

  // Con WhatsApp cargado, el botón invita a escribirle y el número reemplaza a la web
  // en el pie de la lámina: la acción es escribir, no ir a reclutmatch.cl.
  const w = whatsappCandidatos(business);
  // "Escríbele a Andrea por WhatsApp" no cabe en una línea del botón (se probó: queda
  // partido en dos). El nombre va en el botón y "WhatsApp" junto al número, abajo.
  const botonWsp = w ? (w.contacto ? `Escríbele a ${w.contacto}` : "Escríbenos por WhatsApp") : "";
  const boton = texto("ctaButtonCandidatos", botonWsp);
  return {
    ...business,
    ctaText: texto("ctaCandidatos", "Prepara tu próxima entrevista"),
    tagline: texto("taglineCandidatos", "Preparación de entrevistas"),
    website: w ? "" : business.website,
    phone: w ? `WhatsApp ${w.numero}` : business.phone,
    brandJson: boton ? JSON.stringify({ ...brand, ctaButton: boton }) : business.brandJson,
  };
}

/**
 * WhatsApp para candidatos (pedido de Rodrigo, 28-oct-2026): «con un botón de
 * WhatsApp, que le hable directo a Andrea». Se carga en el brandJson del negocio:
 *   whatsappCandidatos: "+56 9 1234 5678"   (con o sin espacios)
 *   contactoCandidatos: "Andrea"            (nombre que aparece en el botón)
 * Sin número, todo sigue como antes (botón a reclutmatch.cl).
 *
 * En Instagram nada de un post es clicable — ni la imagen ni los links del texto —,
 * así que el número tiene que VERSE en la lámina para poder copiarlo. El link wa.me
 * va al final del caption, donde Facebook y LinkedIn sí lo dejan tocar.
 */
export function whatsappCandidatos(business: Business): { numero: string; enlace: string; contacto: string } | null {
  let brand: Record<string, unknown> = {};
  try {
    brand = JSON.parse(business.brandJson || "{}");
  } catch {
    return null;
  }
  const crudo = typeof brand.whatsappCandidatos === "string" ? brand.whatsappCandidatos : "";
  const digitos = crudo.replace(/\D/g, "");
  // Un número chileno completo tiene 11 dígitos (56 + 9 + 8). Menos que eso es un
  // dato a medio cargar: mejor no publicar un número que no conecta con nadie.
  if (digitos.length < 11) return null;
  const contacto = typeof brand.contactoCandidatos === "string" ? brand.contactoCandidatos.trim() : "";
  const numero = /^569\d{8}$/.test(digitos)
    ? `+56 9 ${digitos.slice(3, 7)} ${digitos.slice(7)}`
    : `+${digitos}`;
  const saludo = contacto ? `Hola ${contacto}` : "Hola";
  const mensaje = `${saludo}, vi la publicación de ${business.name} y quiero preparar mi entrevista de trabajo.`;
  return { numero, enlace: `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`, contacto };
}

/**
 * Cierre del caption para candidatos: el número y el link los pone el código, no la
 * IA — un dígito mal copiado manda a la gente a un número equivocado.
 */
export function cerrarCaption(business: Business, pilar: string, caption: string): string {
  if (audienciaDe(pilar) !== "candidatos") return caption;
  const w = whatsappCandidatos(business);
  if (!w) return caption;
  const quien = w.contacto ? `Escríbele a ${w.contacto}` : "Escríbenos";
  return `${caption.trimEnd()}\n\n💬 ${quien} por WhatsApp: ${w.numero}\n${w.enlace}`;
}
