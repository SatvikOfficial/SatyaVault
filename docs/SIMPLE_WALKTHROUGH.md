# SatyaVault - Simple Walkthrough Guide

## 🏛️ What is SatyaVault?

**Digital Evidence Locker + Immutable Logbook on Blockchain**

---

## 🔒 NEW: Client-Side Encryption

### What Problem Does Encryption Solve?

**Without Encryption:**
```
Evidence File → IPFS → Anyone with link can view
```
⚠️ Problem: If IPFS link leaks, sensitive evidence is exposed!

**With Encryption:**
```
Evidence File → Encrypt → IPFS (encrypted) → Only authorized can decrypt
```
✅ Solution: Even if link leaks, evidence is unreadable!

---

### How Encryption Works (Simple Flow)

```
Step 1: Investigator Uploads Sensitive Photo
┌──────────────┐
│  Web Browser │
└──────┬───────┘
       │ 1. Generate random AES-256 key
       │ 2. Encrypt file in browser
       │    (file never leaves computer unencrypted!)
       ▼
┌──────────────┐
│   IPFS       │
│  (Encrypted  │
│   gibberish) │
└──────────────┘

Step 2: Store Key Securely
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │ 3. Store encryption key in smart contract
       │    - Only Investigator can access now
       │    - Can authorize FSL, Court later
       ▼
┌──────────────┐
│  Contract    │
│  (Key vault) │
└──────────────┘

Step 3: FSL Officer Needs to Analyze
┌──────────────┐
│  FSL Officer │
│   Browser    │
└──────┬───────┘
       │ 4. Investigator authorizes FSL address
       │ 5. FSL retrieves key from contract
       │ 6. Decrypts file locally
       ▼
┌──────────────┐
│  Decrypted   │
│  Evidence    │
└──────────────┘
```

---

### Why This is Powerful

| Feature | Without Encryption | With Encryption |
|---------|-------------------|-----------------|
| **IPFS Link Leaks** | ❌ Evidence exposed | ✅ Still encrypted |
| **Unauthorized Access** | ❌ Anyone can view | ✅ Only authorized roles |
| **Court Admissibility** | ⚠️ Can be challenged | ✅ Cryptographically sealed |
| **Privacy** | ❌ Public on IPFS | ✅ Zero-knowledge |

---

## 📋 Complete Flow with Encryption

### Step 1: Evidence Submission (Investigator)

```
┌──────────────┐
│ Investigator │
│   Wallet     │
└──────┬───────┘
       │ 1. Uploads photo
       │ 2. ✅ Checks "Encrypt with AES-256"
       │ 3. File encrypted in browser
       ▼
┌──────────────┐
│   Pinata     │
│    (IPFS)    │
└──────┬───────┘
       │ 4. Stores ENCRYPTED file
       │    Returns: "ipfs://QmEnc123..."
       ▼
┌──────────────┐
│  Contract    │
└──────┬───────┘
       │ 5. Stores:
       │    - Evidence ID: 1
       │    - Hash: "abc123..." (of original)
       │    - IPFS: "ipfs://QmEnc123..." (encrypted)
       │    - Encryption Key: [encrypted for Investigator]
       ▼
✅ Encrypted evidence registered!
```

---

### Step 2: Transfer to FSL (With Key Access)

```
┌──────────────┐
│ Investigator │
└──────┬───────┘
       │ 1. Transfers custody to FSL
       │ 2. ✅ Also authorizes decryption key
       ▼
┌──────────────┐
│  Contract    │
└──────┬───────┘
       │ 3. Updates:
       │    - Custodian: FSL Officer
       │    - Key Access: FSL Officer added
       ▼
✅ FSL can now decrypt!
```

---

### Step 3: FSL Decrypts & Analyzes

```
┌──────────────┐
│  FSL Officer │
└──────┬───────┘
       │ 1. Downloads encrypted file from IPFS
       │ 2. Calls contract: getEncryptionKey()
       │ 3. Decrypts file locally
       │ 4. Analyzes evidence
       ▼
┌──────────────┐
│   Analysis   │
│   Complete   │
└──────────────┘
```

---

## 🎯 Encryption at a Glance

```
┌──────────────────────────────────────────────────────────┐
│  🔐 AES-256-GCM Encryption                               │
├──────────────────────────────────────────────────────────┤
│  • Military-grade encryption                             │
│  • Keys generated in browser (never server)              │
│  • Keys stored in smart contract (role-based access)     │
│  • File decrypted only in authorized user's browser      │
│  • Even IPFS can't see content                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  📋 Who Can Decrypt?                                     │
├──────────────────────────────────────────────────────────┤
│  ✅ Evidence Creator (Investigator)                      │
│  ✅ Current Custodian                                    │
│  ✅ Authorized Roles (FSL, Court)                        │
│  ✅ System Admin                                         │
│  ❌ Everyone Else (including IPFS nodes)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Management

### How Keys Are Protected

```
Key Generation:
  Browser (Crypto API) → Random 256-bit key
                        ↓
Key Storage:
  Encrypt with recipient's public key
  Store in contract
                        ↓
Key Access:
  Authorized user calls getEncryptionKey()
  Contract checks role
  Returns key if authorized
                        ↓
Key Usage:
  Decrypt file locally in browser
  File never stored decrypted on server
```

---

## ✅ When to Use Encryption

**Use Encryption For:**
- ✅ Sensitive photos (crime scenes, victims)
- ✅ Medical records
- ✅ Confidential documents
- ✅ Undercover operations
- ✅ Juvenile cases

**Skip Encryption For:**
- ✅ Public records
- ✅ Already-public documents
- ✅ Non-sensitive evidence

---

## 🚀 Using Encryption (Quick Start)

1. **Upload Evidence**
   - Select file
   - ✅ Check "Encrypt with AES-256"
   - Click "Upload to IPFS"

2. **Register on Chain**
   - Click "Sign & Register"
   - Encryption key automatically stored for you

3. **Authorize Others**
   - When transferring to FSL/Court
   - Key access automatically granted

4. **Decrypt (as recipient)**
   - Download encrypted file
   - Click "Decrypt" (auto-retrieves key)
   - View decrypted evidence

---

**SatyaVault** - Where forensic truth remains verifiable AND private from seizure to court.
