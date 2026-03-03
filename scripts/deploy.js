const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      "No deployer account configured. Set DEPLOYER_PRIVATE_KEY in .env (32-byte hex, with or without 0x prefix)."
    );
  }

  // Deploy fresh SatyaVault contract and print details for web/.env.local setup.
  const SatyaVault = await hre.ethers.getContractFactory("SatyaVault");
  const satyaVault = await SatyaVault.deploy();
  const deploymentTx = satyaVault.deploymentTransaction();
  await satyaVault.waitForDeployment();

  const address = await satyaVault.getAddress();
  console.log("SatyaVault deployed to:", address);
  if (deploymentTx?.blockNumber) {
    console.log("Deployment block:", deploymentTx.blockNumber);
  }

  const blockNumber = deploymentTx?.blockNumber;
  if (!blockNumber) {
    console.log("Skipping env updates (deployment block unavailable).");
    return;
  }

  const rootEnvPath = path.join(process.cwd(), ".env");
  const webEnvPath = path.join(process.cwd(), "web", ".env.local");

  const updates = [
    {
      file: rootEnvPath,
      changes: [
        { key: "CONTRACT_ADDRESS", value: address },
        { key: "SATYAVAULT_CONTRACT_ADDRESS", value: address }
      ]
    },
    {
      file: webEnvPath,
      changes: [
        { key: "NEXT_PUBLIC_CONTRACT_ADDRESS", value: address },
        { key: "CHAIN_SYNC_START_BLOCK", value: String(blockNumber) }
      ]
    }
  ];

  for (const target of updates) {
    if (!fs.existsSync(target.file)) {
      console.log(`Env file not found, skipping: ${target.file}`);
      continue;
    }

    const before = fs.readFileSync(target.file, "utf-8");
    let next = before;
    for (const { key, value } of target.changes) {
      const line = `${key}=${value}`;
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(next)) {
        next = next.replace(re, line);
      } else {
        next = `${next.replace(/\s*$/, "")}\n${line}\n`;
      }
    }
    if (next !== before) {
      fs.writeFileSync(target.file, next, "utf-8");
      console.log(`Updated env: ${target.file}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
