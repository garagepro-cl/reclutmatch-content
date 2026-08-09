import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Images, Video, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButtons } from "@/components/ActionButtons";

export const dynamic = "force-dynamic";

export default async function ContentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: { business: true, targets: true },
  });
  if (!piece) notFound();

  const slides = Array.from({ length: piece.slideCount }, (_, i) =>
    piece.type === "CAROUSEL"
      ? `slide-${String(i + 1).padStart(2, "0")}.png`
      : `vslide-${String(i + 1).padStart(2, "0")}.png`,
  );

  const TypeIcon = piece.type === "CAROUSEL" ? Images : Video;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-gold-light transition-colors">
          <ArrowLeft size={14} /> Volver a la cola
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black">{piece.title}</h1>
          <StatusBadge status={piece.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-neutral-400">
          {piece.business.name} ·{" "}
          <span className="inline-flex items-center gap-1">
            <TypeIcon size={13} /> {piece.type === "CAROUSEL" ? "Carrusel" : "Video"}
          </span>{" "}
          · {piece.pillar || "sin pilar"} · fuente: {piece.source === "ai" ? "IA" : "banco de ideas"} ·{" "}
          {new Date(piece.createdAt).toLocaleString("es-CL")}
        </p>
        {piece.customPrompt && (
          <p className="mt-2 flex items-start gap-2 text-sm text-gold-light bg-gold/10 border border-gold/30 rounded-lg px-3 py-2">
            <MessageSquare size={15} className="mt-0.5 shrink-0" /> Tema pedido: “{piece.customPrompt}”
          </p>
        )}
      </div>

      {piece.status === "PENDING" && <ActionButtons pieceId={piece.id} />}
      {piece.error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {piece.error}
        </p>
      )}

      {piece.type === "VIDEO" && piece.videoPath && (
        <video
          controls
          className="max-h-[70vh] rounded-2xl border border-line"
          src={`/api/media/${piece.id}/${piece.videoPath}`}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Slides ({piece.slideCount})
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {slides.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f}
              src={`/api/media/${piece.id}/${f}`}
              alt={f}
              className="rounded-xl border border-line"
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Caption (copiar y pegar)
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-neutral-200">
            {piece.caption + "\n\n" + piece.hashtags}
          </pre>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Publicación por plataforma
          </h2>
          {piece.targets.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Aún sin intentos de publicación (se crean al aprobar).
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {piece.targets.map((t) => (
                <li key={t.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize">{t.platform}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  {t.permalink && (
                    <a href={t.permalink} target="_blank" className="text-gold-light text-xs hover:underline">
                      {t.permalink}
                    </a>
                  )}
                  {t.error && <p className="text-xs text-neutral-400 mt-1">{t.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
