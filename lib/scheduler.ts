import cron from "node-cron";
import { prisma } from "./db";

let schedulerStarted = false;

function cronExpr(): string {
  return process.env.SCHEDULE_CRON || "0 9 * * 1,3,5";
}

function timezone(): string {
  return process.env.SCHEDULE_TZ || "America/Santiago";
}

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  cron.schedule(cronExpr(), () => void runScheduledGeneration("cron"), {
    timezone: timezone(),
  });
  console.log(`[scheduler] Generación programada: "${cronExpr()}" (${timezone()})`);

  // Catch-up: si el PC estaba apagado a la hora programada y se enciende
  // más tarde el mismo día, genera igual.
  void catchUpIfMissed();
}

/** Genera una pieza por negocio activo, salvo que ya exista una de hoy */
export async function runScheduledGeneration(reason: string): Promise<void> {
  console.log(`[scheduler] Generación iniciada (${reason})`);
  const businesses = await prisma.business.findMany({ where: { active: true } });
  const { createPiece } = await import("./pipeline");

  for (const business of businesses) {
    if (await hasGeneratedToday(business.id)) {
      console.log(`[scheduler] ${business.slug}: ya hay contenido de hoy, se omite`);
      continue;
    }
    try {
      const piece = await createPiece(business.slug);
      console.log(`[scheduler] ${business.slug}: ${piece.type} "${piece.title}" listo para aprobar`);
    } catch (err) {
      console.error(`[scheduler] ${business.slug}: falló la generación:`, err);
    }
  }
}

function localDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function hasGeneratedToday(businessId: string): Promise<boolean> {
  const last = await prisma.contentPiece.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last ? localDate(last.createdAt) === localDate(new Date()) : false;
}

async function catchUpIfMissed(): Promise<void> {
  // Interpreta el cron por defecto "min hora * * dias"
  const parts = cronExpr().trim().split(/\s+/);
  if (parts.length !== 5) return;
  const hour = Number(parts[1]);
  const days = parts[4];
  if (Number.isNaN(hour)) return;

  const now = new Date();
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const currentHour = Number(tzParts.find((p) => p.type === "hour")?.value);
  const weekdayName = tzParts.find((p) => p.type === "weekday")?.value ?? "";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = dowMap[weekdayName];

  const isScheduledDay =
    days === "*" ||
    days.split(",").some((d) => Number(d) === today);

  if (isScheduledDay && currentHour >= hour) {
    console.log("[scheduler] Catch-up: hoy tocaba generar y aún no hay contenido");
    await runScheduledGeneration("catch-up");
  }
}
