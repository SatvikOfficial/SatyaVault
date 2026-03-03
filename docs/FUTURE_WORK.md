# SatyaVault - Future Enhancements Roadmap

This document outlines planned enhancements to SatyaVault that were designed but not yet implemented. These features represent next-level improvements for production deployment.

---

## ✅ Implemented: Client-Side Encryption (Zero-Knowledge Privacy Layer)

**Status:** Smart contract ready, UI pending

### What It Does
- Encrypts evidence files **before** uploading to IPFS
- Only authorized roles (Investigator, FSL, Court) can decrypt
- Even if IPFS is compromised, evidence remains unreadable

### How It Works
```
┌──────────────┐
│  Web App     │
│  (Browser)   │
└──────┬───────┘
       │ 1. Generate AES-256 key
       │ 2. Encrypt file locally
       │ 3. Upload ENCRYPTED file to IPFS
       │ 4. Store encryption key in contract
       │    (accessible only to authorized addresses)
       ▼
┌──────────────┐
│   IPFS       │
│  (Encrypted  │
│   content)   │
└──────────────┘

┌──────────────┐
│  Contract    │
│  (Key store) │
└──────────────┘
       │
       │ 5. Authorized user retrieves key
       │ 6. Decrypts file locally
       ▼
┌──────────────┐
│  Decrypted   │
│  Evidence    │
└──────────────┘
```

### Smart Contract Functions Added
```solidity
// Store encryption key for authorized address
function storeEncryptionKey(uint256 evidenceId, address authorizedAddress, string calldata encryptedKey)

// Retrieve encryption key (only if authorized)
function getEncryptionKey(uint256 evidenceId, address accessor) returns (string memory)

// Check if user has decryption access
function hasEncryptionKeyAccess(uint256 evidenceId, address accessor) returns (bool)

// Get all authorized decryptors
function getAuthorizedDecryptors(uint256 evidenceId) returns (address[] memory)
```

### Files Added
- `contracts/SatyaVault.sol` - Added encryption key storage
- `web/lib/encryption.ts` - Client-side encryption utilities

### What's Remaining
- [ ] UI integration for encrypt/decrypt flow
- [ ] Auto-decrypt when viewing evidence
- [ ] Key rotation mechanism

---

## 📋 Future Work: Account Abstraction (Gasless UX)

**Status:** Design complete, implementation deferred

### The Problem
Currently, every police officer/court official needs:
1. A MetaMask wallet
2. POL tokens for gas fees
3. To manage their own private keys

This creates friction - what if an investigator can't submit urgent evidence because they ran out of gas?

### The Solution: ERC-4337 Account Abstraction

```
┌─────────────────────────────────────────────────────┐
│  Current Flow (With Gas)                            │
│  User clicks "Submit Evidence"                      │
│  → MetaMask popup                                   │
│  → User approves transaction                        │
│  → Pays 0.001 POL gas                               │
│  → Transaction submitted                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  With Account Abstraction (Gasless)                 │
│  User clicks "Submit Evidence"                      │
│  → Signs message (no gas needed)                    │
│  → Bundler submits transaction                      │
│  → Ministry pays gas (paymaster)                    │
│  → Transaction submitted                            │
└─────────────────────────────────────────────────────┘
```

### Implementation Options

#### Option 1: Biconomy (Easiest)
```javascript
// Frontend uses Biconomy SDK
import { Biconomy } from '@biconomy/mexa';

// User signs, Biconomy handles gas
contract.submitEvidence(..., { gasless: true });
```

**Pros:**
- Minimal code changes
- Paymaster handles gas sponsorship
- Works with existing contracts

**Cons:**
- Third-party dependency
- Requires Biconomy dashboard setup

#### Option 2: ERC-4337 Native (Best Long-term)
```javascript
// Create smart account for each user
const smartAccount = await createSmartAccount(wallet);

// Submit via user operation
const userOp = await smartAccount.createUserOp(callData);
```

**Pros:**
- No third-party dependency
- Full control over paymaster
- Future-proof (account abstraction standard)

**Cons:**
- Requires bundler infrastructure
- More complex setup

### Recommended Approach
**Start with Biconomy** for hackathon/demo, migrate to ERC-4337 for production.

### Files to Add/Modify
- `web/lib/biconomy.ts` - Biconomy SDK integration
- `web/app/api/paymaster/route.ts` - Paymaster approval endpoint
- Update all contract interaction hooks to use gasless transactions

### Estimated Effort
- Biconomy: 4-6 hours
- ERC-4337: 2-3 days

---

## 📋 Future Work: Multi-Sig Governance

**Status:** Design complete, implementation deferred

### The Problem
Currently, `MINISTRY_ADMIN` has god-mode powers:
- Can provision any role
- Can override custody rules
- Single point of failure

If this key is compromised, the entire system is at risk.

### The Solution: Gnosis Safe Multi-Sig

```
┌─────────────────────────────────────────────────────┐
│  Current: Single Admin Key                          │
│                                                     │
│  [Ministry Admin Wallet] ──→ [System Contract]     │
│         ⚠️ Single point of failure                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  With Multi-Sig (3-of-5)                            │
│                                                     │
│  [Official 1] ──┐                                  │
│  [Official 2] ──┼──→ [Gnosis Safe] ──→ [Contract]  │
│  [Official 3] ──┤        ✅ 3 of 5 required         │
│  [Official 4] ──┤                                  │
│  [Official 5] ──┘                                  │
└─────────────────────────────────────────────────────┘
```

### Implementation

#### Step 1: Deploy Gnosis Safe
```javascript
// Deploy Safe with 5 signers, 3 required
const safe = await deploySafe({
  owners: [
    '0xOfficial1...',
    '0xOfficial2...',
    '0xOfficial3...',
    '0xOfficial4...',
    '0xOfficial5...'
  ],
  threshold: 3
});
```

#### Step 2: Transfer Contract Ownership
```javascript
// Transfer systemAdmin role to Safe contract
await satyaVault.transferOwnership(safe.address);
```

#### Step 3: All Admin Actions Require Multi-Sig
```javascript
// Instead of direct call:
await contract.setActorProfile(...); // ❌ Won't work

// Create transaction proposal:
await safe.createTransaction({
  to: contract.address,
  data: contract.interface.encodeFunctionData('setActorProfile', [...])
});

// Other signers approve:
await safe.approveTransaction(txHash); // Signer 2
await safe.approveTransaction(txHash); // Signer 3

// Executes automatically when threshold reached
```

### Alternative: Build Multi-Sig Into Contract

```solidity
// Add multi-sig directly to SatyaVault
mapping(bytes32 => mapping(address => bool)) public proposalApprovals;
mapping(bytes32 => Proposal) public proposals;

function proposeAdminAction(bytes32 actionId, bytes calldata data) external onlyAdmin {
    // Create proposal
}

function approveProposal(bytes32 actionId) external onlyAdmin {
    proposalApprovals[actionId][msg.sender] = true;
    
    if (countApprovals(actionId) >= REQUIRED_APPROVALS) {
        executeProposal(actionId);
    }
}
```

### Recommended Approach
**Use Gnosis Safe** - battle-tested, widely adopted, easy to integrate.

### Files to Add/Modify
- Deploy Gnosis Safe on Polygon Amoy
- Update deployment script to transfer ownership
- Update admin UI to work with multi-sig flows

### Estimated Effort
- Gnosis Safe integration: 2-3 hours
- UI updates for multi-sig UX: 4-6 hours

---

## 📋 Future Work: Physical-Digital Bridge (IoT Integration)

**Status:** Design complete, UI mock ready

### The Problem
SatyaVault tracks **digital** evidence files, but physical evidence (laptops, phones, weapons) also needs chain-of-custody tracking.

How do we ensure the physical laptop handed over matches the digital record?

### The Solution: NFC Tags + Tamper-Evident Seals

```
┌─────────────────────────────────────────────────────┐
│  Physical Evidence Bag                              │
│  ┌─────────────────────────────────────┐           │
│  │  ┌───────┐                          │           │
│  │  │  NFC  │  ← Scan with phone       │           │
│  │  │  Tag  │     to verify            │           │
│  │  └───────┘                          │           │
│  │                                     │           │
│  │  [Tamper-Evident QR Sticker]        │           │
│  │  "VOID" if removed                  │           │
│  │                                     │           │
│  │  Evidence ID: SATYA-2026-001        │           │
│  │  Case: State v. John Doe            │           │
│  └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

### How It Works

#### 1. Tag Physical Evidence
```
┌──────────────┐
│  Investigator│
└──────┬───────┘
       │ 1. Place evidence in tamper bag
       │ 2. Attach NFC tag + QR sticker
       │ 3. Scan NFC with phone
       │ 4. Link to digital evidence record
       ▼
┌──────────────┐
│   Web App    │
└──────┬───────┘
       │ 5. Creates physical-digital link
       ▼
┌──────────────┐
│   Contract   │
└──────┬───────┘
       │ 6. Stores:
       │    - NFC tag ID
       │    - QR code hash
       │    - Linked evidence ID
```

#### 2. Verify at Each Handoff
```
┌──────────────┐
│  Receiving   │
│  Officer     │
└──────┬───────┘
       │ 1. Scan NFC tag with phone
       │ 2. App shows:
       │    - Evidence details
       │    - Custody history
       │    - Tamper status
       │ 3. Confirm physical matches digital
       ▼
┌──────────────┐
│   Web App    │
└──────┬───────┘
       │ 4. Log physical handoff
       ▼
┌──────────────┐
│   Contract   │
└──────────────┘
```

### Implementation Options

#### Option 1: NFC Tags (Recommended)
- **Tags:** NTAG 424 DNA (cryptographic authentication)
- **Cost:** ~$0.50 per tag
- **Range:** <4cm (intentional scan required)

**Workflow:**
```javascript
// Scan NFC tag
const ndef = new NDEFReader();
await ndef.scan();

// Get tag ID
const tagId = ndef.tag.id;

// Verify against contract
const isValid = await contract.verifyPhysicalTag(evidenceId, tagId);
```

#### Option 2: QR Code Stickers
- **Type:** Tamper-evident "VOID" stickers
- **Cost:** ~$0.10 per sticker
- **Security:** Visual tamper detection

**Workflow:**
```javascript
// Scan QR code
const qrData = await scanQR();

// Verify hash matches on-chain
const isValid = await contract.verifyQRHash(evidenceId, qrData.hash);
```

#### Option 3: Both (Maximum Security)
- NFC for digital verification
- QR for visual tamper evidence
- Redundant security layers

### Smart Contract Extensions

```solidity
struct PhysicalTag {
    string tagId;          // NFC tag unique ID
    bytes32 qrHash;        // Hash of QR code data
    bool isTampered;       // True if tamper detected
    uint256 linkedEvidence;
    uint256 taggedAt;
    address taggedBy;
}

mapping(uint256 => PhysicalTag) public physicalTags;

function linkPhysicalEvidence(
    uint256 evidenceId,
    string calldata tagId,
    bytes32 qrHash
) external {
    // Link physical tag to digital evidence
}

function verifyPhysicalTag(
    uint256 evidenceId,
    string calldata scannedTagId
) external view returns (bool) {
    // Verify scanned tag matches on-chain record
}

function reportTamper(
    uint256 evidenceId,
    string calldata reason
) external {
    // Flag evidence as potentially compromised
}
```

### UI Components to Add

```tsx
// PhysicalEvidenceScanner.tsx
<NFCScanner
  onScan={(tagId) => {
    // Verify against contract
    // Show evidence details
    // Log physical handoff
  }}
/>

// TamperEvidenceViewer.tsx
<TamperStatus evidenceId={id} />
// Shows: ✅ Intact | ⚠️ Tamper Reported | ❌ Verified Tampered
```

### Recommended Approach
**Start with QR codes** for hackathon demo (no hardware needed), add NFC for production.

### Files to Add/Modify
- `contracts/SatyaVault.sol` - Add physical tag storage
- `web/components/PhysicalEvidenceScanner.tsx` - NFC/QR scanning UI
- `web/lib/nfc.ts` - NFC tag utilities
- `web/app/api/physical-evidence/route.ts` - Physical evidence API

### Estimated Effort
- QR code only: 4-6 hours
- NFC integration: 1-2 days
- Full production (NTAG 424 DNA): 3-5 days

---

## Summary: Implementation Priority

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| **Client-Side Encryption** | ✅ Done | Medium | 🔒 High (Privacy) |
| **Account Abstraction** | High | Low-Medium | 🎯 High (UX) |
| **Multi-Sig Governance** | Medium | Low | 🔐 High (Security) |
| **Physical-Digital Bridge** | Medium | Medium-High | 📦 High (Completeness) |

---

## Recommended Rollout Plan

### Phase 1: Hackathon Demo (Now)
- ✅ Client-side encryption (smart contract ready)
- Complete encryption UI
- Basic QR code scanning (webcam-based)

### Phase 2: Production Pilot (1-2 months)
- Account Abstraction (Biconomy)
- Multi-Sig Governance (Gnosis Safe)
- QR code tamper stickers

### Phase 3: Full Deployment (3-6 months)
- NFC tag integration
- Advanced encryption features (key rotation)
- Hardware security module (HSM) for key management

---

## Questions or Contributions?

For implementation details or to contribute, contact the SatyaVault team or open an issue on GitHub.

**SatyaVault** - Where forensic truth remains verifiable from seizure to court.
