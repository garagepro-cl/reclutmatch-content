import type { Business } from "@prisma/client";
import type { Idea } from "./types";
import { IDEA_BANK } from "./bank";
import { prisma } from "../db";
import { parseTopics } from "../brands";

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
  // 25 y no 10: con 10, a la pieza 11 la IA podía volver a los mismos temas.
  // Se traen todas (incluidas las rechazadas) porque la rotación de pilares
  // cuenta cada generación como turno usado; para el "evita repetir títulos"
  // se filtran las rechazadas igual que antes, para no romper el flujo de
  // regenerar ("otra versión del mismo tema").
  const recent = await prisma.contentPiece.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { title: true, pillar: true, status: true },
  });
  const recentTitles = recent
    .filter((r) => r.status !== "REJECTED")
    .map((r) => r.title);

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

  // Cola de ideas propias: si hay alguna anotada esperando (por /idea en Telegram
  // o por la página web), esa manda por sobre lo que se le ocurra a la IA. Sale la
  // más antigua primero, para que ninguna quede olvidada al fondo.
  if (process.env.ANTHROPIC_API_KEY) {
    const propia = await prisma.ideaPropia.findFirst({
      where: { businessId: business.id, usada: false },
      orderBy: { createdAt: "asc" },
    });
    if (propia) {
      try {
        const { generateIdeaWithAI } = await import("./ai");
        const idea = await generateIdeaWithAI(business, type, recentTitles, propia.texto);
        // Se marca recién ahora, con la IA ya resuelta: si fallaba, la idea seguía
        // en la cola y se reintentaba en vez de perderse.
        await prisma.ideaPropia.update({
          where: { id: propia.id },
          data: { usada: true, usadaAt: new Date(), resultado: idea.title },
        });
        return { idea, source: "ai" };
      } catch (err) {
        console.error(
          `[ideas] Falló la idea propia "${propia.texto.slice(0, 60)}" de ${business.slug}, queda en la cola:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { generateIdeaWithAI } = await import("./ai");
      // El pilar se elige acá y no lo elige la IA: dejada libre, ReclutMatch usó
      // 2 de sus 5 pilares y las últimas 5 piezas fueron la misma idea escrita
      // de cinco formas distintas — todas rechazadas.
      const pilar = pickNextPillar(business, recent);
      const idea = await generateIdeaWithAI(business, type, recentTitles, undefined, pilar);
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

/**
 * Rotación forzada de pilares: sale el que lleva más tiempo sin usarse.
 * Cuenta también las piezas rechazadas — el pilar ya tuvo su turno aunque esa
 * pieza no haya gustado; si no, un pilar rechazado volvía a salir al tiro y
 * los demás seguían esperando. Normaliza el nombre porque la IA escribía el
 * mismo pilar de dos formas ("educación en selección" y la versión larga con
 * paréntesis), y el sistema los contaba como pilares distintos.
 */
export function pickNextPillar(
  business: Business,
  recent: { pillar: string }[],
): string | undefined {
  const topics: string[] = parseTopics(business);
  if (topics.length === 0) return undefined;

  const norm = (s: string) => s.trim().toLowerCase();

  // Posición del uso más reciente de cada pilar (0 = el más nuevo).
  // Un pilar que no aparece en las últimas 25 queda como "nunca usado".
  const lastUse = new Map<string, number>();
  recent.forEach((r, i) => {
    const key = norm(r.pillar);
    if (key && !lastUse.has(key)) lastUse.set(key, i);
  });

  let elegido = topics[0];
  let mejorAntiguedad = -1;
  for (const topic of topics) {
    const uso = lastUse.get(norm(topic));
    if (uso === undefined) return topic; // nunca usado: sale ya
    if (uso > mejorAntiguedad) {
      mejorAntiguedad = uso;
      elegido = topic;
    }
  }
  return elegido;
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
