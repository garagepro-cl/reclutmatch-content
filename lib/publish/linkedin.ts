import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { Business, ContentPiece } from "@prisma/client";
import { loadCredentials } from "./credentials";
import type { PublishOutcome } from "./types";

/**
 * Publicación en LinkedIn como página de empresa (o perfil personal).
 *
 * Los carruseles se publican como DOCUMENTO (PDF): es el formato nativo
 * de carrusel en LinkedIn. El PDF se genera SIEMPRE (linkedin.pdf en la
 * carpeta de la pieza), aunque falten credenciales — así queda listo
 * para publicarlo a mano mientras la app de LinkedIn no esté aprobada.
 *
 * Requisitos de la API (portal de desarrolladores de LinkedIn):
 *  - App asociada a la página de empresa, con el producto
 *    "Community Management API" aprobado.
 *  - Token OAuth con scope w_organization_social (admin de la página).
 */

const API = "https://api.linkedin.com/rest";

/**
 * Versión mensual de la API de LinkedIn (header LinkedIn-Version).
 *
 * OJO: LinkedIn sostiene cada versión de la Marketing API un año como mínimo y
 * después la retira. Una versión dada de baja NO falla con un error claro:
 * devuelve HTTP 426, que no dice nada. Estaba en "202506" (junio 2025), ya
 * retirada — habría fallado apenas se cargaran las credenciales.
 *
 * Se revisa una vez al año contra la tabla de versiones soportadas:
 * https://learn.microsoft.com/en-us/linkedin/marketing/versioning
 * Se puede sobreescribir con LINKEDIN_VERSION en el .env sin tocar código.
 */
function apiVersion(): string {
  return process.env.LINKEDIN_VERSION || "202607";
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": apiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

/**
 * Escapa los caracteres reservados del "little text format" de LinkedIn.
 * # y @ se dejan intactos para que los hashtags/menciones funcionen.
 */
function escapeCommentary(text: string): string {
  return text.replace(/([\\|{}[\]()<>*_~])/g, "\\$1");
}

function fullCaption(piece: ContentPiece): string {
  return [piece.caption, piece.hashtags].filter(Boolean).join("\n\n");
}

/** Une los PNG del carrusel en un PDF (formato documento de LinkedIn) */
export async function buildCarouselPdf(
  outDir: string,
  files: string[],
): Promise<string> {
  const pdfPath = path.join(outDir, "linkedin.pdf");
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const bytes = fs.readFileSync(path.join(outDir, f));
    const img = await pdf.embedPng(bytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  fs.writeFileSync(pdfPath, await pdf.save());
  return pdfPath;
}

export async function publishLinkedIn(
  business: Business,
  piece: ContentPiece,
  outDir: string,
  files: string[],
): Promise<PublishOutcome> {
  if (piece.type !== "CAROUSEL") {
    return {
      status: "MANUAL_REQUIRED",
      error: "LinkedIn: solo carruseles por ahora (el video se publica a mano)",
    };
  }

  // El PDF se genera siempre: sirve tanto para la API como para publicación manual
  let pdfPath: string;
  try {
    pdfPath = await buildCarouselPdf(outDir, files);
  } catch (err) {
    return {
      status: "FAILED",
      error: `No se pudo generar el PDF del carrusel: ${err instanceof Error ? err.message : err}`,
    };
  }

  const { linkedin } = loadCredentials(business.slug);
  const author = linkedin?.organizationId
    ? `urn:li:organization:${linkedin.organizationId}`
    : linkedin?.personUrn || "";

  if (!author || !linkedin?.accessToken) {
    return {
      status: "MANUAL_REQUIRED",
      error:
        "LinkedIn no configurado (falta organizationId/accessToken en data/credentials/" +
        business.slug + ".json). El PDF quedó listo para subirlo a mano.",
    };
  }

  const token = linkedin.accessToken;

  try {
    // 1. Inicializar la subida del documento
    const initRes = await fetch(`${API}/documents?action=initializeUpload`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const initJson = (await initRes.json()) as {
      value?: { uploadUrl?: string; document?: string };
      message?: string;
    };
    if (!initRes.ok || !initJson.value?.uploadUrl || !initJson.value?.document) {
      throw new Error(initJson.message || `initializeUpload HTTP ${initRes.status}`);
    }

    // 2. Subir el PDF
    const upRes = await fetch(initJson.value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: new Blob([fs.readFileSync(pdfPath)], { type: "application/pdf" }),
    });
    if (!upRes.ok) {
      throw new Error(`Subida del documento HTTP ${upRes.status}`);
    }

    // 3. Crear el post con el documento
    const postRes = await fetch(`${API}/posts`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        author,
        commentary: escapeCommentary(fullCaption(piece)),
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: { id: initJson.value.document, title: piece.title },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!postRes.ok) {
      const errJson = (await postRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(errJson.message || `Creación del post HTTP ${postRes.status}`);
    }

    const postUrn = postRes.headers.get("x-restli-id") ?? "";
    return {
      status: "PUBLISHED",
      externalId: postUrn,
      permalink: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : "",
    };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}
