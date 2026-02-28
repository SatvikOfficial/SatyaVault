import { NextResponse } from "next/server";
import { syncFromBlockchain } from "@/lib/chain-sync";
import { searchEvidence } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    await syncFromBlockchain();

    const results = searchEvidence({
      q: searchParams.get("q") || undefined,
      agency: searchParams.get("agency") || undefined,
      evidenceType: searchParams.get("evidenceType") || undefined,
      fromDate: searchParams.get("fromDate") || undefined,
      toDate: searchParams.get("toDate") || undefined
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Search failed", details: String(error) },
      { status: 500 }
    );
  }
}
