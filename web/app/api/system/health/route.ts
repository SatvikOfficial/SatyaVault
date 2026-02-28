import { Contract, JsonRpcProvider } from "ethers";
import { NextResponse } from "next/server";
import { SATYAVAULT_ABI, getRpcUrl } from "@/lib/contract";

export const runtime = "nodejs";

export async function GET() {
  const configuredRpcUrl = process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL || "";
  const configuredContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  const hasPinata = Boolean(process.env.PINATA_JWT);
  const hasQrSecret = Boolean(process.env.QR_TOKEN_SECRET);
  const hasRpcUrl = Boolean(configuredRpcUrl);
  const hasContractAddress = Boolean(configuredContractAddress);

  let rpcReachable = false;
  let contractReachable = false;
  let latestBlock: number | null = null;

  // Use configured values when provided; otherwise fall back to default RPC.
  const rpcUrl = configuredRpcUrl || getRpcUrl();
  const contractAddress = configuredContractAddress;

  try {
    if (hasRpcUrl) {
      const provider = new JsonRpcProvider(rpcUrl);
      latestBlock = await provider.getBlockNumber();
      rpcReachable = Number.isFinite(latestBlock);

      if (rpcReachable && hasContractAddress) {
        const contract = new Contract(contractAddress, SATYAVAULT_ABI, provider);
        await contract.evidenceCount();
        contractReachable = true;
      }
    }
  } catch {
    rpcReachable = false;
    contractReachable = false;
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
