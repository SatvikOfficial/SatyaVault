import { NextResponse } from "next/server";
import { appendCustodyEventCache, upsertEvidenceCache } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.evidence || !body?.initialEvent) {
      return NextResponse.json(
        { ok: false, error: "Expected evidence and initialEvent payload." },
        { status: 400 }
      );
    }

    upsertEvidenceCache(body.evidence);
    appendCustodyEventCache(body.initialEvent);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to cache evidence", details: String(error) },
      { status: 500 }
    );
  }
}
