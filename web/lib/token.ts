import crypto from "crypto";

interface VerifyTokenPayload {
  evidenceId: number;
  exp: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function getSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) {
    throw new Error("QR_TOKEN_SECRET is not configured.");
  }
  if (secret.length < 32) {
    throw new Error("QR_TOKEN_SECRET must be at least 32 characters.");
  }
  return secret;
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("hex");
}

export function issueVerifyToken(evidenceId: number, ttlSeconds = 900): string {
  const payload: VerifyTokenPayload = {
    evidenceId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function decodeVerifyToken(token: string): VerifyTokenPayload | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  try {
    const expectedSig = signPayload(payloadB64);
    if (signature.length !== expectedSig.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadB64)) as VerifyTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
