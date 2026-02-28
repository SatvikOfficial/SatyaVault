# SatyaVault Production Execution Plan

This document replaces demo-mode planning with a deployment-focused execution flow.

## Phase 1: Environment and secrets

1. Create root env:
   - `cp .env.example .env`
   - Fill `AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`
2. Create web env:
   - `cd web && cp .env.example .env.local`
   - Fill `NEXT_PUBLIC_AMOY_RPC_URL`, `PINATA_JWT`, `QR_TOKEN_SECRET`, `NEXT_PUBLIC_APP_BASE_URL`

Exit criteria:
- No placeholder values remain in either env file.

## Phase 2: Contract deployment

1. `npm install`
2. `npx hardhat compile`
3. `npm run deploy:amoy`
4. Copy contract address to `web/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`

Exit criteria:
- Contract deployed on Polygon Amoy.
- Contract address saved in web env.

## Phase 3: Web backend startup

1. `cd web`
2. `npm install`
3. `npm run dev`
4. Open `/api/system/health`

Exit criteria:
- Health endpoint returns:
  - `hasRpcUrl: true`
  - `hasContractAddress: true`
  - `hasPinataJwt: true`
  - `hasQrSecret: true`
  - `rpcReachable: true`
  - `contractReachable: true`

## Phase 4: End-to-end functional checks

1. Connect MetaMask in app.
2. Upload evidence file and pin to IPFS.
3. Register evidence on-chain (MetaMask signature).
4. Transfer custody between agencies.
5. Verify original file and run tamper test.
6. Generate QR packet and open verification URL.
7. Export timeline as CSV/PDF.

Exit criteria:
- All seven flows complete without runtime errors.

## Phase 5: Reliability checks

1. Click `Sync Blockchain Data` and confirm status success.
2. Temporarily disrupt RPC connectivity and verify:
   - App falls back to synchronized cache for reads.
   - UI still loads evidence details.
3. Re-enable RPC and confirm live mode resumes.

Exit criteria:
- Read-only operations remain available during RPC disruptions.

## Phase 6: Operator onboarding

1. Open app in fresh browser profile.
2. Confirm onboarding tutorial appears automatically.
3. Reopen tutorial from `Open Tutorial` button.

Exit criteria:
- New users can complete core flows without external guidance.

## Go-live readiness checklist

- [ ] Smart contract deployed and verified on Amoy explorer
- [ ] Secrets set in deployment platform env manager
- [ ] `/api/system/health` fully green
- [ ] Evidence intake, transfer, verification, QR, export all passed
- [ ] Mobile verify page reachable from generated QR
- [ ] Backup/retention plan defined for SQLite data file
