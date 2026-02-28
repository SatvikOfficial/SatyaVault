# SatyaVault Pitch Deck Outline

## Slide 1: One-line hook
- "If one byte changes, justice can fail. SatyaVault makes evidence trust verifiable."

## Slide 2: Problem
- Digital evidence often faces admissibility challenges.
- Manual chain-of-custody logs are fragmented and dispute-prone.

## Slide 3: Why this matters to government
- Faster, defensible judicial workflows.
- Transparent handoff accountability across Investigators, FSL, and e-Courts.

## Slide 4: Solution
- Local SHA-256 hashing at intake.
- IPFS storage for evidence payload.
- Polygon Amoy smart contract for immutable custody records.

## Slide 5: Platform architecture
- Next.js operations portal + API backend.
- Solidity contract + MetaMask signatures.
- SQLite FTS5 index + chain sync cache for reliability.

## Slide 6: Key capabilities
- Evidence intake and on-chain registration.
- Signed custody transfer workflow.
- Integrity verification and tamper detection.
- Audit export (CSV/PDF) and QR verification packets.

## Slide 7: Government-ready UX
- Role-based interface (Investigator, FSL Officer, Court Officer, Auditor, Ministry Admin).
- Animated custody timeline + agency movement map.
- In-app onboarding tutorial for first-time operators.

## Slide 8: Reliability and risk controls
- Live blockchain reads with synchronized cache fallback.
- Health endpoint for key/config/network checks.
- Graceful error handling for wallet/network disruptions.

## Slide 9: Security posture
- No private keys in frontend.
- Server-side JWT and token secret handling.
- Signed short-lived verification links.

## Slide 10: Impact metrics
- Time-to-verify evidence integrity in seconds.
- Full custody visibility from seizure to courtroom submission.
- Reduced chain-of-custody dispute surface.

## Slide 11: Roadmap
- Government identity integration (agency SSO/eSign).
- Multi-party approvals for high-priority evidence.
- State/national deployment with e-Courts integration.
