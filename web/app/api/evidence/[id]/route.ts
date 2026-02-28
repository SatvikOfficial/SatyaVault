import { NextResponse } from "next/server";
import { syncFromBlockchain } from "@/lib/chain-sync";
import { getEvidenceWithHistory } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const evidenceId = Number(context.params.id);
  if (!Number.isFinite(evidenceId)) {
    return NextResponse.json({ ok: false, error: "Invalid evidence ID" }, { status: 400 });
  }

  try {
    await syncFromBlockchain();

    const data = getEvidenceWithHistory(evidenceId);
    if (!data.evidence) {
      return NextResponse.json({ ok: false, error: "Evidence not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Evidence read failed", details: String(error) },
      { status: 500 }
    );
  }
}
