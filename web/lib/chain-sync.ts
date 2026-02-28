import { Contract, JsonRpcProvider } from "ethers";
import { SATYAVAULT_ABI, getContractAddress, getRpcUrl } from "@/lib/contract";
import {
  appendCustodyEventCache,
  appendInvestigationActionCache,
  getLastSyncedBlock,
  getRecordCount,
  setLastSyncedBlock,
  upsertActorProfileCache,
  upsertEvidenceCache
} from "@/lib/db";
import type { ActorProfile, CustodyEvent, EvidenceRecord, InvestigationAction, Role } from "@/lib/types";

interface SyncOptions {
  force?: boolean;
}

interface SyncReport {
  synced: boolean;
  fromBlock: number;
  toBlock: number;
  eventsProcessed: number;
  reason?: string;
}

const CHUNK_SIZE = 2000;
const THROTTLE_MS = 15000;

let lastSyncAttemptAt = 0;
let inFlightSync: Promise<SyncReport> | null = null;

function getConfiguredStartBlock(): number {
  const raw = process.env.CHAIN_SYNC_START_BLOCK || process.env.NEXT_PUBLIC_CHAIN_SYNC_START_BLOCK;
  const parsed = Number(raw || "0");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function inferEvidenceType(ipfsUri: string): EvidenceRecord["evidenceType"] {
  const lower = ipfsUri.toLowerCase();
  if (lower.endsWith(".pdf")) return "FORENSIC_PDF";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
    return "MOBILE_IMAGE";
  }
  return "CHAT_EXPORT";
}

function mapRole(roleValue: bigint | number | string): Role {
  const numeric = Number(roleValue);
  if (numeric === 1) return "INVESTIGATOR";
  if (numeric === 2) return "FSL_OFFICER";
  if (numeric === 3) return "COURT_OFFICER";
  if (numeric === 4) return "AUDITOR";
  if (numeric === 5) return "MINISTRY_ADMIN";
  return "NONE";
}

function evidenceFromRegisterEvent(eventLog: any): EvidenceRecord {
  const timestampSec = Number(eventLog.args.timestamp);
  return {
    evidenceId: Number(eventLog.args.evidenceId),
    fileHash: String(eventLog.args.fileHash).replace(/^0x/, ""),
    ipfsUri: String(eventLog.args.ipfsUri),
    caseId: String(eventLog.args.caseId),
    investigatorId: String(eventLog.args.investigatorId),
    createdAt: new Date(timestampSec * 1000).toISOString(),
    createdBy: String(eventLog.args.createdBy).toLowerCase(),
    currentAgency: "Pending Intake",
    currentActor: String(eventLog.args.createdBy).toLowerCase(),
    evidenceType: inferEvidenceType(String(eventLog.args.ipfsUri))
  };
}

function custodyFromTransferEvent(eventLog: any): CustodyEvent {
  const timestampSec = Number(eventLog.args.timestamp);
  return {
    evidenceId: Number(eventLog.args.evidenceId),
    fromActor: String(eventLog.args.fromActor).toLowerCase(),
    toActor: String(eventLog.args.toActor).toLowerCase(),
    fromOrg: String(eventLog.args.fromOrg),
    toOrg: String(eventLog.args.toOrg),
    action: String(eventLog.args.action),
    notes: String(eventLog.args.notes),
    occurredAt: new Date(timestampSec * 1000).toISOString(),
    txHash: String(eventLog.transactionHash || ""),
    logIndex: Number(eventLog.index ?? eventLog.logIndex ?? -1)
  };
}

function actionFromInvestigativeEvent(eventLog: any): InvestigationAction {
  const timestampSec = Number(eventLog.args.timestamp);
  return {
    evidenceId: Number(eventLog.args.evidenceId),
    actor: String(eventLog.args.actor).toLowerCase(),
    agency: String(eventLog.args.agency),
    actionType: String(eventLog.args.actionType),
    actionNotes: String(eventLog.args.actionNotes),
    artifactUri: String(eventLog.args.artifactUri),
    actionRef: String(eventLog.args.actionRef),
    occurredAt: new Date(timestampSec * 1000).toISOString(),
    txHash: String(eventLog.transactionHash || ""),
    logIndex: Number(eventLog.index ?? eventLog.logIndex ?? -1)
  };
}

function profileFromActorProfileEvent(eventLog: any): ActorProfile {
  const timestampSec = Number(eventLog.args.timestamp);
  return {
    address: String(eventLog.args.actor).toLowerCase(),
    role: mapRole(eventLog.args.role),
    agency: String(eventLog.args.agency),
    active: Boolean(eventLog.args.active),
    updatedAt: new Date(timestampSec * 1000).toISOString(),
    updatedBy: String(eventLog.args.updatedBy).toLowerCase()
  };
}

export async function syncFromBlockchain(options: SyncOptions = {}): Promise<SyncReport> {
  if (inFlightSync) {
    return inFlightSync;
  }

  const now = Date.now();
  if (!options.force && now - lastSyncAttemptAt < THROTTLE_MS) {
    return {
      synced: false,
      fromBlock: -1,
      toBlock: -1,
      eventsProcessed: 0,
      reason: "throttled"
    };
  }

  inFlightSync = (async () => {
    lastSyncAttemptAt = Date.now();

    try {
      const rpcUrl = getRpcUrl();
      const contractAddress = getContractAddress();

      const provider = new JsonRpcProvider(rpcUrl);
      const latestBlock = await provider.getBlockNumber();
      const contract = new Contract(contractAddress, SATYAVAULT_ABI, provider);

      const currentSynced = getLastSyncedBlock();
      const startFallback = getConfiguredStartBlock();
      const dbCount = getRecordCount();

      let fromBlock = currentSynced >= 0 ? currentSynced + 1 : startFallback;
      if (fromBlock === 0 && dbCount === 0) {
        // Reduce first sync load when start block is not configured.
        fromBlock = Math.max(0, latestBlock - 8000);
      }

      if (fromBlock > latestBlock) {
        return {
          synced: false,
          fromBlock,
          toBlock: latestBlock,
          eventsProcessed: 0,
          reason: "already_up_to_date"
        };
      }

      let eventsProcessed = 0;
      let chunkFrom = fromBlock;

      while (chunkFrom <= latestBlock) {
        const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, latestBlock);

        const [registerLogs, transferLogs, actionLogs, roleLogs] = await Promise.all([
          contract.queryFilter(contract.filters.EvidenceRegistered(), chunkFrom, chunkTo),
          contract.queryFilter(contract.filters.CustodyTransferred(), chunkFrom, chunkTo),
          contract.queryFilter(contract.filters.InvestigationActionLogged(), chunkFrom, chunkTo),
          contract.queryFilter(contract.filters.ActorProfileUpdated(), chunkFrom, chunkTo)
        ]);

        const merged = [...registerLogs, ...transferLogs, ...actionLogs, ...roleLogs].sort((a: any, b: any) => {
          if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber - b.blockNumber;
          }
          const ai = Number(a.index ?? a.logIndex ?? 0);
          const bi = Number(b.index ?? b.logIndex ?? 0);
          return ai - bi;
        });

        for (const log of merged as any[]) {
          if (log.fragment?.name === "EvidenceRegistered") {
            upsertEvidenceCache(evidenceFromRegisterEvent(log));
            eventsProcessed += 1;
          }

          if (log.fragment?.name === "CustodyTransferred") {
            appendCustodyEventCache(custodyFromTransferEvent(log));
            eventsProcessed += 1;
          }

          if (log.fragment?.name === "InvestigationActionLogged") {
            appendInvestigationActionCache(actionFromInvestigativeEvent(log));
            eventsProcessed += 1;
          }

          if (log.fragment?.name === "ActorProfileUpdated") {
            upsertActorProfileCache(profileFromActorProfileEvent(log));
            eventsProcessed += 1;
          }
        }

        setLastSyncedBlock(chunkTo);
        chunkFrom = chunkTo + 1;
      }

      return {
        synced: true,
        fromBlock,
        toBlock: latestBlock,
        eventsProcessed
      };
    } catch (error) {
      return {
        synced: false,
        fromBlock: -1,
        toBlock: -1,
        eventsProcessed: 0,
        reason: String(error)
      };
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}
