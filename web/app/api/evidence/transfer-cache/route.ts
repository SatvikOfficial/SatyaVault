import { NextResponse } from "next/server";
import { appendCustodyEventCache } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.event) {
      return NextResponse.json({ ok: false, error: "Missing event payload." }, { status: 400 });
    }

    appendCustodyEventCache(body.event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to cache transfer", details: String(error) },
      { status: 500 }
    );
  }
}
