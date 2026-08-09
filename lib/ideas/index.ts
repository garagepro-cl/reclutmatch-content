import type { Business } from "@prisma/client";
import type { Idea } from "./types";
import { IDEA_BANK } from "./bank";
import { prisma } from "../db";

export type { Idea, IdeaSlide } from "./types";

/**
 * Obtiene una idea para el negocio: intenta con IA (si hay API key),
 * si no, rota el banco de ideas incorporado evitando títulos recientes.
 */
export async function getIdea(
  business: Business,
  type: "CAROUSEL" | "VIDEO",
  customPrompt?: string,
): Promise<{ idea: Idea; source: "ai" | "bank" }> {
  const recent = await prisma.contentPiece.findMany({
    where: { businessId: business.id, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { title: true },
  });
  const recentTitles = recent.map((r) => r.title);

  if (customPrompt?.trim()) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "Un tema personalizado requiere la IA de Claude configurada (ANTHROPIC_API_KEY en .env) — " +
        "el banco de ideas incorporado no puede seguir instrucciones específicas.",
      );
    }
    const { generateIdeaWithAI } = await import("./ai");
    const idea = await generateIdeaWithAI(business, type, recentTitles, customPrompt);
    return { idea, source: "ai" };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { generateIdeaWithAI } = await import("./ai");
      const idea = await generateIdeaWithAI(business, type, recentTitles);
      return { idea, source: "ai" };
    } catch (err) {
      console.error(
        `[ideas] Falló la generación con IA para ${business.slug}, usando banco de ideas:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { idea: pickFromBank(business.slug, type, recentTitles), source: "bank" };
}

function pickFromBank(
  slug: string,
  type: "CAROUSEL" | "VIDEO",
  recentTitles: string[],
): Idea {
  const bank = IDEA_BANK[slug];
  if (!bank || bank.length === 0) {
    throw new Error(
      `No hay banco de ideas para el negocio "${slug}" y no hay ANTHROPIC_API_KEY configurada. ` +
      `Agrega ideas en lib/ideas/bank.ts o configura la API key en .env`,
    );
  }

  // Prefiere el tipo pedido y evita títulos recientes; relaja restricciones si hace falta
  const matchesType = (i: Idea) => i.type === type || i.type === "ANY";
  const notRecent = (i: Idea) => !recentTitles.includes(i.title);

  const candidates =
    bank.filter((i) => matchesType(i) && notRecent(i)).length > 0
      ? bank.filter((i) => matchesType(i) && notRecent(i))
      : bank.filter(notRecent).length > 0
        ? bank.filter(notRecent)
        : bank;

  // Rotación determinista: usa la cantidad de títulos recientes como cursor
  const idx = recentTitles.length % candidates.length;
  const idea = candidates[idx];
  return { ...idea, type };
}
