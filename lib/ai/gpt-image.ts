const KIE_BASE = "https://api.kie.ai/api/v1";

export interface GptImageOptions {
  aspectRatio?: "1:1" | "4:5" | "5:4" | "4:3" | "3:4" | "16:9" | "9:16" | "auto";
  resolution?: "1K" | "2K" | "4K";
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

interface JobRecord {
  taskId: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  failMsg?: string;
  resultJson?: string;
}

/** Genera una imagen con GPT Image 2 (Kie.ai) y devuelve los bytes de la imagen resultante. */
export async function generateImage(prompt: string, opts: GptImageOptions = {}): Promise<Buffer> {
  const body = {
    model: "gpt-image-2-text-to-image",
    input: {
      prompt,
      aspect_ratio: opts.aspectRatio ?? "4:5",
      resolution: opts.resolution ?? "1K",
    },
  };
  const { taskId } = await kieFetch<{ taskId: string }>(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const url = await pollForImageUrl(taskId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen generada por Kie.ai (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function pollForImageUrl(taskId: string, timeoutMs = 3 * 60_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await kieFetch<JobRecord>(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, { method: "GET" });
    if (data.state === "success") {
      const parsed = data.resultJson ? (JSON.parse(data.resultJson) as { resultUrls?: string[] }) : {};
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie.ai no devolvió la URL de la imagen generada");
      return url;
    }
    if (data.state === "fail") {
      throw new Error(data.failMsg || "La generación de imagen falló en Kie.ai");
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Timeout esperando la generación de imagen en Kie.ai");
}
