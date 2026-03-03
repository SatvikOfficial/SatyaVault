import { Contract, JsonRpcProvider, ZeroAddress, isAddress } from "ethers";
import { NextResponse } from "next/server";
import { SATYAVAULT_ABI, getRpcUrl } from "@/lib/contract";

export const runtime = "nodejs";

function isPlaceholder(value: string): boolean {
  return /YOUR_|PASTE_|CHANGE_THIS|changeme|replace_me/i.test(value);
}

export async function GET() {
  const configuredRpcUrl = process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL || "";
  const configuredContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  const pinataJwt = String(process.env.PINATA_JWT || "");
  const qrSecret = String(process.env.QR_TOKEN_SECRET || "");

  const hasPinata = Boolean(pinataJwt) && !isPlaceholder(pinataJwt) && pinataJwt.length >= 20;
  const hasQrSecret = Boolean(qrSecret) && !isPlaceholder(qrSecret) && qrSecret.length >= 32;
  const hasRpcUrl = Boolean(configuredRpcUrl);
  const hasContractAddress =
    Boolean(configuredContractAddress) &&
    isAddress(configuredContractAddress) &&
    configuredContractAddress !== ZeroAddress;

  let rpcReachable = false;
  let contractReachable = false;
  let latestBlock: number | null = null;

  // Use configured values when provided; otherwise fall back to default RPC.
  const rpcUrl = configuredRpcUrl || getRpcUrl();
  const contractAddress = configuredContractAddress;

  if (hasRpcUrl) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      latestBlock = await provider.getBlockNumber();
      rpcReachable = Number.isFinite(latestBlock);
    } catch {
      rpcReachable = false;
      latestBlock = null;
    }

    if (rpcReachable && hasContractAddress) {
      try {
        const provider = new JsonRpcProvider(rpcUrl);
        const contract = new Contract(contractAddress, SATYAVAULT_ABI, provider);
        await contract.evidenceCount();
        contractReachable = true;
      } catch {
        contractReachable = false;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checks: {
      hasRpcUrl,
      hasContractAddress,
      hasPinataJwt: hasPinata,
      hasQrSecret,
      rpcReachable,
      contractReachable,
      latestBlock
    }
  });
}
