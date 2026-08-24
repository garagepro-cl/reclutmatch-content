/**
 * Reintenta UNA publicación de Instagram que quedó fallida, y termina.
 *
 * Se hace de a una y con el timer cada hora (no las cuatro seguidas) para no
 * descargar un bloque de posts sobre el feed en dos minutos: en Instagram eso
 * se ve a spam y compite consigo mismo por alcance.
 *
 * Reutiliza publishPiece, que ya salta los destinos en PUBLISHED — o sea,
 * Facebook no se vuelve a publicar. LinkedIn vuelve a quedar MANUAL_REQUIRED
 * mientras no haya credenciales, que es el mismo estado en el que ya estaba.
 *
 *   npm run reintentar-ig -- --ensayo   (muestra qué haría, sin publicar)
 *   npm run reintentar-ig               (publica una y termina)
 */
import { prisma } from "../lib/db";

const TZ = process.env.SCHEDULE_TZ || "America/Santiago";

/** Hora local de Chile (0-23) */
function horaChile(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(d),
  );
}

async function avisar(texto: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  let chat = process.env.TELEGRAM_OWNER_CHAT_ID?.trim() ?? "";
  if (!chat) {
    const s = await prisma.setting.findUnique({ where: { key: "telegram_chat_id" } });
    chat = s?.value ?? "";
  }
  if (!chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto.slice(0, 4000) }),
  }).catch(() => undefined);
}

async function main() {
  const ensayo = process.argv.includes("--ensayo");

  // Misma regla que el resto del sistema: nada sale fuera de 08:00-20:00 Chile.
  const h = horaChile();
  if (!ensayo && (h < 8 || h >= 20)) {
    console.log(`[reintentar-ig] Son las ${h}:xx en Chile — fuera de la ventana 08-20. No se publica.`);
    return;
  }

  // La más antigua primero: se recuperan en el orden en que debieron salir.
  const fallido = await prisma.publishTarget.findFirst({
    where: { platform: "instagram", status: "FAILED" },
    orderBy: { createdAt: "asc" },
    include: { piece: { select: { id: true, title: true, slideCount: true } } },
  });

  if (!fallido) {
    console.log("[reintentar-ig] No queda ninguna publicación de Instagram pendiente.");
    return;
  }

  const quedan = await prisma.publishTarget.count({
    where: { platform: "instagram", status: "FAILED" },
  });

  if (ensayo) {
    console.log("[reintentar-ig] ENSAYO — no se publica nada.");
    console.log(`  Reintentaría: "${fallido.piece.title}" (${fallido.piece.slideCount} láminas)`);
    console.log(`  Error previo : ${fallido.error}`);
    console.log(`  Pendientes   : ${quedan}`);
    return;
  }

  console.log(`[reintentar-ig] Reintentando "${fallido.piece.title}" (quedan ${quedan})…`);
  const { publishPiece } = await import("../lib/publish");
  const targets = await publishPiece(fallido.piece.id);
  const ig = targets.find((t) => t.platform === "instagram");

  if (ig?.status === "PUBLISHED") {
    console.log(`[reintentar-ig] ✔ publicado: ${ig.permalink || ig.externalId}`);
    await avisar(
      `✅ Instagram recuperado\n\n"${fallido.piece.title}"\n${ig.permalink || ""}\n\n` +
      `Quedan ${quedan - 1} por reintentar.`,
    );
  } else {
    console.error(`[reintentar-ig] ✖ volvió a fallar: ${ig?.error}`);
    await avisar(
      `❌ Instagram falló de nuevo\n\n"${fallido.piece.title}"\n${ig?.error ?? "sin detalle"}\n\n` +
      `Se reintenta en una hora.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[reintentar-ig] ERROR:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
