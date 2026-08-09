import Link from "next/link";
import { prisma } from "@/lib/db";
import { daysAgo, nextScheduledRun } from "@/lib/schedule-helpers";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButtons } from "@/components/ActionButtons";
import { GenerateButton } from "@/components/GenerateButton";
import {
  Clock,
  Rocket,
  AlertTriangle,
  CalendarClock,
  Images,
  Video,
  MessageSquare,
  CheckCircle2,
  ClipboardList,
  XCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "neutral" | "gold" | "emerald" | "red";
}) {
  const toneCls = {
    neutral: "text-neutral-300",
    gold: "text-gold-light",
    emerald: "text-emerald-400",
    red: "text-red-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 flex items-center gap-3">
      <div className={`rounded-xl bg-panel-hover p-2.5 ${toneCls}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

const TARGET_ICON: Record<string, LucideIcon> = {
  PUBLISHED: CheckCircle2,
  MANUAL_REQUIRED: ClipboardList,
  FAILED: XCircle,
};
const TARGET_COLOR: Record<string, string> = {
  PUBLISHED: "text-emerald-400",
  MANUAL_REQUIRED: "text-amber-400",
  FAILED: "text-red-400",
};

export default async function Home() {
  const weekAgo = daysAgo(7);

  const [pending, recent, businesses, publishedCount, failedTargets] = await Promise.all([
    prisma.contentPiece.findMany({
      where: { status: "PENDING" },
      include: { business: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentPiece.findMany({
      where: { status: { in: ["PUBLISHED", "APPROVED", "REJECTED", "FAILED"] } },
      include: { business: true, targets: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.business.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.contentPiece.count({ where: { status: "PUBLISHED", publishedAt: { gte: weekAgo } } }),
    prisma.publishTarget.count({ where: { status: "FAILED", updatedAt: { gte: weekAgo } } }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Clock} label="Por aprobar" value={String(pending.length)} tone="gold" />
        <StatTile icon={Rocket} label="Publicadas (7 días)" value={String(publishedCount)} tone="emerald" />
        <StatTile icon={AlertTriangle} label="Errores (7 días)" value={String(failedTargets)} tone={failedTargets > 0 ? "red" : "neutral"} />
        <StatTile icon={CalendarClock} label="Próxima generación" value={nextScheduledRun()} />
      </section>

      {/* Generar ahora */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          Generar ahora
        </h2>
        <div className="flex flex-wrap gap-8">
          {businesses.map((b) => (
            <GenerateButton key={b.id} slug={b.slug} name={b.name} />
          ))}
        </div>
      </section>

      {/* Cola de aprobación */}
      <section>
        <h1 className="text-2xl font-black mb-4">
          Por aprobar{" "}
          <span className="text-gold">({pending.length})</span>
        </h1>
        {pending.length === 0 ? (
          <p className="text-neutral-400 text-sm border border-dashed border-line rounded-2xl p-8 text-center">
            No hay contenido esperando aprobación. Usa “Generar ahora” o espera la próxima
            generación programada ({nextScheduledRun().toLowerCase()}).
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => {
              const TypeIcon = p.type === "CAROUSEL" ? Images : Video;
              return (
                <div key={p.id} className="rounded-2xl border border-line bg-panel overflow-hidden flex flex-col hover:border-neutral-600 transition-colors">
                  <Link href={`/content/${p.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/media/${p.id}/${p.coverPath}`}
                      alt={p.title}
                      className="w-full aspect-[4/5] object-cover"
                    />
                  </Link>
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-semibold text-gold-light">{p.business.name}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <TypeIcon size={13} /> {p.type === "CAROUSEL" ? "Carrusel" : "Video"}
                      </span>
                      <span>·</span>
                      <span>{p.source === "ai" ? "IA" : "banco"}</span>
                      {p.customPrompt && (
                        <span title={`Tema pedido: ${p.customPrompt}`}>
                          <MessageSquare size={13} />
                        </span>
                      )}
                    </div>
                    <Link href={`/content/${p.id}`} className="font-bold leading-snug hover:text-gold-light transition-colors">
                      {p.title}
                    </Link>
                    <div className="mt-auto">
                      <ActionButtons pieceId={p.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial */}
      <section>
        <h2 className="text-lg font-bold mb-3 text-neutral-300">Historial reciente</h2>
        <div className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {recent.length === 0 && (
            <p className="p-6 text-sm text-neutral-500">Aún no hay piezas procesadas.</p>
          )}
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/content/${p.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-panel-hover transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${p.id}/${p.coverPath}`}
                alt=""
                className="h-12 w-10 rounded object-cover border border-line"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="text-xs text-neutral-500">
                  {p.business.name} · {p.type === "CAROUSEL" ? "Carrusel" : "Video"} ·{" "}
                  {new Date(p.updatedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <div className="flex gap-1.5 items-center">
                {p.targets.map((t) => {
                  const Icon = TARGET_ICON[t.status] ?? Loader2;
                  return (
                    <span key={t.id} title={`${t.platform}: ${t.status}`} className={TARGET_COLOR[t.status] ?? "text-neutral-500"}>
                      <Icon size={14} />
                    </span>
                  );
                })}
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
