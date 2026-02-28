import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { issueVerifyToken } from "@/lib/token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const evidenceId = Number(searchParams.get("evidenceId"));
  const ttl = Number(searchParams.get("ttl") || "900");

  if (!Number.isFinite(evidenceId)) {
    return NextResponse.json({ ok: false, error: "evidenceId is required" }, { status: 400 });
  }

  try {
    const token = issueVerifyToken(evidenceId, ttl);
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || origin;
    const verifyUrl = `${baseUrl}/verify/${token}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 300
    });

    return NextResponse.json({
      ok: true,
      verifyUrl,
      qrDataUrl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to generate QR", details: String(error) },
      { status: 500 }
    );
  }
}
