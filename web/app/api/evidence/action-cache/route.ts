import { NextResponse } from "next/server";
import { appendInvestigationActionCache } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.action) {
      return NextResponse.json({ ok: false, error: "Missing action payload." }, { status: 400 });
    }

    appendInvestigationActionCache(body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to cache investigative action", details: String(error) },
      { status: 500 }
    );
  }
}
