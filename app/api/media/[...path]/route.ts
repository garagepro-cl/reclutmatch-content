import fs from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

/**
 * Sirve los archivos generados en data/output (imágenes y videos).
 * Sin auth a propósito: Meta debe poder descargarlos sin sesión para publicarlos
 * en Instagram/Facebook. Las rutas usan IDs de pieza (cuid) no adivinables.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const base = path.join(process.cwd(), "data", "output");
  const filePath = path.normalize(path.join(base, ...parts));

  if (!filePath.startsWith(base)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const mime = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const data = fs.readFileSync(filePath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
