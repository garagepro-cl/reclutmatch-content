import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id, action } = await params;

  try {
    if (action === "approve") {
      const { approvePiece } = await import("@/lib/pipeline");
      const { piece, targets } = await approvePiece(id);
      return NextResponse.json({ status: piece.status, targets });
    }
    if (action === "reject") {
      const { rejectPiece } = await import("@/lib/pipeline");
      const piece = await rejectPiece(id);
      return NextResponse.json({ status: piece.status });
    }
    if (action === "regenerate") {
      const { regeneratePiece } = await import("@/lib/pipeline");
      const piece = await regeneratePiece(id);
      return NextResponse.json({ status: piece.status, newId: piece.id });
    }
    return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (err) {
    console.error(`[api] ${action} ${id} falló:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
