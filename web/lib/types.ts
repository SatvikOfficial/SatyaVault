// Role names are aligned with the Solidity enum in SatyaVault.sol.
export type Role =
  | "NONE"
  | "INVESTIGATOR"
  | "FSL_OFFICER"
  | "COURT_OFFICER"
  | "AUDITOR"
  | "MINISTRY_ADMIN";

export type EvidenceType =
  | "MOBILE_IMAGE"
  | "FORENSIC_PDF"
  | "CHAT_EXPORT"
  | "DRIVE_DUMP"
  | "EMAIL_ARCHIVE";

// On-chain actor metadata used to enforce access controls.
export interface ActorProfile {
  address: string;
  role: Role;
  agency: string;
  active: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface EvidenceRecord {
  evidenceId: number;
  caseId: string;
  investigatorId: string;
  evidenceType: EvidenceType;
  ipfsUri: string;
  fileHash: string;
  createdAt: string;
  createdBy: string;
  currentAgency: string;
  currentActor: string;
}

// Immutable custody transfer record.
export interface CustodyEvent {
  id?: number;
  evidenceId: number;
  fromOrg: string;
  toOrg: string;
  fromActor: string;
  toActor: string;
  action: string;
  notes: string;
  occurredAt: string;
  txHash?: string;
  logIndex?: number;
}

// Immutable investigative action record.
export interface InvestigationAction {
  id?: number;
  evidenceId: number;
  actor: string;
  agency: string;
  actionType: string;
  actionNotes: string;
  artifactUri: string;
  actionRef: string;
  occurredAt: string;
  txHash?: string;
  logIndex?: number;
}

export interface EvidenceWithHistory {
  evidence: EvidenceRecord;
  history: CustodyEvent[];
  actions: InvestigationAction[];
}

export interface SearchFilters {
  q?: string;
  agency?: string;
  evidenceType?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SearchResult {
  evidenceId: number;
  caseId: string;
  investigatorId: string;
  evidenceType: string;
  currentAgency: string;
  createdAt: string;
  custodyCount: number;
  actionCount: number;
  lastTransferAt: string;
}
