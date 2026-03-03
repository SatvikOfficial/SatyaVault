import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getGatewayBase(): string {
  const raw = process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return NextResponse.json(
        { error: "PINATA_JWT is missing from environment." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const uploadData = new FormData();
    uploadData.append("file", file, file.name);
    uploadData.append("pinataMetadata", JSON.stringify({ name: `SatyaVault-${file.name}` }));

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      body: uploadData
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Pinata upload failed", details: text },
        { status: response.status }
      );
    }

    const payload = (await response.json()) as { IpfsHash?: string };
    if (!payload.IpfsHash) {
      return NextResponse.json({ error: "Pinata did not return CID." }, { status: 500 });
    }

    const gatewayBase = getGatewayBase();
    return NextResponse.json({
      cid: payload.IpfsHash,
      ipfsUri: `ipfs://${payload.IpfsHash}`,
      gatewayUrl: `${gatewayBase}${payload.IpfsHash}`
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected IPFS upload error", details: String(error) },
      { status: 500 }
    );
  }
}
