import { prisma } from "@/lib/db";
import { parsePlatforms } from "@/lib/brands";
import { loadCredentials } from "@/lib/publish/credentials";

export const dynamic = "force-dynamic";

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`}
    />
  );
}

function Row({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1.5"><Dot ok={ok} /></span>
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-neutral-400">{detail}</p>
      </div>
    </div>
  );
}

export default async function Settings() {
  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
  const telegramOwner = await prisma.setting.findUnique({ where: { key: "telegram_chat_id" } });

  const hasAI = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasTelegramToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasOwner = Boolean(telegramOwner?.value || process.env.TELEGRAM_OWNER_CHAT_ID);
  const hasPublicUrl = Boolean(process.env.PUBLIC_BASE_URL);

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <h1 className="text-2xl font-black">Integraciones</h1>

      <section className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
        <Row
          ok={hasAI}
          name="Ideas con IA (Claude)"
          detail={
            hasAI
              ? `Activo (modelo: ${process.env.ANTHROPIC_MODEL || "claude-opus-4-8"})`
              : "Sin ANTHROPIC_API_KEY en .env — se usa el banco de ideas incorporado (6 ideas listas). Para ideas ilimitadas: console.anthropic.com → API Keys."
          }
        />
        <Row
          ok={hasTelegramToken && hasOwner}
          name="Aprobación por Telegram"
          detail={
            !hasTelegramToken
              ? "Sin TELEGRAM_BOT_TOKEN en .env — crea un bot con @BotFather (2 min) y pega el token. Mientras tanto puedes aprobar desde este dashboard."
              : !hasOwner
                ? "Bot configurado ✔ — falta que le envíes /start a tu bot en Telegram para registrar tu chat."
                : "Activo: las piezas nuevas llegan a tu Telegram con botones de aprobación."
          }
        />
        <Row
          ok={hasPublicUrl}
          name="URL pública (para Instagram)"
          detail={
            hasPublicUrl
              ? `${process.env.PUBLIC_BASE_URL}`
              : "Instagram exige que las imágenes estén en una URL pública. Sin PUBLIC_BASE_URL, IG queda en modo manual (los archivos y el caption quedan listos para publicar a mano). Solución típica: VPS o Cloudflare Tunnel."
          }
        />
        <Row
          ok
          name="Programación"
          detail={`${process.env.SCHEDULE_CRON || "0 9 * * 1,3,5"} (${process.env.SCHEDULE_TZ || "America/Santiago"}) — lunes, miércoles y viernes a las 09:00 por defecto. Si el PC estaba apagado, genera al encenderlo (catch-up).`}
        />
      </section>

      <h2 className="text-lg font-bold text-neutral-300">Publicación por negocio</h2>
      {businesses.map((b) => {
        const platforms = parsePlatforms(b);
        const creds = loadCredentials(b.slug);
        const metaOk = Boolean(creds.meta?.pageId && creds.meta?.accessToken);
        const igOk = metaOk && Boolean(creds.meta?.igUserId) && hasPublicUrl;
        const liOk = Boolean(
          (creds.linkedin?.organizationId || creds.linkedin?.personUrn) && creds.linkedin?.accessToken,
        );
        const ytOk = Boolean(
          creds.youtube?.clientId && creds.youtube?.clientSecret && creds.youtube?.refreshToken,
        );
        return (
          <section key={b.id} className="rounded-2xl border border-line overflow-hidden">
            <p className="px-4 py-3 font-bold text-gold-light border-b border-line bg-panel">
              {b.name}
            </p>
            <div className="divide-y divide-line">
              {platforms.includes("facebook") && (
                <Row
                  ok={metaOk}
                  name="Facebook"
                  detail={
                    metaOk
                      ? "Publicación automática activa."
                      : `Falta data/credentials/${b.slug}.json con meta.pageId y meta.accessToken (guía en el README, sección Meta).`
                  }
                />
              )}
              {platforms.includes("instagram") && (
                <Row
                  ok={igOk}
                  name="Instagram"
                  detail={
                    igOk
                      ? "Publicación automática activa."
                      : metaOk
                        ? "Falta meta.igUserId en las credenciales y/o PUBLIC_BASE_URL en .env."
                        : `Requiere cuenta IG Business vinculada a una página de Facebook + credenciales de Meta en data/credentials/${b.slug}.json + PUBLIC_BASE_URL (guía en el README).`
                  }
                />
              )}
              {platforms.includes("linkedin") && (
                <Row
                  ok={liOk}
                  name="LinkedIn (página de empresa)"
                  detail={
                    liOk
                      ? "Publicación automática activa (carruseles como documento PDF)."
                      : `Falta data/credentials/${b.slug}.json con linkedin.organizationId y linkedin.accessToken (requiere app aprobada en el portal de desarrolladores — guía en el README). Mientras tanto, el PDF llega listo por Telegram para publicarlo a mano.`
                  }
                />
              )}
              {platforms.includes("youtube") && (
                <Row
                  ok={ytOk}
                  name="YouTube Shorts"
                  detail={
                    ytOk
                      ? "Publicación automática activa."
                      : `Crea las credenciales OAuth en Google Cloud y corre: npm run yt:auth -- ${b.slug} (guía en el README).`
                  }
                />
              )}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-neutral-500">
        Nada de esto bloquea el flujo: sin credenciales, el contenido aprobado queda en estado
        “Manual” con los archivos y el caption listos para copiar y publicar a mano.
      </p>
    </div>
  );
}
