const hre = require("hardhat");
require("dotenv").config();

/**
 * Bootstrap SatyaVault actor profiles after deployment.
 *
 * Uses environment variables:
 * - CONTRACT_ADDRESS (required unless NEXT_PUBLIC_CONTRACT_ADDRESS is set)
 * - INVESTIGATOR_WALLET (or legacy POLICE_WALLET)
 * - FSL_OFFICER_WALLET (or legacy FSL_WALLET)
 * - COURT_OFFICER_WALLET (or legacy COURT_WALLET)
 * - AUDITOR_WALLET (optional)
 * - MINISTRY_ADMIN_WALLET (optional)
 * - TRANSFER_ADMIN=true (optional, transfers admin ownership to MINISTRY_ADMIN_WALLET)
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Missing CONTRACT_ADDRESS (or NEXT_PUBLIC_CONTRACT_ADDRESS) in environment.");
  }

  const satyaVault = await hre.ethers.getContractAt("SatyaVault", contractAddress);
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("Using admin signer:", deployerAddress);
  console.log("Target contract:", contractAddress);

  // Solidity enum mapping:
  // 0 NONE | 1 INVESTIGATOR | 2 FSL_OFFICER | 3 COURT_OFFICER | 4 AUDITOR | 5 MINISTRY_ADMIN
  const ROLE = {
    INVESTIGATOR: 1,
    FSL_OFFICER: 2,
    COURT_OFFICER: 3,
    AUDITOR: 4,
    MINISTRY_ADMIN: 5
  };

  const roleAssignments = [
    {
      label: "INVESTIGATOR",
      address: process.env.INVESTIGATOR_WALLET || process.env.POLICE_WALLET,
      role: ROLE.INVESTIGATOR,
      agency: "Cyber Crime Cell"
    },
    {
      label: "FSL_OFFICER",
      address: process.env.FSL_OFFICER_WALLET || process.env.FSL_WALLET,
      role: ROLE.FSL_OFFICER,
      agency: "Forensic Science Laboratory"
    },
    {
      label: "COURT_OFFICER",
      address: process.env.COURT_OFFICER_WALLET || process.env.COURT_WALLET,
      role: ROLE.COURT_OFFICER,
      agency: "e-Courts"
    },
    {
      label: "AUDITOR",
      address: process.env.AUDITOR_WALLET,
      role: ROLE.AUDITOR,
      agency: "Audit & Compliance Wing"
    },
    {
      label: "MINISTRY_ADMIN",
      address: process.env.MINISTRY_ADMIN_WALLET,
      role: ROLE.MINISTRY_ADMIN,
      agency: "Ministry of Home Affairs"
    }
  ];

  for (const assignment of roleAssignments) {
    if (!assignment.address) continue;

    if (!hre.ethers.isAddress(assignment.address)) {
      throw new Error(`Invalid ${assignment.label} wallet address: ${assignment.address}`);
    }

    console.log(`Setting ${assignment.label} profile for ${assignment.address}`);
    const tx = await satyaVault.setActorProfile(
      assignment.address,
      assignment.role,
      assignment.agency,
      true
    );
    await tx.wait();
  }

  if (
    process.env.TRANSFER_ADMIN === "true" &&
    process.env.MINISTRY_ADMIN_WALLET &&
    hre.ethers.isAddress(process.env.MINISTRY_ADMIN_WALLET)
  ) {
    console.log("Transferring system admin to MINISTRY_ADMIN_WALLET...");
    const tx = await satyaVault.setSystemAdmin(process.env.MINISTRY_ADMIN_WALLET);
    await tx.wait();
  }

  console.log("Role bootstrap complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
