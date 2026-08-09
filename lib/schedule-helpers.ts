const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCHEDULED_DAYS = [1, 3, 5]; // lunes, miércoles, viernes

/** N días atrás desde ahora (para ventanas de conteo tipo "últimos 7 días") */
export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

/** Próxima corrida programada (lun/mié/vie 09:00 America/Santiago) en texto legible */
export function nextScheduledRun(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const now = new Date();
  for (let add = 0; add < 8; add++) {
    const d = new Date(now.getTime() + add * 86_400_000);
    const parts = fmt.formatToParts(d);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const idx = WEEKDAYS.indexOf(weekday);
    if (!SCHEDULED_DAYS.includes(idx)) continue;
    if (add === 0 && hour >= 9) continue;
    if (add === 0) return "Hoy 09:00";
    if (add === 1) return "Mañana 09:00";
    const label = new Intl.DateTimeFormat("es-CL", { weekday: "long", timeZone: "America/Santiago" }).format(d);
    return `${label[0].toUpperCase()}${label.slice(1)} 09:00`;
  }
  return "Lun/Mié/Vie 09:00";
}
