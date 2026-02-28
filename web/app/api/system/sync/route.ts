import { NextResponse } from "next/server";
import { syncFromBlockchain } from "@/lib/chain-sync";

export const runtime = "nodejs";

export async function POST() {
  try {
    const report = await syncFromBlockchain({ force: true });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Synchronization failed", details: String(error) },
      { status: 500 }
    );
  }
}
