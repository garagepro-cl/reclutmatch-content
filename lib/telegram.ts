import fs from "node:fs";
import path from "node:path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import type { InputMediaPhoto } from "grammy/types";
import { prisma } from "./db";
import { PROJECT_ROOT } from "./brands";
import type { PieceWithBusiness } from "./pipeline";

let bot: Bot | null = null;
let started = false;

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

async function ownerChatId(): Promise<string> {
  if (process.env.TELEGRAM_OWNER_CHAT_ID?.trim()) {
    return process.env.TELEGRAM_OWNER_CHAT_ID.trim();
  }
  const s = await prisma.setting.findUnique({ where: { key: "telegram_chat_id" } });
  return s?.value ?? "";
}

export function getBot(): Bot | null {
  if (!token()) return null;
  if (!bot) {
    bot = new Bot(token());
    wire(bot);
  }
  return bot;
}

/** Arranca el bot en long polling (funciona detrás de NAT, sin webhook) */
export async function startTelegram(): Promise<void> {
  const b = getBot();
  if (!b) {
    console.log("[telegram] Sin TELEGRAM_BOT_TOKEN — aprobación solo por dashboard");
    return;
  }
  if (started) return;
  started = true;
  b.start({
    onStart: (me) => console.log(`[telegram] Bot @${me.username} escuchando`),
  }).catch((err) => {
    started = false;
    console.error("[telegram] Bot detenido por error:", err);
  });
}

function typeLabel(type: string): string {
  return type === "CAROUSEL" ? "🖼 Carrusel" : "🎬 Video";
}

/** Escapa los caracteres especiales de Telegram Markdown (legacy) en texto dinámico */
function mdEscape(text: string): string {
  return text.replace(/([_*`[])/g, "\\$1");
}

/** Envía la previsualización de una pieza PENDING con botones de aprobación */
export async function notifyPendingPiece(piece: PieceWithBusiness): Promise<void> {
  const b = getBot();
  if (!b) return;
  const chat = await ownerChatId();
  if (!chat) {
    console.log("[telegram] Nadie ha hecho /start todavía — no se envió la previsualización");
    return;
  }

  const dir = path.join(PROJECT_ROOT, "data", "output", piece.id);

  if (piece.type === "CAROUSEL") {
    const media: InputMediaPhoto[] = Array.from(
      { length: Math.min(piece.slideCount, 10) },
      (_, i) => ({
        type: "photo" as const,
        media: new InputFile(path.join(dir, `slide-${String(i + 1).padStart(2, "0")}.png`)),
      }),
    );
    await b.api.sendMediaGroup(chat, media);
  } else if (piece.videoPath) {
    await b.api.sendVideo(chat, new InputFile(path.join(dir, piece.videoPath)));
  }

  // El aviso va ARRIBA del todo: en el celular la miniatura no delata que la
  // pieza salio sin imagenes, y se termina aprobando a ciegas. Paso el 21-ago.
  const aviso = piece.renderWarning
    ? `⚠️ *OJO — revisa las imagenes antes de aprobar*\n${mdEscape(piece.renderWarning)}\n\n`
    : "";

  const text =
    aviso +
    `🆕 ${typeLabel(piece.type)} para *${mdEscape(piece.business.name)}*\n\n` +
    `📌 *${mdEscape(piece.title)}*\n` +
    (piece.pillar ? `🏷 ${mdEscape(piece.pillar)}\n` : "") +
    `🤖 Fuente: ${piece.source === "ai" ? "IA" : "banco de ideas"}\n\n` +
    `*Caption:*\n${mdEscape(piece.caption)}\n\n${mdEscape(piece.hashtags)}`;

  const keyboard = new InlineKeyboard()
    .text("✅ Aprobar", `ap:${piece.id}`)
    .text("🔄 Otra", `rg:${piece.id}`)
    .text("❌ Descartar", `rj:${piece.id}`);

  await b.api.sendMessage(chat, text.slice(0, 4000), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Manda el PDF del carrusel (formato documento de LinkedIn) al dueño,
 * para publicarlo a mano mientras la API de LinkedIn no esté configurada.
 */
export async function sendLinkedInPdf(pieceId: string): Promise<void> {
  const b = getBot();
  if (!b) return;
  const chat = await ownerChatId();
  if (!chat) return;
  const pdf = path.join(PROJECT_ROOT, "data", "output", pieceId, "linkedin.pdf");
  if (!fs.existsSync(pdf)) return;
  await b.api.sendDocument(chat, new InputFile(pdf), {
    caption: "📄 Carrusel en PDF listo para publicarlo a mano en LinkedIn (como documento).",
  });
}

/** Resumen post-publicación por plataforma */
function targetSummary(targets: { platform: string; status: string; permalink: string; error: string }[]): string {
  const lines = targets.map((t) => {
    const name = t.platform.charAt(0).toUpperCase() + t.platform.slice(1);
    if (t.status === "PUBLISHED") return `✅ ${name}: publicado${t.permalink ? `\n${t.permalink}` : ""}`;
    if (t.status === "MANUAL_REQUIRED") return `📋 ${name}: publicación manual — ${t.error}`;
    return `❌ ${name}: ${t.error}`;
  });
  return lines.join("\n\n");
}

const COMANDOS =
  "Comandos:\n" +
  "/idea <texto> — anota una idea para la próxima pieza (varias líneas = varias ideas)\n" +
  "/ideas — muestra la cola de ideas anotadas\n" +
  "/generar [negocio] — crea una pieza ahora\n" +
  "/id — muestra el id de este chat";

function wire(b: Bot): void {
  b.command("start", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const owner = await ownerChatId();
    if (!owner) {
      await prisma.setting.upsert({
        where: { key: "telegram_chat_id" },
        create: { key: "telegram_chat_id", value: chatId },
        update: { value: chatId },
      });
      await ctx.reply(
        "👋 ¡Listo! Este chat quedó registrado como dueño de ContentPilot.\n\n" +
        "Aquí te llegarán los carruseles para aprobar.\n\n" +
        COMANDOS,
      );
    } else if (owner === chatId) {
      await ctx.reply(`Ya estás registrado ✅\n\n${COMANDOS}`);
    } else {
      await ctx.reply("Este bot es privado.");
    }
  });

  b.command("id", (ctx) => ctx.reply(`Tu chat id: ${ctx.chat.id}`));

  // Anotar ideas desde el celular. El generador les da prioridad por sobre lo
  // que se le ocurra a la IA (ver getIdea en lib/ideas/index.ts).
  b.command("idea", async (ctx) => {
    const owner = await ownerChatId();
    if (String(ctx.chat.id) !== owner) return;

    const entrada = (ctx.match ?? "").trim();
    if (!entrada) {
      await ctx.reply(
        "Escribe la idea después del comando.\n\n" +
        "Ejemplo: `/idea el costo real de una mala contratación en una PYME`\n\n" +
        "Puedes mandar varias de una vez, una por línea. Con /ideas ves la cola.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const negocios = await prisma.business.findMany({ where: { active: true } });
    if (negocios.length === 0) {
      await ctx.reply("No hay negocios activos.");
      return;
    }

    // Si la primera palabra es el slug de un negocio, la idea es para ese.
    // Si no, y hay un solo negocio activo, se asume ese. Con varios, se pregunta.
    const primera = entrada.split(/\s+/)[0].toLowerCase();
    const porSlug = negocios.find((n) => n.slug.toLowerCase() === primera);
    const negocio = porSlug ?? (negocios.length === 1 ? negocios[0] : null);
    if (!negocio) {
      await ctx.reply(
        `¿Para cuál negocio? Ponlo antes de la idea:\n` +
        negocios.map((n) => `\`/idea ${n.slug} tu idea acá\``).join("\n"),
        { parse_mode: "Markdown" },
      );
      return;
    }

    const cuerpo = porSlug ? entrada.slice(primera.length).trim() : entrada;
    // Cada línea es una idea aparte: es lo natural cuando uno pega una lista
    // juntada en el celular.
    const lineas = cuerpo
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
      .filter((l) => l.length > 2)
      .slice(0, 50);

    if (lineas.length === 0) {
      await ctx.reply("No alcancé a leer ninguna idea ahí. Escribe al menos tres letras.");
      return;
    }

    await prisma.ideaPropia.createMany({
      data: lineas.map((l) => ({ businessId: negocio.id, texto: l.slice(0, 500) })),
    });
    const enCola = await prisma.ideaPropia.count({
      where: { businessId: negocio.id, usada: false },
    });

    await ctx.reply(
      `✅ ${lineas.length === 1 ? "Idea anotada" : `${lineas.length} ideas anotadas`} ` +
      `para *${mdEscape(negocio.name)}*.\n\n` +
      `📋 Quedan ${enCola} en la cola. Salen por orden de llegada, ` +
      `antes que cualquier idea que invente la IA.`,
      { parse_mode: "Markdown" },
    );
  });

  b.command("ideas", async (ctx) => {
    const owner = await ownerChatId();
    if (String(ctx.chat.id) !== owner) return;

    const pendientes = await prisma.ideaPropia.findMany({
      where: { usada: false },
      orderBy: { createdAt: "asc" },
      include: { business: true },
      take: 20,
    });
    if (pendientes.length === 0) {
      await ctx.reply(
        "La cola de ideas está vacía — el generador va a inventar el tema solo.\n\n" +
        "Para anotar una: `/idea tu idea acá`",
        { parse_mode: "Markdown" },
      );
      return;
    }
    const lista = pendientes
      .map((i, n) => `${n + 1}. ${mdEscape(i.texto.slice(0, 90))} _(${mdEscape(i.business.name)})_`)
      .join("\n");
    await ctx.reply(`📋 *Ideas en cola* (salen en este orden)\n\n${lista}`, {
      parse_mode: "Markdown",
    });
  });

  b.command("generar", async (ctx) => {
    const owner = await ownerChatId();
    if (String(ctx.chat.id) !== owner) return;
    const slug = ctx.match?.trim();
    const { createPiece } = await import("./pipeline");

    const businesses = slug
      ? await prisma.business.findMany({ where: { slug } })
      : await prisma.business.findMany({ where: { active: true } });

    if (businesses.length === 0) {
      await ctx.reply(`No encontré el negocio "${slug}". Prueba /generar reclutmatch`);
      return;
    }

    await ctx.reply(`⚙️ Generando contenido para ${businesses.map((x) => x.name).join(" y ")}…`);
    for (const biz of businesses) {
      try {
        await createPiece(biz.slug);
      } catch (err) {
        await ctx.reply(`❌ Error generando para ${biz.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  });

  b.on("callback_query:data", async (ctx) => {
    const owner = await ownerChatId();
    if (String(ctx.chat?.id) !== owner) {
      await ctx.answerCallbackQuery({ text: "No autorizado" });
      return;
    }

    const [action, pieceId] = ctx.callbackQuery.data.split(":");
    await ctx.answerCallbackQuery({ text: "Procesando…" });
    // Quita los botones para evitar doble clic
    try { await ctx.editMessageReplyMarkup(); } catch { /* mensaje viejo, da igual */ }

    try {
      if (action === "ap") {
        await ctx.reply("🚀 Publicando…");
        const { approvePiece } = await import("./pipeline");
        const { targets } = await approvePiece(pieceId);
        await ctx.reply(targetSummary(targets));
      } else if (action === "rg") {
        await ctx.reply("🔄 Generando otra versión…");
        const { regeneratePiece } = await import("./pipeline");
        await regeneratePiece(pieceId);
      } else if (action === "rj") {
        const { rejectPiece } = await import("./pipeline");
        await rejectPiece(pieceId);
        await ctx.reply("🗑 Descartada. No se publicará.");
      }
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : err}`);
    }
  });
}
