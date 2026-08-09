import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Business } from "@prisma/client";
import { parseBrand } from "../brands";
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
}

/** Máximo de imágenes generadas con IA por carrusel (control de costo) */
const MAX_AI_IMAGES = 4;

/** Envuelve el prompt de la IA con el estilo visual de la marca */
function styleWrap(prompt: string, business: Business): string {
  const context = business.description || business.tagline || business.name;
  return (
    `${prompt}. Context: ${context}. ` +
    "Dark premium corporate photography, modern office environment with deep navy and violet ambient tones, " +
    "dramatic cinematic lighting, shallow depth of field, professional people in business settings, " +
    "photorealistic, high-end editorial style. " +
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
      try {
        const bytes = await generateImage(styleWrap(prompt, business), {
          aspectRatio: "4:5",
          resolution: "1K",
        });
        return await bytesToDataUrl(bytes);
      } catch (err) {
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
  return { cover, slides };
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
  return { files, cover: files[0] };
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
