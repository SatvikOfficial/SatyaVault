# SatyaVault Operator Tutorial

This guide mirrors the in-app step-by-step guided tour and is intended for real operations, not demo-only usage.

## 1. Connect wallet and confirm role

1. Click `Connect MetaMask`.
2. Approve switch to Polygon Amoy.
3. In `Smart-Contract Access Control`, verify:
   - wallet address
   - assigned role (`INVESTIGATOR`, `FSL_OFFICER`, `COURT_OFFICER`, `AUDITOR`, `MINISTRY_ADMIN`)
   - agency
   - active status

If role is missing/inactive, operations are intentionally blocked by contract.

## 2. Ministry admin: provision actor profiles

1. Open `Smart-Contract Access Control`.
2. Fill actor wallet, role, agency, active flag.
3. Click `Save On-Chain Profile`.
4. Confirm MetaMask transaction.

This updates permissions on-chain and is required before intake/transfer/action logging.

## 3. Evidence intake (Investigator or Ministry Admin)

1. Upload file (`png/jpg/jpeg/pdf`).
2. Confirm local SHA-256 is generated.
3. Fill case ID, investigator ID, evidence type, agency.
4. Click `Upload to IPFS`.
5. Click `Sign & Register` and confirm MetaMask.

Expected: new evidence ID appears in search and detail sections.

## 4. Custody transfer (current custodian only)

1. Select evidence from search results.
2. Set from/to agency, destination wallet, transfer action, notes.
3. Click `Sign Transfer` and confirm MetaMask.

Expected: custody chain updates immediately in timeline and map.

Custody matrix enforced on-chain:
- `INVESTIGATOR -> FSL_OFFICER`
- `FSL_OFFICER -> COURT_OFFICER`
- `COURT_OFFICER -> FSL_OFFICER` (court remand/re-exam)
- `MINISTRY_ADMIN` can supervise cross-phase transfers

## 5. Investigative action logging

1. Select evidence.
2. Set action type, notes, optional artifact URI.
3. Click `Sign Action Log`.

Expected: action appears in unified audit timeline with timestamp and actor.

## 6. Integrity verification

- `Verify Original`: checks uploaded file hash against on-chain hash.
- `Run Tamper Test`: modifies uploaded bytes client-side and verifies mismatch detection.

Expected:
- match => integrity confirmed
- mismatch => tamper detected

## 7. Search and retrieval

Use `Case Search` with:

- full-text query (case/investigator/notes)
- agency filter
- evidence type filter
- date range filters

Click any row to load full evidence detail.

## 8. Audit and legal exports

From `Evidence Detail`:

- `Export CSV`: machine-readable chain/action ledger
- `Export PDF`: printable audit report
- `Generate QR Packet`: short-lived verification link for physical evidence bags

## 9. Guided walkthrough for new users

- Click `Guided Tour` in header.
- Follow highlighted step sequence across the live interface.
- The tour highlights exact sections with overlay focus and explanatory text.
