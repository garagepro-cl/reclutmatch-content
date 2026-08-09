import Anthropic from "@anthropic-ai/sdk";
import type { Business } from "@prisma/client";
import type { Idea, IdeaSlide } from "./types";
import { parseTopics } from "../brands";
import { listPhotos } from "../photos";
import { seasonContext } from "../season";

const SLIDE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título corto de la slide" },
    body: {
      type: "string",
      description: "Texto de la slide, 1-2 frases (máx 200 caracteres). En layout 'list' es una bajada corta opcional.",
    },
    layout: {
      type: "string",
      enum: ["split", "list", "statement", "compare"],
      description:
        "split = texto + foto (el más común) · list = título + 3-4 puntos · " +
        "statement = frase gigante de impacto, sin foto · compare = tabla ✗/✓",
    },
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "Solo para layout 'list': 3-4 puntos de máx 60 caracteres",
    },
    compareLeftLabel: { type: "string", description: "Solo 'compare': etiqueta columna izquierda (lo malo)" },
    compareLeft: {
      type: "array",
      items: { type: "string" },
      description: "Solo 'compare': 3-4 ítems columna izquierda, máx 45 caracteres",
    },
    compareRightLabel: { type: "string", description: "Solo 'compare': etiqueta columna derecha (lo bueno)" },
    compareRight: {
      type: "array",
      items: { type: "string" },
      description: "Solo 'compare': 3-4 ítems columna derecha, máx 45 caracteres",
    },
    imagePrompt: {
      type: "string",
      description:
        "Solo para layout 'split' sin foto real: descripción EN INGLÉS de la foto ideal " +
        "(escena profesional/corporativa concreta, sin texto ni logos)",
    },
    photo: {
      type: "string",
      description: "Solo si una foto de la biblioteca calza con esta slide: su nombre de archivo exacto",
    },
  },
  required: ["title", "body"],
  additionalProperties: false,
} as const;

const IDEA_SCHEMA = {
  type: "object",
  properties: {
    pillar: { type: "string", description: "Pilar de contenido usado" },
    title: {
      type: "string",
      description: "Gancho principal para la portada, máx 55 caracteres, SIN punto final (se agrega uno violeta)",
    },
    hook: {
      type: "string",
      description: "Frase de apoyo bajo el título, máx 90 caracteres",
    },
    coverImagePrompt: {
      type: "string",
      description:
        "Descripción EN INGLÉS de la imagen de portada: escena corporativa/profesional cinematográfica " +
        "relacionada al tema (sin texto, sin logos, sin marcas de agua)",
    },
    coverPhoto: {
      type: "string",
      description: "Solo si una foto de la biblioteca calza perfecto de portada: su nombre de archivo exacto",
    },
    slides: { type: "array", items: SLIDE_SCHEMA },
    caption: {
      type: "string",
      description:
        "Caption que funcione en LinkedIn e Instagram: parte con un gancho fuerte en la primera " +
        "línea, desarrolla en 2-4 líneas cortas, cierra con CTA. Emojis con moderación (tono B2B)",
    },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "8-10 hashtags con #",
    },
  },
  required: ["pillar", "title", "hook", "coverImagePrompt", "slides", "caption", "hashtags"],
  additionalProperties: false,
} as const;

/**
 * Genera una idea con Claude. Lanza excepción si falla — el caller
 * decide el fallback (banco de ideas).
 */
export async function generateIdeaWithAI(
  business: Business,
  type: "CAROUSEL" | "VIDEO",
  recentTitles: string[],
  customPrompt?: string,
  pilarForzado?: string,
): Promise<Idea> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const topics = parseTopics(business);
  const photos = listPhotos(business.slug);

  const system =
    `Eres estratega de contenido para redes sociales de "${business.name}" ` +
    `(${business.tagline}). Descripción del negocio: ${business.description}\n\n` +
    `El contenido se publica en LinkedIn (página de empresa) e Instagram. ` +
    `Audiencia principal: dueños de PYME, gerentes y encargados de selección en Chile (B2B); ` +
    `secundaria: candidatos y profesionales interesados en su desarrollo. ` +
    `Escribes en español de Chile, tono profesional-cercano y con autoridad técnica, sin jerga ` +
    `académica ni promesas infladas. Puedes citar conceptos reales (Big Five, validez predictiva, ` +
    `entrevista estructurada, costo de rotación) siempre explicados simple.\n` +
    `Pilares de contenido disponibles: ${topics.join(", ")}.\n` +
    `El contenido debe ser útil de verdad, específico y creíble — nada de relleno genérico de RRHH. ` +
    `Regla de oro: cada pieza deja al lector sabiendo algo accionable sobre contratar mejor.\n\n` +
    seasonContext();

  const layoutGuide =
    "\n\nDiseño de las slides (estética premium: fondo azul marino profundo, tipografía blanca gigante, acentos violeta, fotos corporativas oscuras):\n" +
    "- 'split' (texto + foto) es el layout más usado. Dale un imagePrompt EN INGLÉS con una escena profesional concreta y oscura (ej: 'two professionals in a job interview across a table, modern dark office, moody cinematic light').\n" +
    "- 'list' para enumeraciones (señales de alerta, checklist, pasos): 3-4 bullets cortos.\n" +
    "- 'statement' UNA vez por carrusel máximo: la frase de impacto que la gente comparte (penúltima slide idealmente). Sin foto.\n" +
    "- 'compare' solo cuando el contraste aporte (contratar por intuición vs con datos, CV vs evidencia).\n" +
    "- Varía los layouts: un carrusel con puras slides iguales aburre.";

  const photoGuide = photos.length
    ? `\n\nBiblioteca de fotos REALES disponibles (prefiérelas sobre la IA cuando el tema calce — el nombre describe el contenido):\n${photos.map((p) => `- ${p}`).join("\n")}\n` +
      "Usa el campo photo/coverPhoto con el nombre exacto. Si ninguna calza, deja imagePrompt y se genera con IA."
    : "";

  const format =
    type === "CAROUSEL"
      ? "Genera UNA idea de carrusel de Instagram (5-6 slides de contenido; la portada y el cierre CTA se agregan aparte, NO los incluyas como slides). La primera impresión la da el título: debe generar curiosidad o urgencia. Cada slide aporta un dato concreto."
      : "Genera UNA idea de video corto vertical tipo Reel (5 slides de texto animado). La primera slide es el gancho (pregunta o dato sorprendente), las siguientes desarrollan.";
  const cta = ` El cierre con llamado a la acción ("${business.ctaText}") se agrega automáticamente — no lo repitas en las slides.`;

  // El pilar viene decidido desde afuera (rotación en lib/ideas/index.ts):
  // dejando elegir a la IA, siempre volvía a los mismos dos de los cinco.
  const pilarLine = !customPrompt?.trim() && pilarForzado
    ? `\n\nPara esta pieza usa EXACTAMENTE este pilar de contenido: "${pilarForzado}". ` +
      `Los demás pilares quedan para otros días — no los mezcles ni los sustituyas.`
    : "";

  const prompt = customPrompt?.trim()
    ? `${format}${cta}\n\nEl usuario pidió específicamente este tema/enfoque — respétalo al pie de la letra, no lo cambies por otro pilar:\n"${customPrompt.trim()}"`
    : `${format}${cta}${pilarLine}`;

  const avoid =
    recentTitles.length > 0
      ? `\n\nEVITA repetir estos temas ya publicados recientemente:\n- ${recentTitles.join("\n- ")}`
      : "";

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system,
    output_config: {
      format: { type: "json_schema", schema: IDEA_SCHEMA },
    },
    messages: [{ role: "user", content: prompt + layoutGuide + photoGuide + avoid }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("La IA rechazó la solicitud (refusal)");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Respuesta de IA sin contenido de texto");
  }

  const parsed = JSON.parse(textBlock.text);
  if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length < 3) {
    throw new Error("Idea generada incompleta");
  }

  // Solo aceptamos fotos que existan de verdad en la biblioteca
  const photoSet = new Set(photos);
  const cleanPhoto = (p?: string) => (p && photoSet.has(p) ? p : undefined);

  const slides: IdeaSlide[] = parsed.slides.map((s: IdeaSlide) => ({
    ...s,
    photo: cleanPhoto(s.photo),
  }));

  return {
    // El pilar guardado es el que decidió la rotación, no el que declare la IA:
    // escribiéndolo a su manera rompía el conteo y un mismo pilar se contaba dos veces.
    pillar: (!customPrompt?.trim() && pilarForzado) || parsed.pillar || "",
    type,
    title: parsed.title,
    hook: parsed.hook ?? "",
    slides,
    caption: parsed.caption ?? "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    coverImagePrompt: parsed.coverImagePrompt || undefined,
    coverPhoto: cleanPhoto(parsed.coverPhoto),
  };
}
