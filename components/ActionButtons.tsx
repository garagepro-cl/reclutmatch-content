"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, X, Loader2, CheckCircle2, ClipboardList, XCircle } from "lucide-react";

export function ActionButtons({ pieceId }: { pieceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<{ platform: string; status: string; error: string }[] | null>(null);
  const [error, setError] = useState("");

  async function run(action: "approve" | "reject" | "regenerate") {
    setBusy(action);
    setError("");
    setResults(null);
    try {
      const res = await fetch(`/api/content/${pieceId}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      if (action === "approve" && Array.isArray(json.targets)) {
        setResults(json.targets);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => run("approve")}
          disabled={busy !== null}
          className={`${base} bg-gold text-black hover:bg-gold-light`}
        >
          {busy === "approve" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.5} />}
          {busy === "approve" ? "Publicando…" : "Aprobar"}
        </button>
        <button
          onClick={() => run("regenerate")}
          disabled={busy !== null}
          className={`${base} border border-line text-neutral-200 hover:border-gold`}
        >
          {busy === "regenerate" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {busy === "regenerate" ? "Generando…" : "Otra"}
        </button>
        <button
          onClick={() => run("reject")}
          disabled={busy !== null}
          className={`${base} border border-line text-neutral-400 hover:border-red-500 hover:text-red-300`}
        >
          {busy === "reject" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} strokeWidth={2.5} />}
          Descartar
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {results && (
        <ul className="flex flex-col gap-1.5 text-xs text-neutral-300 bg-panel border border-line rounded-lg p-3">
          {results.map((t) => {
            const Icon = t.status === "PUBLISHED" ? CheckCircle2 : t.status === "MANUAL_REQUIRED" ? ClipboardList : XCircle;
            const color =
              t.status === "PUBLISHED" ? "text-emerald-400" : t.status === "MANUAL_REQUIRED" ? "text-amber-400" : "text-red-400";
            return (
              <li key={t.platform} className="flex items-start gap-1.5">
                <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
                <span>
                  <span className="font-semibold capitalize">{t.platform}:</span>{" "}
                  {t.status === "PUBLISHED" ? "publicado" : t.status === "MANUAL_REQUIRED" ? `manual — ${t.error}` : t.error}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
