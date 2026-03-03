"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { BrowserProvider, Contract, Interface, JsonRpcProvider } from "ethers";
import {
  FileCheck2,
  FileSearch,
  Fingerprint,
  KeyRound,
  MapPinned,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserCog,
  Wallet
} from "lucide-react";
import clsx from "clsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AgencyMap } from "@/components/agency-map";
import { HealthBadge } from "@/components/health-badge";
import { MobilePreview } from "@/components/mobile-preview";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { Timeline } from "@/components/timeline";
import { AMOY_CHAIN_ID, AMOY_CHAIN_ID_HEX, SATYAVAULT_ABI } from "@/lib/contract";
import { asBytes32Hex, sha256Hex } from "@/lib/hash";
import type {
  ActorProfile,
  CustodyEvent,
  EvidenceRecord,
  EvidenceType,
  EvidenceWithHistory,
  InvestigationAction,
  Role,
  SearchResult
} from "@/lib/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const RPC_URL = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

const ROLE_LABELS: Record<Role, string> = {
  NONE: "Unassigned",
  INVESTIGATOR: "Investigator",
  FSL_OFFICER: "FSL Officer",
  COURT_OFFICER: "Court Officer",
  AUDITOR: "Auditor",
  MINISTRY_ADMIN: "Ministry Admin"
};

const ROLE_TO_CHAIN: Record<Role, number> = {
  NONE: 0,
  INVESTIGATOR: 1,
  FSL_OFFICER: 2,
  COURT_OFFICER: 3,
  AUDITOR: 4,
  MINISTRY_ADMIN: 5
};

const EVIDENCE_TYPES: EvidenceType[] = [
  "MOBILE_IMAGE",
  "FORENSIC_PDF",
  "CHAT_EXPORT",
  "DRIVE_DUMP",
  "EMAIL_ARCHIVE"
];

const ACTION_TYPES = [
  "HASH_VALIDATED",
  "FORENSIC_ANALYSIS_STARTED",
  "FORENSIC_REPORT_ATTACHED",
  "COURT_EXHIBIT_MARKED",
  "ACCESS_REQUEST_APPROVED"
];

const AGENCIES = [
  "Cyber Crime Cell",
  "Forensic Science Laboratory",
  "e-Courts",
  "Digital Evidence Locker",
  "Ministry of Home Affairs",
  "Audit & Compliance Wing"
];

function withTimeout<T>(promise: Promise<T>, timeoutMs = 7000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    })
  ]);
}

function makeTamperedBytes(source: ArrayBuffer): ArrayBuffer {
  const copy = new Uint8Array(source.slice(0));
  if (copy.length > 0) {
    copy[0] = (copy[0] + 1) % 255;
  }
  return copy.buffer;
}

function walletShort(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAddress(address: string): string {
  return String(address || "").toLowerCase();
}

function chainRoleToApp(value: any): Role {
  const numeric = Number(value);
  if (numeric === 1) return "INVESTIGATOR";
  if (numeric === 2) return "FSL_OFFICER";
  if (numeric === 3) return "COURT_OFFICER";
  if (numeric === 4) return "AUDITOR";
  if (numeric === 5) return "MINISTRY_ADMIN";
  return "NONE";
}

function mapChainActorProfile(raw: any, address: string): ActorProfile {
  const updatedAtRaw = raw.updatedAt ?? raw[3];
  const updatedByRaw = raw.updatedBy ?? raw[4];
  return {
    address: normalizeAddress(address),
    role: chainRoleToApp(raw.role ?? raw[0]),
    agency: String(raw.agency ?? raw[1] ?? ""),
    active: Boolean(raw.active ?? raw[2]),
    updatedAt: updatedAtRaw ? new Date(Number(updatedAtRaw) * 1000).toISOString() : undefined,
    updatedBy: updatedByRaw ? normalizeAddress(String(updatedByRaw)) : undefined
  };
}

function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>): void {
  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function mapChainEvidence(raw: any): EvidenceRecord {
  const createdAtSeconds = Number(raw.createdAt ?? raw[5]);
  return {
    evidenceId: Number(raw.evidenceId ?? raw[0]),
    fileHash: String(raw.fileHash ?? raw[1]).replace(/^0x/, ""),
    ipfsUri: String(raw.ipfsUri ?? raw[2]),
    caseId: String(raw.caseId ?? raw[3]),
    investigatorId: String(raw.investigatorId ?? raw[4]),
    createdAt: new Date(createdAtSeconds * 1000).toISOString(),
    createdBy: normalizeAddress(String(raw.createdBy ?? raw[6])),
    currentAgency: "Unknown",
    currentActor: normalizeAddress(String(raw.createdBy ?? raw[6])),
    evidenceType: "CHAT_EXPORT"
  };
}

function mapChainHistory(evidenceId: number, rawRows: any[]): CustodyEvent[] {
  return rawRows.map((row) => ({
    evidenceId,
    fromActor: normalizeAddress(String(row.fromActor ?? row[0])),
    toActor: normalizeAddress(String(row.toActor ?? row[1])),
    fromOrg: String(row.fromOrg ?? row[2]),
    toOrg: String(row.toOrg ?? row[3]),
    action: String(row.action ?? row[4]),
    notes: String(row.notes ?? row[5]),
    occurredAt: new Date(Number(row.timestamp ?? row[6]) * 1000).toISOString(),
    txHash: "",
    logIndex: -1
  }));
}

function mapChainActions(evidenceId: number, rawRows: any[]): InvestigationAction[] {
  return rawRows.map((row) => ({
    evidenceId,
    actor: normalizeAddress(String(row.actor ?? row[0])),
    agency: String(row.agency ?? row[1]),
    actionType: String(row.actionType ?? row[2]),
    actionNotes: String(row.actionNotes ?? row[3]),
    artifactUri: String(row.artifactUri ?? row[4]),
    actionRef: String(row.actionRef ?? row[5]),
    occurredAt: new Date(Number(row.timestamp ?? row[6]) * 1000).toISOString(),
    txHash: "",
    logIndex: -1
  }));
}

interface SetupChecks {
  hasRpcUrl: boolean;
  hasContractAddress: boolean;
  hasPinataJwt: boolean;
  hasQrSecret: boolean;
  rpcReachable: boolean;
  contractReachable: boolean;
  latestBlock: number | null;
}

export function SatyaVaultDashboard() {
  const [walletAddress, setWalletAddress] = useState("");
  const [browserProvider, setBrowserProvider] = useState<BrowserProvider | null>(null);
  const [actorProfile, setActorProfile] = useState<ActorProfile | null>(null);
  const [knownProfiles, setKnownProfiles] = useState<ActorProfile[]>([]);

  const [liveMode, setLiveMode] = useState<"LIVE" | "CACHED">("LIVE");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("System ready.");

  const [setupChecks, setSetupChecks] = useState<SetupChecks>({
    hasRpcUrl: false,
    hasContractAddress: false,
    hasPinataJwt: false,
    hasQrSecret: false,
    rpcReachable: false,
    contractReachable: false,
    latestBlock: null
  });

  const [q, setQ] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EvidenceWithHistory | null>(null);

  const [metrics, setMetrics] = useState<{
    totalEvidence: number;
    totalActions: number;
    activeActors: number;
    avgProcessingHours: number;
    agencyBreakdown: Array<{ agency: string; count: number }>;
  }>({ totalEvidence: 0, totalActions: 0, activeActors: 0, avgProcessingHours: 0, agencyBreakdown: [] });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadHash, setUploadHash] = useState("");
  const [uploadedIpfsUri, setUploadedIpfsUri] = useState("");
  const [uploadedGatewayUrl, setUploadedGatewayUrl] = useState("");
  const [submitCaseId, setSubmitCaseId] = useState("IN-CCC-2026-001");
  const [submitInvestigatorId, setSubmitInvestigatorId] = useState("INV-SATYA-17");
  const [submitType, setSubmitType] = useState<EvidenceType>("MOBILE_IMAGE");
  const [submitAgency, setSubmitAgency] = useState("Cyber Crime Cell");
  const [useEncryption, setUseEncryption] = useState(false); // NEW: Encryption toggle
  const [encryptionKey, setEncryptionKey] = useState(""); // NEW: Store encryption key
  const [isEncrypted, setIsEncrypted] = useState(false); // NEW: Track if evidence is encrypted

  const [toActor, setToActor] = useState("0x000000000000000000000000000000000000dEaD");
  const [fromOrg, setFromOrg] = useState("Cyber Crime Cell");
  const [toOrg, setToOrg] = useState("Forensic Science Laboratory");
  const [transferAction, setTransferAction] = useState("SEALED_AND_SENT");
  const [transferNotes, setTransferNotes] = useState("Sealed packet transferred with signature log.");

  const [actionType, setActionType] = useState("HASH_VALIDATED");
  const [actionNotes, setActionNotes] = useState("Hash and seal number validated against intake memo.");
  const [actionArtifactUri, setActionArtifactUri] = useState("");

  const [adminActorAddress, setAdminActorAddress] = useState("");
  const [adminRole, setAdminRole] = useState<Role>("INVESTIGATOR");
  const [adminAgency, setAdminAgency] = useState("Cyber Crime Cell");
  const [adminActive, setAdminActive] = useState(true);

  const [verifyEvidenceId, setVerifyEvidenceId] = useState(0);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [hashMatched, setHashMatched] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState("");

  const readContract = useMemo(() => {
    if (!CONTRACT_ADDRESS) return null;
    const provider = new JsonRpcProvider(RPC_URL);
    return new Contract(CONTRACT_ADDRESS, SATYAVAULT_ABI, provider);
  }, []);

  const currentRole = actorProfile?.role || "NONE";
  const currentAgency = actorProfile?.agency || "Unassigned";
  const currentRoleLabel = ROLE_LABELS[currentRole];

  const isAdmin = actorProfile?.active && currentRole === "MINISTRY_ADMIN";
  const canSubmit = actorProfile?.active && (currentRole === "INVESTIGATOR" || currentRole === "MINISTRY_ADMIN");
  const canTransfer =
    actorProfile?.active &&
    ["INVESTIGATOR", "FSL_OFFICER", "COURT_OFFICER", "MINISTRY_ADMIN"].includes(currentRole);
  const canLogAction = canTransfer;

  const setupReady =
    setupChecks.hasRpcUrl &&
    setupChecks.hasContractAddress &&
    setupChecks.hasPinataJwt &&
    setupChecks.hasQrSecret &&
    setupChecks.rpcReachable &&
    setupChecks.contractReachable;

  const refreshActorProfile = useCallback(
    async (address: string) => {
      if (!readContract || !address) {
        setActorProfile(null);
        return;
      }

      try {
        const raw = await withTimeout(readContract.getActorProfile(address), 7000);
        const profile = mapChainActorProfile(raw, address);
        setActorProfile(profile);

        // Keep server cache warm for ministry dashboard/API views.
        await fetch("/api/actors/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile })
        });
      } catch {
        setActorProfile({
          address: normalizeAddress(address),
          role: "NONE",
          agency: "",
          active: false
        });
      }
    },
    [readContract]
  );

  const loadActorCache = useCallback(async () => {
    const response = await fetch("/api/actors/cache");
    const payload = await response.json();
    if (payload.ok) {
      setKnownProfiles(payload.profiles);
    }
  }, []);

  const loadSystemHealth = useCallback(async () => {
    const response = await fetch("/api/system/health");
    const payload = await response.json();
    if (payload.ok) {
      setSetupChecks(payload.checks);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/system/sync", { method: "POST" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error || "Sync failed");
      }
      setStatus("Data synchronized from blockchain.");
    } catch (error) {
      setStatus(`Sync failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    const response = await fetch("/api/metrics");
    const payload = await response.json();
    if (payload.ok) {
      setMetrics(payload.metrics);
    }
  }, []);

  const loadSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (agencyFilter) params.set("agency", agencyFilter);
    if (typeFilter) params.set("evidenceType", typeFilter);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);

    const response = await fetch(`/api/search?${params.toString()}`);
    const payload = await response.json();

    if (payload.ok) {
      setSearchResults(payload.results);
      if (!selectedEvidenceId && payload.results.length > 0) {
        const firstId = payload.results[0].evidenceId;
        setSelectedEvidenceId(firstId);
        setVerifyEvidenceId(firstId);
      }
    }
  }, [q, agencyFilter, typeFilter, fromDate, toDate, selectedEvidenceId]);

  const loadEvidenceDetail = useCallback(
    async (evidenceId: number) => {
      if (!evidenceId) return;

      setBusy(true);
      setStatus(`Loading evidence ${evidenceId}...`);

      if (readContract) {
        try {
          const [onChainEvidence, onChainHistory, onChainActions] = await withTimeout(
            Promise.all([
              readContract.getEvidence(evidenceId),
              readContract.getCustodyHistory(evidenceId),
              readContract.getInvestigationActions(evidenceId)
            ]),
            7000
          );

          const mappedEvidence = mapChainEvidence(onChainEvidence);
          const mappedHistory = mapChainHistory(mappedEvidence.evidenceId, onChainHistory as any[]);
          const mappedActions = mapChainActions(mappedEvidence.evidenceId, onChainActions as any[]);

          const cachedResponse = await fetch(`/api/evidence/${evidenceId}`);
          if (cachedResponse.ok) {
            const cachedPayload = await cachedResponse.json();
            if (cachedPayload?.evidence) {
              mappedEvidence.currentAgency = cachedPayload.evidence.currentAgency;
              mappedEvidence.evidenceType = cachedPayload.evidence.evidenceType;
            }
          }

          setDetail({ evidence: mappedEvidence, history: mappedHistory, actions: mappedActions });
          setLiveMode("LIVE");
          setStatus("Live mode: reading from Polygon Amoy.");
          setBusy(false);
          return;
        } catch {
          // Continue to cached fallback.
        }
      }

      try {
        const cachedResponse = await fetch(`/api/evidence/${evidenceId}`);
        const payload = await cachedResponse.json();

        if (!payload.ok) {
          throw new Error(payload.error || "No data available for this evidence ID");
        }

        setDetail({ evidence: payload.evidence, history: payload.history, actions: payload.actions || [] });
        setLiveMode("CACHED");
        setStatus("Cached mode: using synchronized local database.");
      } catch (error) {
        setStatus(`Failed to load evidence: ${String(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [readContract]
  );

  useEffect(() => {
    loadSystemHealth().catch((error) => setStatus(`Health check failed: ${String(error)}`));
    loadSearch().catch((error) => setStatus(`Search load failed: ${String(error)}`));
    loadMetrics().catch((error) => setStatus(`Metrics load failed: ${String(error)}`));
    loadActorCache().catch((error) => setStatus(`Actor cache load failed: ${String(error)}`));
  }, [loadSystemHealth, loadSearch, loadMetrics, loadActorCache]);

  useEffect(() => {
    if (selectedEvidenceId) {
      loadEvidenceDetail(selectedEvidenceId).catch((error) => {
        setStatus(`Failed loading evidence detail: ${String(error)}`);
      });
    }
  }, [selectedEvidenceId, loadEvidenceDetail]);

  useEffect(() => {
    // Keep agency fields aligned with the wallet profile when the actor is not ministry admin.
    if (actorProfile?.active && actorProfile.role !== "MINISTRY_ADMIN" && actorProfile.agency) {
      setSubmitAgency(actorProfile.agency);
      setFromOrg(actorProfile.agency);
    }
  }, [actorProfile]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on || !eth?.removeListener) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWalletAddress("");
        setBrowserProvider(null);
        setActorProfile(null);
        setStatus("Wallet disconnected.");
        return;
      }

      const next = normalizeAddress(accounts[0]);
      setWalletAddress(next);
      refreshActorProfile(next).catch(() => undefined);
    };

    eth.on("accountsChanged", handleAccountsChanged);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [refreshActorProfile]);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not detected in browser.");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== AMOY_CHAIN_ID) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: AMOY_CHAIN_ID_HEX }]
        });
      }

      const signer = await provider.getSigner();
      const address = normalizeAddress(await signer.getAddress());
      setBrowserProvider(provider);
      setWalletAddress(address);
      await refreshActorProfile(address);
      setStatus(`Wallet connected: ${walletShort(address)} | Access profile loaded.`);
    } catch (error) {
      setStatus(`Wallet connection failed: ${String(error)}`);
    }
  };

  const handleFileChange = async (file: File | null) => {
    setUploadFile(file);
    setUploadedIpfsUri("");
    setUploadedGatewayUrl("");

    if (!file) {
      setUploadHash("");
      return;
    }

    const buffer = await file.arrayBuffer();
    const digest = await sha256Hex(buffer);
    setUploadHash(digest);
  };

  const uploadToIpfs = async () => {
    if (!uploadFile) {
      setStatus("Choose a file before IPFS upload.");
      return;
    }

    setBusy(true);
    
    try {
      let fileToUpload = uploadFile;
      let finalHash = uploadHash;

      // NEW: Handle encryption if enabled
      if (useEncryption) {
        setStatus("Encrypting file with AES-256-GCM...");
        const { encryptFile } = await import("@/lib/encryption");
        const { encryptedData, iv, key } = await encryptFile(uploadFile);
        
        setEncryptionKey(key);
        setIsEncrypted(true);
        
        // Create encrypted file blob
        fileToUpload = new File(
          [encryptedData],
          uploadFile.name + ".enc",
          { type: "application/octet-stream" }
        );
        
        // Store IV in a way we can retrieve later
        (fileToUpload as any).encryptionIV = iv;
        
        setStatus("File encrypted. Uploading to IPFS...");
      } else {
        setStatus("Uploading file to IPFS...");
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);

      const response = await fetch("/api/ipfs", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "IPFS upload failed");
      }

      setUploadedIpfsUri(payload.ipfsUri);
      setUploadedGatewayUrl(payload.gatewayUrl);
      
      if (useEncryption) {
        setStatus("🔒 Encrypted IPFS upload complete. Ready for blockchain registration.");
      } else {
        setStatus("IPFS upload complete. Ready for blockchain registration.");
      }
    } catch (error) {
      setStatus(`IPFS upload error: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const registerEvidenceOnChain = async () => {
    if (!browserProvider || !walletAddress) {
      setStatus("Connect wallet before evidence submission.");
      return;
    }
    if (!uploadHash || !uploadedIpfsUri) {
      setStatus("Hash and IPFS URI are required before on-chain submit.");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setStatus("Missing NEXT_PUBLIC_CONTRACT_ADDRESS in environment.");
      return;
    }

    if (!canSubmit) {
      setStatus("Current wallet role is not authorized for evidence intake.");
      return;
    }

    setBusy(true);
    setStatus("Awaiting MetaMask signature for evidence submission...");

    try {
      const signer = await browserProvider.getSigner();
      const writeContract = new Contract(CONTRACT_ADDRESS, SATYAVAULT_ABI, signer);

      const tx = await writeContract.registerEvidence(
        asBytes32Hex(uploadHash),
        uploadedIpfsUri,
        submitCaseId,
        submitInvestigatorId,
        submitAgency
      );

      const receipt = await tx.wait();
      const iface = new Interface(SATYAVAULT_ABI as any);
      let evidenceId = 0;
      let custodyLogIndex = -1;

      for (const log of receipt.logs as any[]) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "EvidenceRegistered") {
            evidenceId = Number(parsed.args.evidenceId);
          }
          if (parsed?.name === "CustodyTransferred") {
            custodyLogIndex = Number(log.index ?? log.logIndex ?? -1);
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      if (!evidenceId) {
        throw new Error("Could not parse evidence ID from blockchain receipt.");
      }

      const block = await browserProvider.getBlock(receipt.blockNumber);
      const occurredAt = block
        ? new Date(Number(block.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      await fetch("/api/evidence/register-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence: {
            evidenceId,
            caseId: submitCaseId,
            investigatorId: submitInvestigatorId,
            evidenceType: submitType,
            ipfsUri: uploadedIpfsUri,
            fileHash: uploadHash,
            createdAt: occurredAt,
            createdBy: normalizeAddress(walletAddress),
            currentAgency: submitAgency,
            currentActor: normalizeAddress(walletAddress)
          },
          initialEvent: {
            evidenceId,
            fromOrg: "Origin",
            toOrg: submitAgency,
            fromActor: "0x0000000000000000000000000000000000000000",
            toActor: normalizeAddress(walletAddress),
            action: "EVIDENCE_SUBMITTED",
            notes: `Uploaded ${submitType} into SatyaVault`,
            occurredAt,
            txHash: receipt.hash,
            logIndex: custodyLogIndex
          }
        })
      });

      setStatus(`Evidence #${evidenceId} registered successfully.`);
      
      // NEW: Store encryption key if encryption was used
      if (useEncryption && encryptionKey) {
        try {
          setStatus("Storing encryption key in contract...");
          
          // Authorize current custodian and admin to decrypt
          const authorizedAddresses = [
            walletAddress, // Current custodian
            walletAddress // In production, add FSL/Court addresses
          ];
          
          for (const addr of authorizedAddresses) {
            const storeTx = await writeContract.storeEncryptionKey(
              evidenceId,
              addr,
              encryptionKey
            );
            await storeTx.wait();
          }
          
          setStatus("🔒 Encryption key stored. Authorized users can decrypt.");
        } catch (encError) {
          console.error("Failed to store encryption key:", encError);
          setStatus("Evidence registered, but encryption key storage failed.");
        }
      }
      
      setSelectedEvidenceId(evidenceId);
      setVerifyEvidenceId(evidenceId);
      await loadSearch();
      await loadMetrics();
      await loadEvidenceDetail(evidenceId);
    } catch (error) {
      setStatus(`Blockchain submit failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const transferCustodyOnChain = async () => {
    if (!selectedEvidenceId) {
      setStatus("Select an evidence record before transfer.");
      return;
    }
    if (!browserProvider || !walletAddress || !CONTRACT_ADDRESS) {
      setStatus("Connect wallet and ensure contract address is set.");
      return;
    }

    if (!canTransfer) {
      setStatus("Current wallet role is not authorized for custody transfer.");
      return;
    }

    setBusy(true);
    setStatus("Awaiting MetaMask signature for custody transfer...");

    try {
      const signer = await browserProvider.getSigner();
      const writeContract = new Contract(CONTRACT_ADDRESS, SATYAVAULT_ABI, signer);

      const tx = await writeContract.transferCustody(
        selectedEvidenceId,
        toActor,
        fromOrg,
        toOrg,
        transferAction,
        transferNotes
      );

      const receipt = await tx.wait();
      const block = await browserProvider.getBlock(receipt.blockNumber);
      const occurredAt = block
        ? new Date(Number(block.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      const iface = new Interface(SATYAVAULT_ABI as any);
      let transferLogIndex = -1;
      for (const log of receipt.logs as any[]) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "CustodyTransferred") {
            transferLogIndex = Number(log.index ?? log.logIndex ?? -1);
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      await fetch("/api/evidence/transfer-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            evidenceId: selectedEvidenceId,
            fromOrg,
            toOrg,
            fromActor: normalizeAddress(walletAddress),
            toActor: normalizeAddress(toActor),
            action: transferAction,
            notes: transferNotes,
            occurredAt,
            txHash: receipt.hash,
            logIndex: transferLogIndex
          }
        })
      });

      setStatus(`Custody transfer recorded for evidence #${selectedEvidenceId}.`);
      await loadEvidenceDetail(selectedEvidenceId);
      await loadSearch();
      await loadMetrics();
    } catch (error) {
      setStatus(`Transfer failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const recordInvestigativeActionOnChain = async () => {
    if (!selectedEvidenceId) {
      setStatus("Select an evidence record before logging an investigative action.");
      return;
    }
    if (!browserProvider || !walletAddress || !CONTRACT_ADDRESS) {
      setStatus("Connect wallet and ensure contract address is set.");
      return;
    }
    if (!canLogAction) {
      setStatus("Current wallet role is not authorized for investigative action logging.");
      return;
    }

    setBusy(true);
    setStatus("Awaiting MetaMask signature for investigative action...");

    try {
      const signer = await browserProvider.getSigner();
      const writeContract = new Contract(CONTRACT_ADDRESS, SATYAVAULT_ABI, signer);

      const tx = await writeContract.recordInvestigativeAction(
        selectedEvidenceId,
        actionType,
        actionNotes,
        actionArtifactUri
      );

      const receipt = await tx.wait();
      const block = await browserProvider.getBlock(receipt.blockNumber);
      const occurredAt = block
        ? new Date(Number(block.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      const iface = new Interface(SATYAVAULT_ABI as any);
      let actionRef = "";
      let actionLogIndex = -1;

      for (const log of receipt.logs as any[]) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "InvestigationActionLogged") {
            actionRef = String(parsed.args.actionRef);
            actionLogIndex = Number(log.index ?? log.logIndex ?? -1);
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      await fetch("/api/evidence/action-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            evidenceId: selectedEvidenceId,
            actor: normalizeAddress(walletAddress),
            agency: currentAgency,
            actionType,
            actionNotes,
            artifactUri: actionArtifactUri,
            actionRef,
            occurredAt,
            txHash: receipt.hash,
            logIndex: actionLogIndex
          }
        })
      });

      setStatus(`Investigative action logged for evidence #${selectedEvidenceId}.`);
      await loadEvidenceDetail(selectedEvidenceId);
      await loadSearch();
      await loadMetrics();
    } catch (error) {
      setStatus(`Action logging failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveActorProfileOnChain = async () => {
    if (!isAdmin) {
      setStatus("Only Ministry Admin role can manage actor access profiles.");
      return;
    }
    if (!browserProvider || !CONTRACT_ADDRESS) {
      setStatus("Connect wallet before managing access profiles.");
      return;
    }
    if (!adminActorAddress) {
      setStatus("Enter actor wallet address.");
      return;
    }
    if (adminRole !== "MINISTRY_ADMIN" && !adminAgency) {
      setStatus("Agency is required for non-ministry roles.");
      return;
    }

    setBusy(true);
    setStatus("Awaiting MetaMask signature for role update...");

    try {
      const signer = await browserProvider.getSigner();
      const writeContract = new Contract(CONTRACT_ADDRESS, SATYAVAULT_ABI, signer);
      const cleanAddress = normalizeAddress(adminActorAddress);

      const tx = await writeContract.setActorProfile(
        cleanAddress,
        ROLE_TO_CHAIN[adminRole],
        adminAgency,
        adminActive
      );
      await tx.wait();

      if (!readContract) {
        throw new Error("Read contract unavailable after profile write.");
      }

      const raw = await readContract.getActorProfile(cleanAddress);
      const profile = mapChainActorProfile(raw, cleanAddress);

      await fetch("/api/actors/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile })
      });

      await loadActorCache();

      if (walletAddress && normalizeAddress(walletAddress) === cleanAddress) {
        await refreshActorProfile(cleanAddress);
      }

      setStatus(`Access profile updated for ${walletShort(cleanAddress)}.`);
    } catch (error) {
      setStatus(`Role update failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const runVerification = async (file: File, tamperMode: boolean) => {
    if (!verifyEvidenceId) {
      setStatus("Enter an evidence ID for verification.");
      return;
    }

    const source = await file.arrayBuffer();
    const bytes = tamperMode ? makeTamperedBytes(source) : source;
    const digest = await sha256Hex(bytes);

    try {
      if (readContract) {
        const result = (await withTimeout(
          readContract.verifyIntegrity(verifyEvidenceId, asBytes32Hex(digest)),
          7000
        )) as boolean;

        setHashMatched(result);
        setVerifyMessage(
          result
            ? tamperMode
              ? "Unexpected match in tamper mode."
              : "Integrity confirmed: hash matches on-chain."
            : tamperMode
              ? "Tamper detected: modified file does not match on-chain hash."
              : "Hash mismatch detected for uploaded file."
        );
        setLiveMode("LIVE");
        return;
      }
    } catch {
      // Continue with fallback.
    }

    const cachedResponse = await fetch(`/api/evidence/${verifyEvidenceId}`);
    const payload = await cachedResponse.json();

    if (!payload.ok || !payload?.evidence?.fileHash) {
      setVerifyMessage("Verification failed: no blockchain or cache data available.");
      return;
    }

    const matched = String(payload.evidence.fileHash).toLowerCase() === digest.toLowerCase();
    setHashMatched(matched);
    setVerifyMessage(
      matched
        ? "Integrity confirmed from synchronized cache."
        : "Tamper or mismatch detected from synchronized cache."
    );
    setLiveMode("CACHED");
  };

  const generateQrPacket = async () => {
    const id = selectedEvidenceId || verifyEvidenceId;
    if (!id) {
      setStatus("Select evidence before generating QR packet.");
      return;
    }

    try {
      const response = await fetch(`/api/qr?evidenceId=${id}&ttl=900`);
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error || "QR generation failed");
      }

      setQrDataUrl(payload.qrDataUrl);
      setVerifyUrl(payload.verifyUrl);
      setQrExpiresAt(payload.expiresAt);
      setStatus("QR verification packet generated.");
    } catch (error) {
      setStatus(`QR generation error: ${String(error)}`);
    }
  };

  const exportTimelinePdf = () => {
    if (!detail) return;

    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text(`SatyaVault Audit Trail | Evidence #${detail.evidence.evidenceId}`, 14, 18);
    pdf.setFontSize(10);
    pdf.text(`Case: ${detail.evidence.caseId}`, 14, 26);
    pdf.text(`Investigator: ${detail.evidence.investigatorId}`, 14, 32);

    const rows = [
      ...detail.history.map((event) => ({
        occurredAt: event.occurredAt,
        type: "CUSTODY",
        time: format(new Date(event.occurredAt), "dd MMM yyyy HH:mm"),
        actor: event.toActor,
        event: event.action,
        notes: event.notes
      })),
      ...detail.actions.map((action) => ({
        occurredAt: action.occurredAt,
        type: "ACTION",
        time: format(new Date(action.occurredAt), "dd MMM yyyy HH:mm"),
        actor: action.actor,
        event: action.actionType,
        notes: action.actionNotes
      }))
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    autoTable(pdf, {
      startY: 40,
      head: [["Type", "Time", "Actor", "Event", "Notes"]],
      body: rows.map((row) => [row.type, row.time, row.actor, row.event, row.notes])
    });

    pdf.save(`satyavault-evidence-${detail.evidence.evidenceId}.pdf`);
  };

  const exportTimelineCsv = () => {
    if (!detail) return;

    const rows = [
      ...detail.history.map((event) => ({
        occurredAt: event.occurredAt,
        type: "CUSTODY",
        time: format(new Date(event.occurredAt), "yyyy-MM-dd HH:mm:ss"),
        actor: event.toActor,
        event: event.action,
        notes: event.notes,
        reference: event.txHash || ""
      })),
      ...detail.actions.map((action) => ({
        occurredAt: action.occurredAt,
        type: "ACTION",
        time: format(new Date(action.occurredAt), "yyyy-MM-dd HH:mm:ss"),
        actor: action.actor,
        event: action.actionType,
        notes: action.actionNotes,
        reference: action.actionRef
      }))
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    downloadCsv(
      `satyavault-evidence-${detail.evidence.evidenceId}.csv`,
      ["type", "time", "actor", "event", "notes", "reference"],
      rows.map((row) => [row.type, row.time, row.actor, row.event, row.notes, row.reference])
    );
  };

  return (
    <main className="min-h-screen px-4 py-5 md:px-8">
      <section className="gov-card rounded-2xl border border-white/70 p-5 shadow-gov" data-tour-id="connect-wallet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Digital Forensics Platform</p>
            <h1 className="font-heading text-3xl font-bold text-base md:text-4xl">SatyaVault Operations Console</h1>
            <p className="mt-1 text-sm text-slate-600">
              Immutable evidence lifecycle across Cyber Crime Cell, Forensic Science Laboratory, and e-Courts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OnboardingTutorial />
            <button
              onClick={connectWallet}
              className="inline-flex items-center gap-2 rounded-xl bg-base px-4 py-2 text-sm font-semibold text-white"
            >
              <Wallet size={16} />
              {walletAddress ? walletShort(walletAddress) : "Connect MetaMask"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
            <KeyRound size={12} />
            Role: {currentRoleLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
            <Fingerprint size={12} />
            Agency: {currentAgency || "Unassigned"}
          </span>

          <button
            onClick={() => {
              syncNow().then(() => {
                loadSearch().catch(() => undefined);
                loadMetrics().catch(() => undefined);
                loadSystemHealth().catch(() => undefined);
                loadActorCache().catch(() => undefined);
              });
            }}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Sync Blockchain Data
          </button>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total Evidence</p>
          <p className="mt-2 font-heading text-3xl font-bold">{metrics.totalEvidence}</p>
        </div>

        <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Investigative Actions</p>
          <p className="mt-2 font-heading text-3xl font-bold">{metrics.totalActions}</p>
        </div>

        <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Actors</p>
          <p className="mt-2 font-heading text-3xl font-bold">{metrics.activeActors}</p>
        </div>

        <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg Processing Time</p>
          <p className="mt-2 font-heading text-3xl font-bold">{metrics.avgProcessingHours}h</p>
        </div>

        <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="system-setup">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">System Setup</p>
          <p className={clsx("mt-2 text-sm font-semibold", setupReady ? "text-green-700" : "text-amber-700")}>
            {setupReady ? "Deployment Ready" : "Configuration Required"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Read mode: {liveMode === "LIVE" ? "Live RPC" : "Synchronized Cache"} | Latest block: {setupChecks.latestBlock ?? "N/A"}
          </p>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.02fr]">
        <div className="space-y-4">
          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="role-admin">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold text-base">Smart-Contract Access Control</h2>
              <UserCog size={18} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-600">
              Wallet role is read directly from the contract. All evidence operations are enforced on-chain.
            </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-semibold text-slate-900">Current Actor</p>
              <p className="mt-1 text-slate-600">Wallet: {walletAddress || "Not connected"}</p>
              <p className="text-slate-600">Role: {currentRoleLabel}</p>
              <p className="text-slate-600">Agency: {currentAgency || "Unassigned"}</p>
              <p className={clsx("mt-1 font-medium", actorProfile?.active ? "text-green-700" : "text-amber-700")}>
                {actorProfile?.active ? "Active profile" : "Inactive or missing profile"}
              </p>
              {walletAddress && (!actorProfile || !actorProfile.active || actorProfile.role === "NONE") ? (
                <p className="mt-1 text-xs text-slate-500">
                  Ask a Ministry Admin to provision your wallet role on-chain before using evidence workflows.
                </p>
              ) : null}
            </div>

            {isAdmin ? (
              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Manage Actor Profile (Admin Only)</p>
                <input
                  value={adminActorAddress}
                  onChange={(event) => setAdminActorAddress(event.target.value)}
                  placeholder="0x actor wallet address"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={adminRole}
                    onChange={(event) => setAdminRole(event.target.value as Role)}
                    className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
                  >
                    <option value="INVESTIGATOR">INVESTIGATOR</option>
                    <option value="FSL_OFFICER">FSL_OFFICER</option>
                    <option value="COURT_OFFICER">COURT_OFFICER</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="MINISTRY_ADMIN">MINISTRY_ADMIN</option>
                    <option value="NONE">NONE (Disable)</option>
                  </select>
                  <select
                    value={adminAgency}
                    onChange={(event) => setAdminAgency(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
                  >
                    {AGENCIES.map((agency) => (
                      <option key={agency}>{agency}</option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={adminActive}
                    onChange={(event) => setAdminActive(event.target.checked)}
                  />
                  Active profile
                </label>
                <button
                  disabled={busy}
                  onClick={saveActorProfileOnChain}
                  className="rounded-xl bg-base px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save On-Chain Profile
                </button>
              </div>
            ) : null}

            <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-xs">
              <p className="mb-2 font-semibold text-slate-700">Known Actor Profiles</p>
              {knownProfiles.length === 0 ? (
                <p className="text-slate-500">No cached actor profiles yet. Run sync or update a profile.</p>
              ) : (
                knownProfiles.slice(0, 20).map((profile) => (
                  <div key={`${profile.address}-${profile.updatedAt || ""}`} className="border-b border-slate-100 py-1 last:border-0">
                    <p className="font-medium text-slate-800">{profile.address}</p>
                    <p className="text-slate-600">
                      {profile.role} | {profile.agency || "N/A"} | {profile.active ? "ACTIVE" : "INACTIVE"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="evidence-intake">
            <h2 className="font-heading text-xl font-bold text-base">Evidence Intake</h2>
            <p className="text-sm text-slate-600">Upload, hash locally, pin to IPFS, then anchor metadata on Polygon Amoy.</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <select
                value={submitType}
                onChange={(event) => setSubmitType(event.target.value as EvidenceType)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                {EVIDENCE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                value={submitCaseId}
                onChange={(event) => setSubmitCaseId(event.target.value)}
                placeholder="Case ID"
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <input
                value={submitInvestigatorId}
                onChange={(event) => setSubmitInvestigatorId(event.target.value)}
                placeholder="Investigator ID"
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
            </div>

            <select
              value={submitAgency}
              onChange={(event) => setSubmitAgency(event.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
              disabled={currentRole !== "MINISTRY_ADMIN" && currentRole !== "NONE"}
            >
              {AGENCIES.map((agency) => (
                <option key={agency} value={agency}>
                  {agency}
                </option>
              ))}
            </select>

            {/* NEW: Encryption Toggle */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="encryption-toggle"
                  checked={useEncryption}
                  onChange={(e) => setUseEncryption(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-base focus:ring-base"
                />
                <label htmlFor="encryption-toggle" className="text-sm font-medium text-slate-700">
                  🔒 Encrypt with AES-256
                </label>
              </div>
              <span className="text-xs text-slate-500">
                {useEncryption ? "Enabled" : "Optional"}
              </span>
            </div>
            {useEncryption && (
              <div className="mt-2 rounded-xl border border-base/30 bg-base/10 p-3 text-xs text-slate-700">
                <p className="font-semibold">🔐 Zero-Knowledge Encryption</p>
                <p className="mt-1">
                  File will be encrypted locally before upload. Only authorized roles can decrypt.
                </p>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Local SHA-256</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{uploadHash || "Upload a file to compute hash"}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy || !uploadFile || !canSubmit}
                onClick={uploadToIpfs}
                className="rounded-xl bg-police px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Upload to IPFS
              </button>
              <button
                disabled={busy || !uploadedIpfsUri || !canSubmit}
                onClick={registerEvidenceOnChain}
                className="rounded-xl bg-base px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Sign & Register
              </button>
            </div>

            {!canSubmit ? (
              <p className="mt-2 text-xs text-amber-700">
                Current role cannot submit evidence. Use Investigator or Ministry Admin wallet.
              </p>
            ) : null}

            {uploadedIpfsUri ? (
              <div className="mt-3 rounded-xl border border-green/30 bg-green/10 p-3 text-sm text-slate-700">
                <p>IPFS URI: {uploadedIpfsUri}</p>
                <p className="mt-1 break-all">Gateway: {uploadedGatewayUrl}</p>
              </div>
            ) : null}
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="custody-transfer">
            <h2 className="font-heading text-xl font-bold text-base">Custody Transfer</h2>
            <p className="text-sm text-slate-600">Current custodian signs each handoff for legal traceability.</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={fromOrg}
                onChange={(event) => setFromOrg(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
                disabled={currentRole !== "MINISTRY_ADMIN" && currentRole !== "NONE"}
              >
                {AGENCIES.map((agency) => (
                  <option key={agency}>{agency}</option>
                ))}
              </select>
              <select
                value={toOrg}
                onChange={(event) => setToOrg(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                {AGENCIES.map((agency) => (
                  <option key={agency}>{agency}</option>
                ))}
              </select>
              <input
                value={toActor}
                onChange={(event) => setToActor(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
                placeholder="Destination wallet address"
              />
              <select
                value={transferAction}
                onChange={(event) => setTransferAction(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                <option value="SEALED_AND_SENT">SEALED_AND_SENT</option>
                <option value="LAB_RECEIVED">LAB_RECEIVED</option>
                <option value="SUBMITTED_TO_COURT">SUBMITTED_TO_COURT</option>
                <option value="COURT_REMAND_TO_FSL">COURT_REMAND_TO_FSL</option>
              </select>
            </div>

            <textarea
              value={transferNotes}
              onChange={(event) => setTransferNotes(event.target.value)}
              rows={2}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
            />

            <button
              disabled={busy || !selectedEvidenceId || !canTransfer}
              onClick={transferCustodyOnChain}
              className="mt-3 rounded-xl bg-fsl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sign Transfer
            </button>

            {!canTransfer ? (
              <p className="mt-2 text-xs text-amber-700">
                Current role cannot transfer custody. Activate Investigator/FSL/Court/Admin profile.
              </p>
            ) : null}
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="action-log">
            <h2 className="font-heading text-xl font-bold text-base">Investigative Action Log</h2>
            <p className="text-sm text-slate-600">
              Log forensic actions on-chain for real-time verification of investigative procedures.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                {ACTION_TYPES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <input
                value={actionArtifactUri}
                onChange={(event) => setActionArtifactUri(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
                placeholder="Artifact URI (optional, e.g., ipfs://...)"
              />
            </div>

            <textarea
              value={actionNotes}
              onChange={(event) => setActionNotes(event.target.value)}
              rows={2}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
            />

            <button
              disabled={busy || !selectedEvidenceId || !canLogAction}
              onClick={recordInvestigativeActionOnChain}
              className="mt-3 rounded-xl bg-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sign Action Log
            </button>

            {!canLogAction ? (
              <p className="mt-2 text-xs text-amber-700">Current role cannot log investigative actions.</p>
            ) : null}
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="verification">
            <h2 className="font-heading text-xl font-bold text-base">Integrity Verification</h2>
            <p className="text-sm text-slate-600">Validate any copy against immutable on-chain evidence hash.</p>

            <input
              value={verifyEvidenceId || ""}
              onChange={(event) => setVerifyEvidenceId(Number(event.target.value || 0))}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
              placeholder="Evidence ID"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="rounded-xl bg-base px-3 py-2 text-sm text-white">
                Verify Original
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) runVerification(file, false).catch((error) => setStatus(String(error)));
                  }}
                />
              </label>
              <label className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white">
                Run Tamper Test
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) runVerification(file, true).catch((error) => setStatus(String(error)));
                  }}
                />
              </label>
            </div>

            <p
              className={clsx(
                "mt-3 rounded-xl p-3 text-sm font-medium",
                verifyMessage.toLowerCase().includes("tamper") || verifyMessage.toLowerCase().includes("mismatch")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              )}
            >
              {verifyMessage || "No verification action performed yet."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="search">
            <h2 className="font-heading text-xl font-bold text-base">Case Search</h2>
            <p className="text-sm text-slate-600">SQLite FTS5 search on case metadata, custody notes, and investigative notes.</p>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search text"
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <select
                value={agencyFilter}
                onChange={(event) => setAgencyFilter(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                <option value="">All agencies</option>
                {AGENCIES.map((agency) => (
                  <option key={agency}>{agency}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              >
                <option value="">All evidence types</option>
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <button
                onClick={() => loadSearch().catch((error) => setStatus(String(error)))}
                className="rounded-xl bg-base px-3 py-2 text-sm font-semibold text-white"
              >
                Run Search
              </button>
            </div>

            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Agency</th>
                    <th className="px-3 py-2">Custody</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((row) => (
                    <tr
                      key={row.evidenceId}
                      onClick={() => {
                        setSelectedEvidenceId(row.evidenceId);
                        setVerifyEvidenceId(row.evidenceId);
                      }}
                      className={clsx(
                        "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                        selectedEvidenceId === row.evidenceId ? "bg-slate-50" : ""
                      )}
                    >
                      <td className="px-3 py-2 font-semibold">#{row.evidenceId}</td>
                      <td className="px-3 py-2">{row.caseId}</td>
                      <td className="px-3 py-2">{row.currentAgency}</td>
                      <td className="px-3 py-2">{row.custodyCount}</td>
                      <td className="px-3 py-2">{row.actionCount}</td>
                    </tr>
                  ))}
                  {searchResults.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={5}>
                        No records found. Sync blockchain data or register new evidence.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov" data-tour-id="evidence-detail">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold text-base">Evidence Detail</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportTimelineCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">
                  Export CSV
                </button>
                <button onClick={exportTimelinePdf} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">
                  Export PDF
                </button>
                <button onClick={generateQrPacket} className="rounded-lg bg-base px-3 py-1.5 text-xs text-white">
                  Generate QR Packet
                </button>
              </div>
            </div>

            {detail ? (
              <>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">Case: {detail.evidence.caseId}</p>
                    <p className="mt-1 text-slate-600">Investigator: {detail.evidence.investigatorId}</p>
                    <p className="mt-1 text-slate-600">Agency: {detail.evidence.currentAgency}</p>
                    <p className="mt-1 text-slate-600">Evidence Type: {detail.evidence.evidenceType}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">IPFS: {detail.evidence.ipfsUri}</p>
                  </div>
                  <HealthBadge
                    hashMatched={hashMatched}
                    custodyCount={detail.history.length}
                    actionCount={detail.actions.length}
                    lastTransferAt={detail.history.at(-1)?.occurredAt || detail.evidence.createdAt}
                  />
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-heading text-lg font-semibold">Unified Audit Timeline</h3>
                    <Timeline history={detail.history} actions={detail.actions} />
                  </div>
                  <div>
                    <h3 className="mb-2 font-heading text-lg font-semibold">Agency Movement Map</h3>
                    <AgencyMap history={detail.history} />
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select evidence from search results.</p>
            )}
          </div>

          <div className="gov-card rounded-2xl border border-white/70 p-4 shadow-gov">
            <h2 className="font-heading text-xl font-bold text-base">QR Evidence Packet</h2>
            <p className="text-sm text-slate-600">
              Generate a short-lived verification link for physical evidence bags.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Evidence QR" className="mx-auto h-44 w-44" />
                ) : (
                  <div className="grid h-44 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    Generate QR for selected evidence
                  </div>
                )}
                <p className="mt-2 break-all text-xs text-slate-500">{verifyUrl || "No verification URL generated"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {qrExpiresAt ? `Expires: ${format(new Date(qrExpiresAt), "dd MMM yyyy HH:mm")}` : ""}
                </p>
              </div>
              <MobilePreview verifyUrl={verifyUrl} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-3 text-sm shadow-gov">
        <ShieldCheck size={16} className="text-green" />
        <span className="font-medium">Status:</span>
        <span className="text-slate-700">{status}</span>
        {busy ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
            <Sparkles size={12} /> Processing...
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          <MapPinned size={12} /> Chain {AMOY_CHAIN_ID}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          <KeyRound size={12} /> Role: {currentRoleLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          <FileCheck2 size={12} /> Access: On-Chain RBAC
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          <FileSearch size={12} /> Search: SQLite FTS5
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          <ScanLine size={12} /> Verification: Real-time
        </span>
      </section>
    </main>
  );
}
