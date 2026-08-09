/**
 * Arranque de servicios de fondo junto al servidor Next.js:
 * bot de Telegram (long polling) + scheduler de generación.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as { __contentPilotStarted?: boolean };
  if (g.__contentPilotStarted) return;
  g.__contentPilotStarted = true;

  try {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  } catch (err) {
    console.error("[content-pilot] No se pudo iniciar el scheduler:", err);
  }

  try {
    const { startTelegram } = await import("./lib/telegram");
    await startTelegram();
  } catch (err) {
    console.error("[content-pilot] No se pudo iniciar el bot de Telegram:", err);
  }
}
