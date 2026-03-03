require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

function getDeployerAccounts() {
  let raw = String(process.env.DEPLOYER_PRIVATE_KEY || "").trim();
  if (!raw) return [];
  if (/YOUR_PRIVATE_KEY_HERE|PASTE_/i.test(raw)) return [];

  // Allow common `.env` styles: quoted strings, with/without 0x.
  raw = raw.replace(/^['"]|['"]$/g, "").trim();
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) return [];
  return [normalized];
}

// Hardhat configuration for Polygon Amoy testnet.
// We keep only required networks to reduce accidental mis-deployments.
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: getDeployerAccounts(),
      gas: "auto",
      gasPrice: "auto"
    }
  }
};
