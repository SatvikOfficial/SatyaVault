// Browser-side SHA-256 to ensure we hash bytes before upload.
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function asBytes32Hex(hexDigest: string): `0x${string}` {
  const cleaned = hexDigest.toLowerCase().replace(/^0x/, "");
  if (cleaned.length !== 64) {
    throw new Error("Expected a 32-byte SHA-256 hash.");
  }
  return `0x${cleaned}`;
}
