"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Video, Loader2 } from "lucide-react";

export function GenerateButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate(type?: "CAROUSEL" | "VIDEO") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, type, prompt: prompt.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error generando");
      setPrompt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3 w-full max-w-sm">
      <span className="text-sm text-gold-light font-semibold">{name}</span>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={busy}
        placeholder="Opcional: dile a la IA exactamente qué tema quieres (ej: “el costo de una mala contratación en una PYME”). Si lo dejas vacío, elige un tema automáticamente."
        rows={2}
        className="w-full resize-none rounded-lg border border-line bg-background px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-gold focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => generate("CAROUSEL")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1 text-xs hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Images size={13} /> Carrusel
        </button>
        <button
          onClick={() => generate("VIDEO")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1 text-xs hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Video size={13} /> Video
        </button>
        {busy && (
          <span className="inline-flex items-center gap-1 text-xs text-gold">
            <Loader2 size={13} className="animate-spin" /> generando…
          </span>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
