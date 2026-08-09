import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const slug = body.slug as string | undefined;
    const type = body.type as "CAROUSEL" | "VIDEO" | undefined;
    const prompt = body.prompt as string | undefined;
    if (!slug) {
      return NextResponse.json({ error: "Falta el negocio (slug)" }, { status: 400 });
    }

    const { createPiece } = await import("@/lib/pipeline");
    const piece = await createPiece(slug, type, prompt);
    return NextResponse.json({ id: piece.id, status: piece.status, title: piece.title });
  } catch (err) {
    console.error("[api] generate falló:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
