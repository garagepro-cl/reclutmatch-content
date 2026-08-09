import fs from "node:fs";
import path from "node:path";
import type { Business, ContentPiece } from "@prisma/client";
import { loadCredentials } from "./credentials";
import type { PublishOutcome } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

interface GraphError {
  error?: { message?: string };
}

async function graphPost(
  url: string,
  form: FormData | URLSearchParams,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", body: form });
  const json = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Graph API HTTP ${res.status}`);
  }
  return json;
}

function fileBlob(filePath: string, mime: string): Blob {
  return new Blob([fs.readFileSync(filePath)], { type: mime });
}

function fullCaption(piece: ContentPiece): string {
  return [piece.caption, piece.hashtags].filter(Boolean).join("\n\n");
}

/* ── Facebook (subida directa, no requiere URL pública) ────────────── */

export async function publishFacebook(
  business: Business,
  piece: ContentPiece,
  outDir: string,
  files: string[],
): Promise<PublishOutcome> {
  const { meta } = loadCredentials(business.slug);
  if (!meta?.pageId || !meta?.accessToken) {
    return {
      status: "MANUAL_REQUIRED",
      error: "Meta no configurado: falta pageId/accessToken en data/credentials/" + business.slug + ".json",
    };
  }

  try {
    if (piece.type === "VIDEO") {
      const form = new FormData();
      form.append("source", fileBlob(path.join(outDir, piece.videoPath), "video/mp4"), "video.mp4");
      form.append("description", fullCaption(piece));
      form.append("access_token", meta.accessToken);
      const res = await graphPost(`${GRAPH}/${meta.pageId}/videos`, form);
      return {
        status: "PUBLISHED",
        externalId: String(res.id),
        permalink: `https://www.facebook.com/${res.id}`,
      };
    }

    // Carrusel: subir fotos sin publicar y luego crear el post con todas
    const mediaIds: string[] = [];
    for (const f of files) {
      const form = new FormData();
      form.append("source", fileBlob(path.join(outDir, f), "image/png"), f);
      form.append("published", "false");
      form.append("access_token", meta.accessToken);
      const res = await graphPost(`${GRAPH}/${meta.pageId}/photos`, form);
      mediaIds.push(String(res.id));
    }

    const feed = new URLSearchParams();
    feed.append("message", fullCaption(piece));
    mediaIds.forEach((id, i) =>
      feed.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })),
    );
    feed.append("access_token", meta.accessToken);
    const post = await graphPost(`${GRAPH}/${meta.pageId}/feed`, feed);

    return {
      status: "PUBLISHED",
      externalId: String(post.id),
      permalink: `https://www.facebook.com/${post.id}`,
    };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

/* ── Instagram (requiere URL pública para los medios) ──────────────── */

export async function publishInstagram(
  business: Business,
  piece: ContentPiece,
  files: string[],
): Promise<PublishOutcome> {
  const { meta } = loadCredentials(business.slug);
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (!meta?.igUserId || !meta?.accessToken) {
    return {
      status: "MANUAL_REQUIRED",
      error: "Instagram no configurado: falta igUserId/accessToken en data/credentials/" + business.slug + ".json",
    };
  }
  if (!base) {
    return {
      status: "MANUAL_REQUIRED",
      error: "Instagram requiere PUBLIC_BASE_URL (la API de IG solo acepta medios desde una URL pública)",
    };
  }

  const mediaUrl = (file: string) => `${base}/api/media/${piece.id}/${file}`;
  const token = meta.accessToken;

  try {
    let creationId: string;

    if (piece.type === "VIDEO") {
      const params = new URLSearchParams({
        media_type: "REELS",
        video_url: mediaUrl(piece.videoPath),
        caption: fullCaption(piece),
        share_to_feed: "true",
        access_token: token,
      });
      const res = await graphPost(`${GRAPH}/${meta.igUserId}/media`, params);
      creationId = String(res.id);
      await waitForContainer(creationId, token, 180_000);
    } else {
      const children: string[] = [];
      for (const f of files) {
        const params = new URLSearchParams({
          image_url: mediaUrl(f),
          is_carousel_item: "true",
          access_token: token,
        });
        const res = await graphPost(`${GRAPH}/${meta.igUserId}/media`, params);
        children.push(String(res.id));
      }
      for (const id of children) await waitForContainer(id, token, 60_000);

      const carousel = new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: fullCaption(piece),
        access_token: token,
      });
      const res = await graphPost(`${GRAPH}/${meta.igUserId}/media`, carousel);
      creationId = String(res.id);
    }

    const publish = new URLSearchParams({ creation_id: creationId, access_token: token });
    const pub = await graphPost(`${GRAPH}/${meta.igUserId}/media_publish`, publish);
    const mediaId = String(pub.id);

    let permalink = "";
    try {
      const info = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${token}`);
      permalink = String(((await info.json()) as Record<string, unknown>).permalink ?? "");
    } catch { /* permalink es opcional */ }

    return { status: "PUBLISHED", externalId: mediaId, permalink };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Espera a que un contenedor de medios IG esté listo (FINISHED) */
async function waitForContainer(id: string, token: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${GRAPH}/${id}?fields=status_code,status&access_token=${token}`);
    const json = (await res.json()) as { status_code?: string; status?: string } & GraphError;
    if (json.error) throw new Error(json.error.message || "Error consultando contenedor IG");
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new Error(`Instagram no pudo procesar el medio: ${json.status || "sin detalle"}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timeout esperando que Instagram procese el medio");
}
