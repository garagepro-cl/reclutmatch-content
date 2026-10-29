import path from "node:path";
import type { Business, ContentPiece, PublishTarget } from "@prisma/client";
import { prisma } from "./db";
import { getIdea } from "./ideas";
import { renderCarousel, renderCarouselPremium } from "./render/carousel";
import { renderVideo, renderVideoWithAiBackground } from "./render/video";
import { outputDirFor } from "./brands";
import { audienciaDe, cerrarCaption, negocioParaAudiencia } from "./ideas/audiencia";

export type PieceWithBusiness = ContentPiece & { business: Business };

/**
 * Genera una pieza completa: idea → render → PENDING (lista para aprobar).
 * Notifica por Telegram si el bot está configurado.
 */
export async function createPiece(
  businessSlug: string,
  type?: "CAROUSEL" | "VIDEO",
  customPrompt?: string,
): Promise<PieceWithBusiness> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { slug: businessSlug },
  });

  // ReclutMatch publica solo carruseles (decisión 16/07). El video sigue
  // disponible si se pide explícitamente (UI o /generar con tipo).
  if (!type) {
    type = "CAROUSEL";
  }

  const { idea, source } = await getIdea(business, type, customPrompt);
  // Las piezas para quien busca trabajo cierran distinto ("Prepara tu próxima
  // entrevista", no "Evalúa antes de contratar"). Solo el render ve este negocio
  // ajustado; la base y Telegram siguen con el negocio tal cual.
  const negocioRender = negocioParaAudiencia(business, audienciaDe(idea.pillar));

  const piece = await prisma.contentPiece.create({
    data: {
      businessId: business.id,
      type,
      status: "RENDERING",
      pillar: idea.pillar,
      voz: idea.voz ?? "",
      customPrompt: customPrompt?.trim() ?? "",
      title: idea.title,
      hook: idea.hook,
      slidesJson: JSON.stringify(idea.slides),
      // Para candidatos agrega el WhatsApp de contacto (número y link los pone el código).
      caption: cerrarCaption(business, idea.pillar, idea.caption),
      hashtags: idea.hashtags.join(" "),
      source,
    },
  });

  const outDir = outputDirFor(piece.id);
  const renderData = {
    title: idea.title,
    hook: idea.hook,
    pillar: idea.pillar,
    slides: idea.slides,
    coverImagePrompt: idea.coverImagePrompt,
    coverPhoto: idea.coverPhoto,
  };

  let updated: ContentPiece;
  try {
    if (type === "CAROUSEL") {
      // Plantillas premium (fotos + layouts variados); si algo falla,
      // cae al diseño clásico para no romper la generación programada.
      let result;
      try {
        result = await renderCarouselPremium(negocioRender, renderData, outDir);
      } catch (err) {
        console.error("[pipeline] Falló el render premium, usando diseño clásico:", err);
        result = await renderCarousel(negocioRender, renderData, outDir);
      }
      updated = await prisma.contentPiece.update({
        where: { id: piece.id },
        data: {
          status: "PENDING",
          outputDir: path.relative(process.cwd(), outDir),
          coverPath: result.cover,
          slideCount: result.files.length,
          // Si el render degrado (tipicamente: sin creditos de imagenes), queda
          // escrito en la pieza. Antes moria en el journal y se publicaba igual.
          renderWarning: result.avisoRender ?? "",
        },
      });
      if (result.avisoRender) {
        console.warn("[pipeline] " + result.avisoRender);
      }
    } else {
      // Video con clip Veo3 de fondo si hay KIE_API_KEY (desactivable con
      // KIE_VIDEO=off); si falla o no hay key, video clásico de tarjetas.
      let result;
      const aiVideo = process.env.KIE_API_KEY && process.env.KIE_VIDEO !== "off";
      if (aiVideo) {
        try {
          result = await renderVideoWithAiBackground(negocioRender, renderData, outDir);
        } catch (err) {
          console.error("[pipeline] Falló el video con IA, usando video clásico:", err);
          result = await renderVideo(negocioRender, renderData, outDir);
        }
      } else {
        result = await renderVideo(negocioRender, renderData, outDir);
      }
      updated = await prisma.contentPiece.update({
        where: { id: piece.id },
        data: {
          status: "PENDING",
          outputDir: path.relative(process.cwd(), outDir),
          videoPath: result.videoFile,
          coverPath: result.slideFiles[0],
          slideCount: result.slideFiles.length,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.contentPiece.update({
      where: { id: piece.id },
      data: { status: "FAILED", error: message },
    });
    throw err;
  }

  // Notificación por Telegram (import dinámico para evitar ciclos)
  try {
    const { notifyPendingPiece } = await import("./telegram");
    await notifyPendingPiece({ ...updated, business });
  } catch (err) {
    console.error("[pipeline] No se pudo notificar por Telegram:", err);
  }

  return { ...updated, business };
}

/** Aprueba y publica. Devuelve la pieza y el resultado por plataforma. */
export async function approvePiece(
  pieceId: string,
): Promise<{ piece: PieceWithBusiness; targets: PublishTarget[] }> {
  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  const { publishPiece } = await import("./publish");
  const targets = await publishPiece(pieceId);

  // Si LinkedIn quedó en modo manual, el PDF listo llega por Telegram
  // (aplica tanto al aprobar desde el bot como desde el panel web)
  if (targets.some((t) => t.platform === "linkedin" && t.status === "MANUAL_REQUIRED")) {
    try {
      const { sendLinkedInPdf } = await import("./telegram");
      await sendLinkedInPdf(pieceId);
    } catch (err) {
      console.error("[pipeline] No se pudo enviar el PDF de LinkedIn por Telegram:", err);
    }
  }

  const piece = await prisma.contentPiece.findUniqueOrThrow({
    where: { id: pieceId },
    include: { business: true },
  });
  return { piece, targets };
}

export async function rejectPiece(pieceId: string): Promise<ContentPiece> {
  return prisma.contentPiece.update({
    where: { id: pieceId },
    data: { status: "REJECTED" },
  });
}

/** Descarta la pieza y genera una nueva del mismo tipo para el mismo negocio */
export async function regeneratePiece(pieceId: string): Promise<PieceWithBusiness> {
  const old = await prisma.contentPiece.findUniqueOrThrow({
    where: { id: pieceId },
    include: { business: true },
  });
  await rejectPiece(pieceId);
  return createPiece(old.business.slug, old.type as "CAROUSEL" | "VIDEO", old.customPrompt || undefined);
}
