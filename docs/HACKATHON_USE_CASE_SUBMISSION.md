# SatyaVault
## Next-Gen Digital Forensics Powered by Blockchain

## Part 1: Critique of the Original Use Case

### Key gaps identified
- Problem statement was broad and non-specific, making impact hard to evaluate.
- Blockchain need was implied, not justified against a conventional database/audit log.
- Actor model was missing, despite requiring multi-agency handoffs.
- Innovation was requested generically, not defined as concrete mechanisms.
- No measurable success criteria or operational trust indicators were described.

### Why this matters to judges
A strong GovTech blockchain submission must prove three things clearly:
1. The government problem is real and urgent.
2. Blockchain is structurally necessary (not optional hype).
3. The system design reflects real operational workflows across agencies.

## Part 2: Improved Use Case Submission

### Use Case Title
**SatyaVault — Blockchain-Anchored Chain-of-Custody for Cross-Agency Digital Forensics**

### Domain
Digital Forensics and Legal Compliance

### Stack
Polygon Amoy Testnet, Solidity, IPFS (Pinata), Next.js 14, Hardhat

## 2.1 The Problem
Digital evidence often moves across multiple agencies (investigation, forensics, court), with handoff records fragmented across disconnected systems. In this model, evidence admissibility can be challenged because there is no shared tamper-proof timeline of who handled what, when, and why.

## 2.2 Why Blockchain (not a database)
A centralized audit log can be changed by a privileged admin or become disputed by cross-agency stakeholders. SatyaVault uses blockchain for:
- **Immutability**: custody and investigative logs are append-only and tamper-evident.
- **Independent verification**: all stakeholders can verify the same on-chain timeline.
- **Protocol-enforced permissions**: roles are enforced in smart contract logic, not only in UI/backend.

## 2.3 Solution Overview
SatyaVault anchors digital evidence lifecycle on-chain:
- SHA-256 hash is computed client-side before upload.
- Evidence payload is stored on IPFS; hash + metadata are stored on-chain.
- Every custody transfer and investigative action is emitted as an immutable event.
- Verification checks recompute file hash and compare with on-chain hash.

## 2.4 Actor Roles
- **MINISTRY_ADMIN**: governance and role provisioning.
- **INVESTIGATOR**: evidence intake and transfer to forensics.
- **FSL_OFFICER**: forensic handling and transfer to court.
- **COURT_OFFICER**: judicial-stage custody, including remand-to-FSL.
- **AUDITOR**: read-only oversight and compliance reporting.

## 2.5 Smart-Contract Features Implemented
- On-chain role profile management (`setActorProfile`).
- Agency-bound custody enforcement (sender/receiver agency validation).
- Custody transition matrix enforcement:
  - `INVESTIGATOR -> FSL_OFFICER`
  - `FSL_OFFICER -> COURT_OFFICER`
  - `COURT_OFFICER -> FSL_OFFICER` (remand/re-exam)
  - `MINISTRY_ADMIN` supervisory override
- Immutable investigative action log (`recordInvestigativeAction`).
- Full evidence and timeline retrieval APIs (`getEvidence`, `getCustodyHistory`, `getInvestigationActions`).

## 2.6 Platform Features Implemented
- Guided role-based operations dashboard.
- Evidence intake, transfer, and forensic action workflows with MetaMask signing.
- Unified custody + investigative timeline.
- Tamper detection demo path (intentional byte mutation check).
- QR-based public verification page.
- Search + filters + export (CSV/PDF).

## 2.7 Government Impact
- Reduces admissibility disputes tied to custody integrity.
- Improves cross-agency accountability with one verifiable ledger.
- Enables oversight through auditor-readable immutable trails.
- Supports free, scalable testnet deployment for pilot rollouts.

---
SatyaVault: where forensic truth remains verifiable from seizure to court.
