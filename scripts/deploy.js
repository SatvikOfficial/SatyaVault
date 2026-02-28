const hre = require("hardhat");

async function main() {
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
