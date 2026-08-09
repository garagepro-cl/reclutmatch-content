import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Business } from "@prisma/client";
import { parseBrand, PROJECT_ROOT } from "../brands";
import { generateVeoVideo } from "../ai/veo";
import {
  buildVideoSlides,
  buildVideoOverlaySlides,
  VIDEO_W,
  VIDEO_H,
  type RenderData,
} from "./templates";
import { renderElements } from "./rasterize";

const execFileAsync = promisify(execFile);

const FPS = 30;
const SLIDE_SECONDS = 3.8;
const FADE_SECONDS = 0.6;

export interface VideoResult {
  videoFile: string;
  slideFiles: string[];
  durationSeconds: number;
  hasMusic: boolean;
}

/**
 * Renderiza el video vertical: slides satori → PNGs → FFmpeg con
 * zoom suave (Ken Burns) + crossfade + música opcional de assets/music.
 */
export async function renderVideo(
  business: Business,
  data: RenderData,
  outDir: string,
): Promise<VideoResult> {
  const brand = parseBrand(business);
  const elements = buildVideoSlides(business, brand, data);
  const slideFiles = await renderElements(elements, VIDEO_W, VIDEO_H, outDir, "vslide");

  const n = slideFiles.length;
  const total = n * SLIDE_SECONDS - (n - 1) * FADE_SECONDS;
  const music = pickMusic(business.slug);
  const videoFile = "video.mp4";

  const args: string[] = ["-y"];

  // Un input por slide (imagen única; zoompan genera los frames)
  for (const f of slideFiles) {
    args.push("-framerate", String(FPS), "-i", path.join(outDir, f));
  }
  if (music) args.push("-i", music);

  // Filtros: escala + Ken Burns por slide, luego cadena de crossfades
  const dFrames = Math.round(SLIDE_SECONDS * FPS);
  const filters: string[] = [];
  for (let i = 0; i < n; i++) {
    filters.push(
      `[${i}:v]scale=${VIDEO_W * 1.5}:${VIDEO_H * 1.5},setsar=1,` +
      `zoompan=z='min(1+0.0009*on,1.10)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':` +
      `d=${dFrames}:s=${VIDEO_W}x${VIDEO_H}:fps=${FPS}[v${i}]`,
    );
  }
  let last = "v0";
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `x${i}`;
    const offset = (i * (SLIDE_SECONDS - FADE_SECONDS)).toFixed(2);
    filters.push(
      `[${last}][v${i}]xfade=transition=fade:duration=${FADE_SECONDS}:offset=${offset}[${out}]`,
    );
    last = out;
  }
  const videoLabel = n > 1 ? "vout" : "v0";

  if (music) {
    const fadeStart = Math.max(0, total - 1.5).toFixed(2);
    filters.push(
      `[${n}:a]atrim=0:${total.toFixed(2)},afade=t=in:st=0:d=0.8,` +
      `afade=t=out:st=${fadeStart}:d=1.5,volume=0.9[aout]`,
    );
  }

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${videoLabel}]`,
  );
  if (music) {
    args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
  }
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-t", total.toFixed(2),
    "-movflags", "+faststart",
    path.join(outDir, videoFile),
  );

  if (!ffmpegPath) throw new Error("ffmpeg-static no encontró el binario de FFmpeg");
  await execFileAsync(ffmpegPath as unknown as string, args, {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  if (!fs.existsSync(path.join(outDir, videoFile))) {
    throw new Error("FFmpeg terminó pero no generó el video");
  }

  return { videoFile, slideFiles, durationSeconds: total, hasMusic: Boolean(music) };
}

/**
 * Igual que renderVideo pero con un clip real generado por Veo3 (Kie.ai) de
 * fondo, en vez de las tarjetas de marca con Ken Burns. El texto se
 * superpone en transparente. Requiere KIE_API_KEY. No se usa todavía en el
 * pipeline automático — es una función independiente para probar calidad
 * antes de conectarla al scheduler.
 */
export async function renderVideoWithAiBackground(
  business: Business,
  data: RenderData,
  outDir: string,
): Promise<VideoResult> {
  if (!process.env.KIE_API_KEY) {
    throw new Error("KIE_API_KEY no configurado");
  }

  const brand = parseBrand(business);
  const elements = buildVideoOverlaySlides(business, brand, data);
  const slideFiles = await renderElements(elements, VIDEO_W, VIDEO_H, outDir, "vslide");

  const n = slideFiles.length;
  const total = n * SLIDE_SECONDS;
  const music = pickMusic(business.slug);
  const videoFile = "video.mp4";

  const prompt = buildVeoPrompt(business, data);
  const bgBytes = await generateVeoVideo(prompt, { aspectRatio: "9:16", resolution: "720p", duration: 8 });
  const bgFile = path.join(outDir, "ai-bg.mp4");
  fs.writeFileSync(bgFile, bgBytes);

  const args: string[] = ["-y", "-stream_loop", "-1", "-i", bgFile];
  for (const f of slideFiles) {
    args.push("-loop", "1", "-framerate", String(FPS), "-i", path.join(outDir, f));
  }
  if (music) args.push("-i", music);

  const filters: string[] = [`[0:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H},setsar=1[bg]`];
  let last = "bg";
  for (let i = 0; i < n; i++) {
    const start = (i * SLIDE_SECONDS).toFixed(2);
    const end = ((i + 1) * SLIDE_SECONDS).toFixed(2);
    const out = i === n - 1 ? "vout" : `t${i}`;
    filters.push(
      `[${last}][${i + 1}:v]overlay=(W-w)/2:(H-h)/2:enable='between(t,${start},${end})'[${out}]`,
    );
    last = out;
  }

  if (music) {
    const fadeStart = Math.max(0, total - 1.5).toFixed(2);
    filters.push(
      `[${n + 1}:a]atrim=0:${total.toFixed(2)},afade=t=in:st=0:d=0.8,` +
      `afade=t=out:st=${fadeStart}:d=1.5,volume=0.9[aout]`,
    );
  }

  args.push("-filter_complex", filters.join(";"), "-map", "[vout]");
  if (music) args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-t", total.toFixed(2),
    "-movflags", "+faststart",
    path.join(outDir, videoFile),
  );

  if (!ffmpegPath) throw new Error("ffmpeg-static no encontró el binario de FFmpeg");
  await execFileAsync(ffmpegPath as unknown as string, args, {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  if (!fs.existsSync(path.join(outDir, videoFile))) {
    throw new Error("FFmpeg terminó pero no generó el video");
  }

  return { videoFile, slideFiles, durationSeconds: total, hasMusic: Boolean(music) };
}

/** Construye el prompt visual para Veo3 a partir del negocio y la idea */
function buildVeoPrompt(business: Business, data: RenderData): string {
  const context = business.description || business.tagline || business.name;
  return [
    `Cinematic realistic video, modern professional office atmosphere for "${business.name}".`,
    context,
    `Scene related to: ${data.title}.`,
    "Moody dramatic lighting, shallow depth of field, slow smooth camera movement, high production value, photorealistic, 4k quality.",
    "No text, no logos, no watermarks, no on-screen graphics, no subtitles.",
  ].join(" ");
}

/**
 * Música: busca .mp3 primero en assets/music/<slug>/ y luego en assets/music/.
 * Si no hay, el video sale sin audio (Instagram/YouTube lo aceptan).
 */
function pickMusic(slug: string): string | null {
  const dirs = [
    path.join(PROJECT_ROOT, "assets", "music", slug),
    path.join(PROJECT_ROOT, "assets", "music"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const tracks = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f));
    if (tracks.length > 0) {
      return path.join(dir, tracks[Math.floor(Math.random() * tracks.length)]);
    }
  }
  return null;
}
