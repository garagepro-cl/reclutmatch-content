import type { LucideIcon } from "lucide-react";
import { Clock, Loader2, CheckCircle2, Rocket, Ban, XCircle, ClipboardList } from "lucide-react";

const STYLES: Record<string, { label: string; cls: string; icon: LucideIcon; spin?: boolean }> = {
  PENDING: { label: "Por aprobar", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: Clock },
  RENDERING: { label: "Generando…", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40", icon: Loader2, spin: true },
  APPROVED: { label: "Aprobada", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: CheckCircle2 },
  PUBLISHED: { label: "Publicada", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50", icon: Rocket },
  REJECTED: { label: "Descartada", cls: "bg-neutral-500/15 text-neutral-400 border-neutral-500/40", icon: Ban },
  FAILED: { label: "Error", cls: "bg-red-500/15 text-red-300 border-red-500/40", icon: XCircle },
  MANUAL_REQUIRED: { label: "Manual", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: ClipboardList },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? {
    label: status,
    cls: "bg-neutral-500/15 text-neutral-300 border-neutral-500/40",
    icon: Clock,
  };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <Icon size={12} strokeWidth={2.5} className={s.spin ? "animate-spin" : ""} />
      {s.label}
    </span>
  );
}
