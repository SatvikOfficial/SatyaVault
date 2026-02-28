import { NextResponse } from "next/server";
import { syncFromBlockchain } from "@/lib/chain-sync";
import { getDashboardMetrics } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await syncFromBlockchain();
    const metrics = getDashboardMetrics();
    return NextResponse.json({ ok: true, metrics });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load metrics", details: String(error) },
      { status: 500 }
    );
  }
}
