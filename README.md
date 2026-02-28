# SatyaVault

SatyaVault is a deploy-ready GovTech platform for digital forensics and judicial trust.
It provides immutable evidence logging, smart-contract role-based access control, chain-of-custody tracking, and real-time verification on Polygon Amoy.

## Stack

- Smart contract: Solidity (`contracts/SatyaVault.sol`)
- Chain: Polygon Amoy (testnet, free)
- Storage: IPFS via Pinata (free tier)
- Web app: Next.js 14 + Tailwind + SQLite FTS5 (`web/`)
- Wallet signing: MetaMask

## Implemented capabilities

- Evidence submission: local SHA-256 + IPFS + on-chain hash/metadata anchoring
- Chain-of-custody: immutable transfer events with actor/agency/action/notes/timestamp
- Investigative action logging: immutable forensic procedure records per evidence item
- Smart-contract RBAC: Investigator/FSL Officer/Court Officer/Auditor/Ministry Admin enforced on-chain
- Protocol custody matrix: `Investigator -> FSL -> Court` with controlled court remand back to FSL
- Verification: original check + tamper test against on-chain hash
- Unified audit timeline: custody + investigative actions
- Search: SQLite FTS5 with agency/type/date filters
- Audit exports: CSV/PDF
- QR evidence packet: short-lived verification URL + mobile verification page
- Guided walkthrough: step-by-step in-app tour with element highlights

## Prerequisites

- Node.js 20 LTS recommended (Hardhat may warn on Node 25)
- npm
- MetaMask browser extension
- Free Pinata account
- Polygon Amoy testnet MATIC in test wallets

## Environment keys (exact setup)

### 1) Root env for contract deployment and role bootstrap

Copy template:

```bash
cd /Users/satvikmudgal/Desktop/SatyaVault
cp .env.example .env
```

Set these keys in `/Users/satvikmudgal/Desktop/SatyaVault/.env`:

- `AMOY_RPC_URL`
  - Use your Amoy RPC endpoint (`Alchemy` / `Infura` / `QuickNode` / Polygon public RPC).
- `DEPLOYER_PRIVATE_KEY`
  - Private key of a dedicated **testnet-only** deployer wallet (never production wallet).
- `CONTRACT_ADDRESS`
  - Fill after deployment output.
- `INVESTIGATOR_WALLET`, `FSL_OFFICER_WALLET`, `COURT_OFFICER_WALLET`, `AUDITOR_WALLET`, `MINISTRY_ADMIN_WALLET` (optional but recommended)
  - Wallets to pre-provision on-chain roles.
- `TRANSFER_ADMIN=true` (optional)
  - If set, transfers contract admin ownership to `MINISTRY_ADMIN_WALLET` during bootstrap.

### 2) Web env for frontend + backend API routes

Copy template:

```bash
cd /Users/satvikmudgal/Desktop/SatyaVault/web
cp .env.example .env.local
```

Set these keys in `/Users/satvikmudgal/Desktop/SatyaVault/web/.env.local`:

- `NEXT_PUBLIC_AMOY_RPC_URL`
  - Public Amoy RPC for browser reads.
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
  - Same deployed contract address.
- `NEXT_PUBLIC_APP_BASE_URL`
  - Local: `http://localhost:3000`, production: your public URL.
- `PINATA_JWT`
  - Pinata JWT with `pinFileToIPFS` permission.
- `QR_TOKEN_SECRET`
  - 32+ char secret for signing verify links. Generate with:

```bash
openssl rand -base64 48
```

- `CHAIN_SYNC_START_BLOCK` (recommended)
  - Deployment block number to speed up sync.

## Deploy and run (copy-paste flow)

### A) Compile and deploy contract

```bash
cd /Users/satvikmudgal/Desktop/SatyaVault
npm install
npx hardhat compile
npm run deploy:amoy
```

Copy deployment output address and block:

- update root `.env` -> `CONTRACT_ADDRESS`
- update `web/.env.local` -> `NEXT_PUBLIC_CONTRACT_ADDRESS`
- update `web/.env.local` -> `CHAIN_SYNC_START_BLOCK`

### B) Bootstrap role profiles on-chain (recommended)

```bash
cd /Users/satvikmudgal/Desktop/SatyaVault
npm run bootstrap:roles
```

This provisions on-chain actor profiles for Investigator/FSL Officer/Court Officer/Auditor/Ministry from `.env`.

### C) Start web application

```bash
cd /Users/satvikmudgal/Desktop/SatyaVault/web
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## First-run verification checklist

1. Open `/api/system/health` and confirm all booleans are `true`.
2. Click `Connect MetaMask` and switch to Amoy.
3. Confirm `Smart-Contract Access Control` panel shows your wallet role.
4. Upload evidence and complete `Upload to IPFS` -> `Sign & Register`.
5. Select evidence and run `Sign Transfer`.
6. Log one entry in `Investigative Action Log`.
7. Run `Verify Original` and `Run Tamper Test`.
8. Generate QR packet and open `/verify/<token>`.
9. Export CSV/PDF audit.

## Security notes

- Never commit `.env` or `web/.env.local`.
- Never put private keys in frontend code.
- Keep `PINATA_JWT` and `QR_TOKEN_SECRET` server-side only.
- Use separate wallets for deployer and operational roles.

## Free deployment options

- Contract: Polygon Amoy testnet
- Web app: Vercel free tier (or Render free tier)
- IPFS pinning: Pinata free tier
- DB: SQLite file (`web/data/satyavault.sqlite`) for MVP (replace for scale)

## Hackathon submission docs

- Use-case submission draft: `/Users/satvikmudgal/Desktop/SatyaVault/docs/HACKATHON_USE_CASE_SUBMISSION.md`
- Deck outline: `/Users/satvikmudgal/Desktop/SatyaVault/docs/PITCH_DECK_OUTLINE.md`
# SatyaVault
