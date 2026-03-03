# 🏛️ SatyaVault

**Blockchain-Anchored Chain-of-Custody for Digital Forensics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Polygon](https://img.shields.io/badge/Network-Polygon%20Amoy-purple)](https://polygon.technology/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)

> **"If one byte changes, justice can fail."** SatyaVault makes evidence integrity cryptographically verifiable from seizure to courtroom.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Live Demo](#live-demo)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Smart Contract Functions](#smart-contract-functions)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Security](#security)
- [Future Roadmap](#future-roadmap)
- [Documentation](#documentation)
- [License](#license)

---

## 🎯 Overview

SatyaVault is a production-ready GovTech platform for digital forensics and judicial trust. It provides:

- 🔐 **Immutable evidence logging** on Polygon blockchain
- 👥 **Smart contract role-based access control** (Investigator, FSL, Court, Auditor, Admin)
- 📋 **Chain-of-custody tracking** with tamper-proof timeline
- ✅ **Real-time verification** of evidence integrity
- 🔒 **Client-side encryption** (AES-256-GCM) for sensitive evidence

**Problem Solved:** Digital evidence moves across multiple agencies (Police → FSL → Court), but traditional audit logs can be edited by admins. SatyaVault uses blockchain to make evidence custody **immutable, verifiable, and court-admissible**.

---

## ✨ Key Features

### Evidence Management
- ✅ Local SHA-256 hash computation (in browser)
- ✅ IPFS decentralized storage via Pinata
- ✅ On-chain metadata anchoring
- ✅ **NEW: Client-side AES-256 encryption** (zero-knowledge privacy)

### Chain-of-Custody
- ✅ Role-based custody transfers
- ✅ Agency validation (Police → FSL → Court)
- ✅ Immutable event logging
- ✅ Protocol-enforced handoff sequences

### Verification & Audit
- ✅ One-click integrity verification
- ✅ Tamper detection (hash mismatch alerts)
- ✅ Unified custody + investigation timeline
- ✅ QR code verification packets
- ✅ CSV/PDF audit trail exports

### Access Control
- ✅ Smart contract RBAC (5 roles)
- ✅ MetaMask signature authentication
- ✅ Agency-bound permissions
- ✅ Ministry admin oversight

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v20+ (v25 may show Hardhat warnings)
- **npm** package manager
- **MetaMask** browser extension
- **Pinata** account (free tier)
- **Polygon Amoy testnet** tokens (free from faucet)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/SatyaVault.git
cd SatyaVault

# Install root dependencies
npm install

# Install web app dependencies
cd web
npm install
cd ..
```

### 2. Configure Environment

**Root `.env` (for deployment):**
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Polygon Amoy RPC (get from Alchemy/Infura)
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

# Deployer private key (64 hex chars, testnet-only wallet!)
DEPLOYER_PRIVATE_KEY=your_private_key_here

# These get filled after deployment
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
SATYAVAULT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Pinata credentials
PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
```

**Web `.env.local`:**
```bash
cd web
cp .env.example .env.local
```

Edit `web/.env.local`:
```env
# Public RPC for browser
NEXT_PUBLIC_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

# Contract address (filled after deployment)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# App URL
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000

# Pinata
PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/

# QR token secret (generate with: openssl rand -base64 48)
QR_TOKEN_SECRET=your_32_char_secret_here

# Optional: deployment block for faster sync
CHAIN_SYNC_START_BLOCK=0
```

### 3. Get Test Tokens (Polygon Amoy)

**Option 1: Polygon Official Faucet** (24h cooldown)
- Visit: https://faucet.polygon.technology/
- Enter your wallet address
- Request 0.1 POL

**Option 2: Chainlink Faucet** (requires GitHub)
- Visit: https://faucets.chain.link/
- Connect wallet + GitHub
- Request 0.5 POL

**Option 3: Polygon Discord** (no mainnet required)
- Join: https://discord.gg/polygon
- Use `/faucet <your_address>` in faucet channel

> 💡 **Tip:** You need ~0.1 POL for contract deployment + testing.

### 4. Deploy Smart Contract

```bash
# Compile contracts
npx hardhat compile

# Deploy to Polygon Amoy
npm run deploy:amoy
```

**Copy the output:**
```
SatyaVault deployed to: 0xYourContractAddress
Deployment block: 12345678
```

Update your `.env` files with the contract address and block number.

### 5. Bootstrap Roles (Optional but Recommended)

Edit `.env` with test wallet addresses:
```env
INVESTIGATOR_WALLET=0x...
FSL_OFFICER_WALLET=0x...
COURT_OFFICER_WALLET=0x...
AUDITOR_WALLET=0x...
MINISTRY_ADMIN_WALLET=0x...
```

Then run:
```bash
npm run bootstrap:roles
```

### 6. Start Web Application

```bash
cd web
npm run dev
```

Open **http://localhost:3000**

---

## 📖 Detailed Setup

### Step-by-Step First Run

#### 1. Get Pinata JWT

1. Sign up at https://pinata.cloud/
2. Go to API Keys section
3. Create new API key with `pinFileToIPFS` permission
4. Copy the JWT token
5. Paste into `.env` and `web/.env.local`

#### 2. Get Alchemy RPC URL

1. Sign up at https://www.alchemy.com/
2. Create new app → Select **Polygon Amoy**
3. Copy HTTPS RPC URL
4. Paste into `.env` and `web/.env.local`

#### 3. Create Deployer Wallet

**For demo/testing:**
```bash
# Generate random testnet-only private key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ WARNING:** Never use mainnet private keys for testnet deployment!

#### 4. Fund Deployer Wallet

1. Import generated key into MetaMask
2. Add Polygon Amoy network:
   - Network Name: Polygon Amoy
   - RPC URL: Your Alchemy RPC
   - Chain ID: 80002
   - Symbol: POL
   - Explorer: https://amoy.polygonscan.com/
3. Request test POL from faucet (see Quick Start #3)
4. Wait ~30 seconds for faucet transaction

#### 5. Deploy & Verify

```bash
# Deploy
npx hardhat run scripts/deploy.js --network amoy

# Expected output:
# SatyaVault deployed to: 0x...
# Deployment block: ...

# Update .env files with addresses
# Restart web app
```

#### 6. Test the System

1. **Connect Wallet** → Switch to Polygon Amoy
2. **Check Health** → Visit `/api/system/health`
3. **Upload Evidence** → Enable encryption toggle for sensitive files
4. **Transfer Custody** → Test role-based transfers
5. **Verify** → Run integrity check + tamper test
6. **Export** → Generate QR code + PDF audit

---

## 📜 Smart Contract Functions

### Evidence Management

```solidity
// Register new evidence
function registerEvidence(
    bytes32 fileHash,
    string calldata ipfsUri,
    string calldata caseId,
    string calldata investigatorId,
    string calldata initialOrg
) external returns (uint256 newEvidenceId)

// Get evidence metadata
function getEvidence(uint256 evidenceId) 
    external view returns (Evidence memory)

// Verify file hash matches on-chain record
function verifyIntegrity(uint256 evidenceId, bytes32 localHash) 
    external view returns (bool)
```

### Custody Transfer

```solidity
// Transfer evidence to next custodian
function transferCustody(
    uint256 evidenceId,
    address toActor,
    string calldata fromOrg,
    string calldata toOrg,
    string calldata action,
    string calldata notes
) external

// Get full custody timeline
function getCustodyHistory(uint256 evidenceId) 
    external view returns (CustodyEvent[] memory)
```

### Investigation Logging

```solidity
// Record forensic action
function recordInvestigativeAction(
    uint256 evidenceId,
    string calldata actionType,
    string calldata actionNotes,
    string calldata artifactUri
) external returns (bytes32 actionRef)

// Get all investigative actions
function getInvestigationActions(uint256 evidenceId) 
    external view returns (InvestigationAction[] memory)
```

### Access Control

```solidity
// Set actor role profile
function setActorProfile(
    address actor,
    Role role,
    string calldata agency,
    bool active
) external onlyAdmin

// Get actor profile
function getActorProfile(address actor) 
    external view returns (ActorProfile memory)
```

### Encryption (NEW)

```solidity
// Store encryption key for authorized address
function storeEncryptionKey(
    uint256 evidenceId,
    address authorizedAddress,
    string calldata encryptedKey
) external

// Retrieve encryption key (only if authorized)
function getEncryptionKey(uint256 evidenceId, address accessor) 
    external view returns (string memory)

// Check if user has decryption access
function hasEncryptionKeyAccess(uint256 evidenceId, address accessor) 
    external view returns (bool)
```

---

## 🔌 API Reference

### Evidence Endpoints

```
POST   /api/evidence/register-cache
Body: { evidence: {...}, initialEvent: {...} }
Desc:  Cache evidence metadata after on-chain registration

GET    /api/evidence/[id]
Desc:  Retrieve evidence detail with custody timeline

POST   /api/evidence/transfer-cache
Body: { evidenceId, fromOrg, toOrg, ... }
Desc:  Log custody transfer event

POST   /api/evidence/action-cache
Body: { evidenceId, actionType, actionNotes, ... }
Desc:  Record investigative action
```

### System Endpoints

```
GET    /api/system/health
Desc:  System health check (RPC, contract, IPFS status)

GET    /api/system/sync
Desc:  Sync blockchain events to local cache

GET    /api/search?q=case&type=MOBILE_IMAGE&agency=...
Desc:  Full-text search with filters

GET    /api/qr?evidenceId=1&ttl=900
Desc:  Generate QR verification packet

POST   /api/ipfs
Body:  FormData with file
Desc:  Upload file to IPFS via Pinata

GET    /api/actors/cache
Desc:  List cached actor profiles

GET    /api/metrics
Desc:  System metrics (evidence count, avg processing time, etc.)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend (Next.js 14)                  │
│  Dashboard | Upload | Transfer | Verify | Export    │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌─────▼────────┐
│   MetaMask   │ │  IPFS    │ │  SQLite FTS5 │
│   (Wallet)   │ │ (Pinata) │ │   (Search)   │
└──────────────┘ └───────────┘ └──────────────┘
                       │
              ┌────────▼────────┐
              │  Smart Contract │
              │  (Solidity)     │
              │  Polygon Amoy   │
              └─────────────────┘
```

### Component Responsibilities

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 14 + TypeScript | User interface, wallet integration |
| **Smart Contract** | Solidity 0.8.24 | Access control, custody logging, verification |
| **Storage** | IPFS (Pinata) | Decentralized evidence file storage |
| **Search** | SQLite FTS5 | Full-text search across evidence records |
| **Wallet** | MetaMask | Web3 authentication + transaction signing |
| **Blockchain** | Polygon Amoy | Immutable event logging |

---

## 🔒 Security

### Best Practices Implemented

- ✅ **No private keys in frontend** - All keys server-side only
- ✅ **Server-side JWT handling** - Pinata JWT never exposed to browser
- ✅ **Role-based access control** - Enforced by smart contract
- ✅ **Short-lived verification tokens** - QR codes expire after TTL
- ✅ **Client-side encryption** - Files encrypted before upload (optional)
- ✅ **Local hash computation** - Original file never leaves browser unhashed

### Encryption Details

**Algorithm:** AES-256-GCM (military-grade)
**Key Generation:** Browser Crypto API (random 256-bit)
**Key Storage:** Smart contract (role-based access)
**Decryption:** Authorized users retrieve key + decrypt locally

**When to Use:**
- ✅ Sensitive photos (crime scenes, victims)
- ✅ Medical records
- ✅ Confidential documents
- ✅ Undercover operations

---

## 📅 Future Roadmap

### Phase 1: Hackathon MVP (Current)
- [x] Core evidence lifecycle
- [x] Custody transfer workflow
- [x] Verification & audit
- [x] Client-side encryption
- [ ] Deploy to testnet (pending faucet)

### Phase 2: Pilot Ready (1-2 months)
- [ ] Account abstraction (Biconomy gasless UX)
- [ ] Multi-sig governance (Gnosis Safe)
- [ ] Physical evidence tracking (NFC/QR seals)
- [ ] Production database (PostgreSQL)

### Phase 3: Production (3-6 months)
- [ ] e-Courts platform integration
- [ ] State police force pilot
- [ ] Polygon PoS mainnet deployment
- [ ] Mobile app for field officers

**See [`docs/FUTURE_WORK.md`](docs/FUTURE_WORK.md) for detailed implementation plans.**

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`docs/PITCH_DECK.md`](docs/PITCH_DECK.md) | Submission-ready pitch deck |
| [`docs/HACKATHON_USE_CASE_SUBMISSION.md`](docs/HACKATHON_USE_CASE_SUBMISSION.md) | Use case writeup |
| [`docs/FUTURE_WORK.md`](docs/FUTURE_WORK.md) | Future enhancements roadmap |
| [`docs/SIMPLE_WALKTHROUGH.md`](docs/SIMPLE_WALKTHROUGH.md) | Simple encryption guide |

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

**Government Adoption:** This project is open for government use without restrictions.

---

## 📞 Contact

**Built by:** Satvik Mudgal
**Email:** setwetmudgal@gmail.com

**Repository:** https://github.com/yourusername/SatyaVault

---

## 🙏 Acknowledgments

- **Polygon** - Blockchain infrastructure
- **Pinata** - IPFS pinning service
- **Next.js** - React framework
- **Hardhat** - Ethereum development environment
- **Digital India Initiative** - Inspiration

---

*Last Updated: March 2026*
*Version: 2.0 - Hackathon Submission Ready*
