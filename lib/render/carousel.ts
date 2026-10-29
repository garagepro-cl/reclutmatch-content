import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Business } from "@prisma/client";
import { parseBrand } from "../brands";
import { audienciaDe, type Audiencia } from "../ideas/audiencia";
import { generateImage } from "../ai/gpt-image";
import {
  buildCarouselSlides,
  buildCarouselOverlaySlides,
  CAROUSEL_W,
  CAROUSEL_H,
  type RenderData,
} from "./templates";
import {
  buildPremiumCarouselSlides,
  type PremiumRenderData,
  type ResolvedImages,
} from "./premium";
import { photoDataUrl, bytesToDataUrl } from "../photos";
import { renderElements } from "./rasterize";

const execFileAsync = promisify(execFile);

export interface CarouselResult {
  files: string[];
  cover: string;
  /**
   * Aviso legible si la pieza salio peor de lo normal (por ejemplo, sin las
   * imagenes de IA). Vacio o ausente = salio como corresponde.
   */
  avisoRender?: string;
}

/**
 * Traduce los fallos de imagen a una frase que una persona entienda al vuelo,
 * sin tener que entrar al journal del servidor.
 */
export function avisoDeImagenes(
  intentos: number,
  fallos: number,
  motivo?: string,
): string | undefined {
  if (fallos === 0) return undefined;
  const sinSaldo = /credit|balance|insufficient|quota|top up/i.test(motivo ?? "");
  const cuantas =
    fallos >= intentos
      ? "sin ninguna de sus imagenes"
      : `sin ${fallos} de sus ${intentos} imagenes`;
  return sinSaldo
    ? `Esta pieza salio ${cuantas}: se acabaron los creditos del generador de imagenes. Hay que recargar saldo antes de aprobarla.`
    : `Esta pieza salio ${cuantas}. Fallo el generador: ${(motivo ?? "motivo desconocido").slice(0, 120)}`;
}

/** Máximo de imágenes generadas con IA por carrusel (control de costo) */
const MAX_AI_IMAGES = 4;

/**
 * Tratamientos visuales. Antes había UNO solo —«dark premium corporate photography,
 * modern office environment... professional people in business settings»— para
 * todas las imágenes. Dos problemas: todas las piezas se veían iguales, y mostraban
 * oficinas corporativas de vidrio cuando el cliente de ReclutMatch es el dueño de
 * una PYME. Mismo arreglo que Garage Pro (17-oct-2026).
 *
 * Rotan por lámina dentro de un carrusel y arrancan en un punto distinto según el
 * título, así que dos piezas seguidas no comparten la secuencia.
 */
const TRATAMIENTOS: { nombre: string; arte: string }[] = [
  {
    nombre: "documental",
    arte:
      "Candid documentary photography, natural daylight from a window, unstaged, " +
      "people in the middle of real work, 35mm reportage feel, mild grain",
  },
  {
    nombre: "detalle",
    arte:
      "Close-up detail on a work desk: hands, a pen and printed sheets seen at an angle " +
      "so nothing is readable, soft side light, shallow background",
  },
  {
    nombre: "conversacion",
    arte:
      "Two people talking across a table, over-the-shoulder framing, warm natural light, " +
      "attentive and genuine expressions, quiet honest mood",
  },
  {
    nombre: "equipo",
    arte:
      "A small team working together, mixed ages, casual-professional clothing, wide shot, " +
      "cool daylight, unpretentious and real",
  },
  {
    nombre: "cinematico",
    arte:
      "Dark premium editorial photography, deep navy and violet ambient tones, " +
      "dramatic cinematic lighting, shallow depth of field",
  },
];

/**
 * Dónde ocurre la escena. Antes era siempre «modern office environment»: el gerente
 * de una multinacional, no el dueño de la ferretería que contrata a ReclutMatch.
 */
const ESCENARIOS_PYME = [
  "a small family-run hardware store in Chile",
  "the office corner of a mid-size distribution warehouse",
  "a neighbourhood restaurant before opening hours",
  "a small accounting firm with a few desks",
  "the shop floor of a retail store",
  "the site office of a small construction company",
];

/**
 * Escenas para las piezas dirigidas a quien busca trabajo (desde el 28-oct-2026).
 * La ferretería o la bodega no le dicen nada a alguien que está esperando que lo llamen.
 */
const ESCENARIOS_CANDIDATOS = [
  "a small apartment in Santiago, someone at the kitchen table with notes before a job interview",
  "the reception area of an office, a candidate waiting to be called in",
  "a home desk with a laptop during a video-call job interview",
  "the street outside an office building right after a job interview",
  "a metro seat in Santiago, someone checking their phone for a message that has not arrived",
  "a small meeting room during a job interview, seen from the candidate's side of the table",
];

/** Suma de caracteres del título: desplaza la secuencia para que cada pieza empiece distinto. */
export function semilla(texto: string): number {
  let n = 0;
  for (let i = 0; i < texto.length; i++) n = (n + texto.charCodeAt(i)) % 997;
  return n;
}

/**
 * Envuelve el prompt con la dirección de arte y el escenario que le tocan a esta
 * lámina. `indice` es la posición dentro del carrusel (la portada es 0).
 */
export function styleWrap(
  prompt: string,
  business: Business,
  indice: number,
  desplazamiento: number,
  audiencia: Audiencia = "empresas",
): string {
  // Para candidatos, la descripción del negocio (B2B, PYMEs, evaluación) empujaría la
  // imagen a una oficina de empresa: el contexto tiene que ser el de quien postula.
  const context =
    audiencia === "candidatos"
      ? "a person in Chile looking for a job and preparing for interviews"
      : business.description || business.tagline || business.name;
  const t = TRATAMIENTOS[(indice + desplazamiento) % TRATAMIENTOS.length];
  const escenarios = audiencia === "candidatos" ? ESCENARIOS_CANDIDATOS : ESCENARIOS_PYME;
  const lugar = escenarios[(indice + desplazamiento) % escenarios.length];
  return (
    `${prompt}. Context: ${context}. Setting: ${lugar}. ` +
    `${t.arte}, photorealistic. ` +
    "No text, no words, no logos, no watermarks, no readable documents or screens."
  );
}

/**
 * Resuelve la imagen de cada slide: primero foto real de la biblioteca,
 * después generación con IA (si hay KIE_API_KEY y queda presupuesto),
 * y si no, undefined (la plantilla degrada a layout de texto).
 */
async function resolveImages(
  business: Business,
  data: PremiumRenderData,
): Promise<ResolvedImages> {
  const canGenerate = Boolean(process.env.KIE_API_KEY);
  let aiBudget = MAX_AI_IMAGES;
  let intentosIA = 0;
  let fallosIA = 0;
  let motivoFallo: string | undefined;
  // Cada lámina que pide imagen avanza un tratamiento y un escenario; el
  // desplazamiento hace que dos piezas seguidas no arranquen igual.
  let indiceImagen = 0;
  const desplazamiento = semilla(data.title ?? "");
  const audiencia = audienciaDe(data.pillar);

  const resolveOne = async (
    photo?: string,
    prompt?: string,
  ): Promise<string | undefined> => {
    if (photo) {
      const url = await photoDataUrl(business.slug, photo);
      if (url) return url;
    }
    if (prompt && canGenerate && aiBudget > 0) {
      aiBudget--;
      intentosIA++;
      try {
        const bytes = await generateImage(styleWrap(prompt, business, indiceImagen++, desplazamiento, audiencia), {
          aspectRatio: "4:5",
          resolution: "1K",
        });
        return await bytesToDataUrl(bytes);
      } catch (err) {
        fallosIA++;
        motivoFallo = err instanceof Error ? err.message : String(err);
        console.error("[render] Falló la generación de imagen IA:", err);
      }
    }
    return undefined;
  };

  // La portada primero: es la imagen más importante del carrusel
  const cover = await resolveOne(data.coverPhoto, data.coverImagePrompt);

  const slides: (string | undefined)[] = [];
  for (const s of data.slides.slice(0, 7)) {
    const wantsImage =
      s.layout === "split" || (!s.layout && Boolean(s.photo || s.imagePrompt));
    slides.push(wantsImage ? await resolveOne(s.photo, s.imagePrompt) : undefined);
  }
  return { cover, slides, intentosIA, fallosIA, motivoFallo };
}

/**
 * Renderiza el carrusel con las plantillas premium (estilo referencia):
 * fotos reales o IA fundidas al negro, layouts variados, punto amarillo.
 * Render en una sola pasada de satori (las fotos van embebidas como data URL).
 */
export async function renderCarouselPremium(
  business: Business,
  data: PremiumRenderData,
  outDir: string,
): Promise<CarouselResult> {
  const brand = parseBrand(business);
  const images = await resolveImages(business, data);
  const elements = buildPremiumCarouselSlides(business, brand, data, images);
  const files = await renderElements(elements, CAROUSEL_W, CAROUSEL_H, outDir);
  return {
    files,
    cover: files[0],
    avisoRender: avisoDeImagenes(images.intentosIA, images.fallosIA, images.motivoFallo),
  };
}

/** Renderiza el carrusel completo (portada + contenido + CTA) a PNGs 1080×1350 */
export async function renderCarousel(
  business: Business,
  data: RenderData,
  outDir: string,
): Promise<CarouselResult> {
  const brand = parseBrand(business);
  const elements = buildCarouselSlides(business, brand, data);
  const files = await renderElements(elements, CAROUSEL_W, CAROUSEL_H, outDir);
  return { files, cover: files[0] };
}

/**
 * Igual que renderCarousel pero con una foto real generada por IA (GPT Image 2,
 * vía Kie.ai) de fondo en cada slide, en vez de las tarjetas de color plano.
 * El texto se superpone en transparente. Requiere KIE_API_KEY. No se usa
 * todavía en el pipeline automático — función independiente para probar
 * calidad antes de conectarla al scheduler.
 */
export async function renderCarouselWithAiBackground(
  business: Business,
  data: RenderData,
  outDir: string,
): Promise<CarouselResult> {
  if (!process.env.KIE_API_KEY) {
    throw new Error("KIE_API_KEY no configurado");
  }
  if (!ffmpegPath) throw new Error("ffmpeg-static no encontró el binario de FFmpeg");

  const brand = parseBrand(business);
  const elements = buildCarouselOverlaySlides(business, brand, data);
  const textFiles = await renderElements(elements, CAROUSEL_W, CAROUSEL_H, outDir, "text");

  const prompt = buildImagePrompt(business, data);
  const bgBytes = await generateImage(prompt, { aspectRatio: "4:5", resolution: "1K" });
  const bgFile = path.join(outDir, "ai-bg.jpg");
  fs.writeFileSync(bgFile, bgBytes);

  const files: string[] = [];
  for (let i = 0; i < textFiles.length; i++) {
    const outName = `slide-${String(i + 1).padStart(2, "0")}.png`;
    const args = [
      "-y",
      "-i", bgFile,
      "-i", path.join(outDir, textFiles[i]),
      "-filter_complex",
      `[0:v]scale=${CAROUSEL_W}:${CAROUSEL_H}:force_original_aspect_ratio=increase,crop=${CAROUSEL_W}:${CAROUSEL_H}[bg];[bg][1:v]overlay`,
      "-frames:v", "1",
      path.join(outDir, outName),
    ];
    await execFileAsync(ffmpegPath as unknown as string, args, {
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    files.push(outName);
  }

  // Limpieza: solo dejamos los slide-XX.png finales en outDir
  fs.rmSync(bgFile, { force: true });
  for (const f of textFiles) fs.rmSync(path.join(outDir, f), { force: true });

  return { files, cover: files[0] };
}

/** Construye el prompt visual para GPT Image 2 a partir del negocio y la idea */
function buildImagePrompt(business: Business, data: RenderData): string {
  const context = business.description || business.tagline || business.name;
  return [
    `Realistic professional photo, modern corporate office context for "${business.name}".`,
    context,
    `Scene related to: ${data.title}.`,
    "Cinematic lighting, shallow depth of field, high production value, photorealistic, editorial photography style.",
    "No text, no logos, no watermarks, no on-screen graphics, no subtitles.",
  ].join(" ");
}
