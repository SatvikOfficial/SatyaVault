import abi from "@/lib/contract-abi.json";

export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_ID_HEX = "0x13882";

export const SATYAVAULT_ABI = abi;

export function getRpcUrl(): string {
  return process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
}

export function getContractAddress(): string {
  const value = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!value) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set.");
  }
  return value;
}
