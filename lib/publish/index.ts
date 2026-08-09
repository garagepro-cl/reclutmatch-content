import path from "node:path";
import type { PublishTarget } from "@prisma/client";
import { prisma } from "../db";
import { parsePlatforms, PROJECT_ROOT } from "../brands";
import { publishFacebook, publishInstagram } from "./meta";
import { publishLinkedIn } from "./linkedin";
import { publishYouTube } from "./youtube";
import type { PublishOutcome } from "./types";

/**
 * Publica una pieza aprobada en todas las plataformas del negocio.
 * Carruseles → Instagram + Facebook + LinkedIn (como documento PDF).
 * Videos → Instagram + Facebook + YouTube.
 * Sin credenciales → el target queda MANUAL_REQUIRED con el motivo.
 */
export async function publishPiece(pieceId: string): Promise<PublishTarget[]> {
  const piece = await prisma.contentPiece.findUniqueOrThrow({
    where: { id: pieceId },
    include: { business: true },
  });
  const business = piece.business;
  const outDir = path.join(PROJECT_ROOT, "data", "output", piece.id);

  // Los nombres de archivo se derivan del patrón fijo del renderer
  const slideFiles = piece.type === "CAROUSEL"
    ? Array.from({ length: piece.slideCount }, (_, i) => `slide-${String(i + 1).padStart(2, "0")}.png`)
    : [];

  const platforms = parsePlatforms(business);
  const applicable = piece.type === "CAROUSEL"
    ? platforms.filter((p) => p !== "youtube")
    : platforms.filter((p) => p !== "linkedin");

  const results: PublishTarget[] = [];

  for (const platform of applicable) {
    let target = await prisma.publishTarget.findFirst({
      where: { pieceId: piece.id, platform },
    });
    if (target?.status === "PUBLISHED") {
      results.push(target);
      continue;
    }
    if (!target) {
      target = await prisma.publishTarget.create({
        data: { pieceId: piece.id, platform },
      });
    }

    let outcome: PublishOutcome;
    try {
      if (platform === "facebook") {
        outcome = await publishFacebook(business, piece, outDir, slideFiles);
      } else if (platform === "instagram") {
        outcome = await publishInstagram(business, piece, slideFiles);
      } else if (platform === "linkedin") {
        outcome = await publishLinkedIn(business, piece, outDir, slideFiles);
      } else if (platform === "youtube") {
        outcome = await publishYouTube(business, piece, outDir);
      } else {
        outcome = { status: "FAILED", error: `Plataforma desconocida: ${platform}` };
      }
    } catch (err) {
      outcome = { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
    }

    target = await prisma.publishTarget.update({
      where: { id: target.id },
      data: {
        status: outcome.status,
        externalId: outcome.externalId ?? "",
        permalink: outcome.permalink ?? "",
        error: outcome.error ?? "",
      },
    });
    results.push(target);
  }

  const anyPublished = results.some((t) => t.status === "PUBLISHED");
  if (anyPublished) {
    await prisma.contentPiece.update({
      where: { id: piece.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  return results;
}
