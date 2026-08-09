const KIE_BASE = "https://api.kie.ai/api/v1";

export interface VeoOptions {
  aspectRatio?: "16:9" | "9:16" | "Auto";
  resolution?: "720p" | "1080p" | "4k";
  duration?: 4 | 6 | 8;
  model?: "veo3" | "veo3_fast" | "veo3_lite";
}

interface KieEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

async function kieFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY no configurado");
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  const json = (await res.json()) as KieEnvelope<T>;
  if (!res.ok || json.code !== 200) {
    throw new Error(json.msg || `Kie.ai HTTP ${res.status}`);
  }
  return json.data;
}

interface RecordInfo {
  taskId: string;
  successFlag: number; // 0 generando, 1 éxito, 2/3 fallo
  errorMessage?: string;
  response?: { resultUrls?: string[]; fullResultUrls?: string[] };
}

/** Genera un clip de video con Veo3 (Kie.ai) y devuelve los bytes del MP4 resultante. */
export async function generateVeoVideo(prompt: string, opts: VeoOptions = {}): Promise<Buffer> {
  const body = {
    prompt,
    model: opts.model ?? "veo3_fast",
    aspect_ratio: opts.aspectRatio ?? "9:16",
    resolution: opts.resolution ?? "720p",
    duration: opts.duration ?? 8,
  };
  const { taskId } = await kieFetch<{ taskId: string }>(`${KIE_BASE}/veo/generate`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const url = await pollForVideoUrl(taskId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el video generado por Kie.ai (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function pollForVideoUrl(taskId: string, timeoutMs = 5 * 60_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await kieFetch<RecordInfo>(`${KIE_BASE}/veo/record-info?taskId=${taskId}`, { method: "GET" });
    if (data.successFlag === 1) {
      const urls = data.response?.fullResultUrls?.length
        ? data.response.fullResultUrls
        : data.response?.resultUrls ?? [];
      if (!urls.length) throw new Error("Kie.ai no devolvió la URL del video generado");
      return urls[0];
    }
    if (data.successFlag === 2 || data.successFlag === 3) {
      throw new Error(data.errorMessage || "La generación de video falló en Kie.ai");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Timeout esperando la generación de video en Kie.ai");
}
