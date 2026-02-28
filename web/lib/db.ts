import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type {
  ActorProfile,
  CustodyEvent,
  EvidenceRecord,
  InvestigationAction,
  SearchFilters,
  SearchResult
} from "@/lib/types";

let dbInstance: Database.Database | null = null;

function dbFilePath(): string {
  const dbDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, "satyavault.sqlite");
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence_records (
      evidence_id INTEGER PRIMARY KEY,
      case_id TEXT NOT NULL,
      investigator_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      ipfs_uri TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      current_agency TEXT NOT NULL,
      current_actor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custody_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER NOT NULL,
      from_org TEXT NOT NULL,
      to_org TEXT NOT NULL,
      from_actor TEXT NOT NULL,
      to_actor TEXT NOT NULL,
      action TEXT NOT NULL,
      notes TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      tx_hash TEXT,
      log_index INTEGER DEFAULT -1,
      FOREIGN KEY(evidence_id) REFERENCES evidence_records(evidence_id)
    );

    CREATE TABLE IF NOT EXISTS investigation_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER NOT NULL,
      actor TEXT NOT NULL,
      agency TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_notes TEXT NOT NULL,
      artifact_uri TEXT NOT NULL,
      action_ref TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      tx_hash TEXT,
      log_index INTEGER DEFAULT -1,
      FOREIGN KEY(evidence_id) REFERENCES evidence_records(evidence_id)
    );

    CREATE TABLE IF NOT EXISTS actor_profiles (
      actor_address TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      agency TEXT NOT NULL,
      active INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_custody_evidence_id ON custody_events(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_actions_evidence_id ON investigation_actions(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_records(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence_records(created_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_custody_tx_log_unique
      ON custody_events(tx_hash, log_index)
      WHERE tx_hash IS NOT NULL AND log_index >= 0;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_tx_log_unique
      ON investigation_actions(tx_hash, log_index)
      WHERE tx_hash IS NOT NULL AND log_index >= 0;

    CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts USING fts5(
      evidence_id UNINDEXED,
      case_id,
      investigator_id,
      notes,
      evidence_type,
      agency,
      tokenize='porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Compatibility migration for older DBs before log_index existed.
  const custodyColumns = db
    .prepare("PRAGMA table_info(custody_events)")
    .all() as Array<{ name: string }>;
  if (!custodyColumns.some((column) => column.name === "log_index")) {
    db.exec("ALTER TABLE custody_events ADD COLUMN log_index INTEGER DEFAULT -1");
  }

  // Compatibility migration for older DBs that had no investigation_actions table.
  const actionColumns = db
    .prepare("PRAGMA table_info(investigation_actions)")
    .all() as Array<{ name: string }>;
  if (actionColumns.length > 0 && !actionColumns.some((column) => column.name === "log_index")) {
    db.exec("ALTER TABLE investigation_actions ADD COLUMN log_index INTEGER DEFAULT -1");
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(dbFilePath());
  dbInstance.pragma("journal_mode = WAL");
  initSchema(dbInstance);
  return dbInstance;
}

function normalizeAddress(address: string): string {
  return String(address || "").toLowerCase();
}

function refreshEvidenceSearchIndex(evidenceId: number): void {
  const db = getDb();

  const evidence = db
    .prepare(
      `SELECT evidence_id, case_id, investigator_id, evidence_type, current_agency
       FROM evidence_records
       WHERE evidence_id = ?`
    )
    .get(evidenceId) as
    | {
        evidence_id: number;
        case_id: string;
        investigator_id: string;
        evidence_type: string;
        current_agency: string;
      }
    | undefined;

  if (!evidence) return;

  const custodyRows = db
    .prepare(`SELECT notes FROM custody_events WHERE evidence_id = ? ORDER BY id ASC`)
    .all(evidenceId) as Array<{ notes: string }>;

  const actionRows = db
    .prepare(`SELECT action_notes AS notes FROM investigation_actions WHERE evidence_id = ? ORDER BY id ASC`)
    .all(evidenceId) as Array<{ notes: string }>;

  const combinedNotes = [...custodyRows, ...actionRows].map((row) => row.notes).join(" ");

  db.prepare(`DELETE FROM evidence_fts WHERE evidence_id = ?`).run(evidenceId);
  db.prepare(
    `INSERT INTO evidence_fts (evidence_id, case_id, investigator_id, notes, evidence_type, agency)
     VALUES (@evidence_id, @case_id, @investigator_id, @notes, @evidence_type, @agency)`
  ).run({
    evidence_id: evidence.evidence_id,
    case_id: evidence.case_id,
    investigator_id: evidence.investigator_id,
    notes: combinedNotes,
    evidence_type: evidence.evidence_type,
    agency: evidence.current_agency
  });
}

export function upsertActorProfileCache(profile: ActorProfile): void {
  const db = getDb();

  db.prepare(
    `INSERT INTO actor_profiles (
      actor_address, role, agency, active, updated_at, updated_by
    ) VALUES (
      @actorAddress, @role, @agency, @active, @updatedAt, @updatedBy
    )
    ON CONFLICT(actor_address) DO UPDATE SET
      role = excluded.role,
      agency = excluded.agency,
      active = excluded.active,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`
  ).run({
    actorAddress: normalizeAddress(profile.address),
    role: profile.role,
    agency: profile.agency,
    active: profile.active ? 1 : 0,
    updatedAt: profile.updatedAt || new Date().toISOString(),
    updatedBy: normalizeAddress(profile.updatedBy || "")
  });
}

export function getActorProfileCache(address: string): ActorProfile | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        actor_address AS address,
        role,
        agency,
        active,
        updated_at AS updatedAt,
        updated_by AS updatedBy
       FROM actor_profiles
       WHERE actor_address = ?
       LIMIT 1`
    )
    .get(normalizeAddress(address)) as
    | {
        address: string;
        role: ActorProfile["role"];
        agency: string;
        active: number;
        updatedAt: string;
        updatedBy: string;
      }
    | undefined;

  if (!row) return null;

  return {
    address: row.address,
    role: row.role,
    agency: row.agency,
    active: Boolean(row.active),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy
  };
}

export function getAllActorProfiles(): ActorProfile[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        actor_address AS address,
        role,
        agency,
        active,
        updated_at AS updatedAt,
        updated_by AS updatedBy
       FROM actor_profiles
       ORDER BY updated_at DESC`
    )
    .all() as Array<{
    address: string;
    role: ActorProfile["role"];
    agency: string;
    active: number;
    updatedAt: string;
    updatedBy: string;
  }>;

  return rows.map((row) => ({
    address: row.address,
    role: row.role,
    agency: row.agency,
    active: Boolean(row.active),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy
  }));
}

export function upsertEvidenceCache(record: EvidenceRecord): void {
  const db = getDb();

  db.prepare(
    `INSERT INTO evidence_records (
      evidence_id, case_id, investigator_id, evidence_type, ipfs_uri,
      file_hash, created_at, created_by, current_agency, current_actor
    ) VALUES (
      @evidenceId, @caseId, @investigatorId, @evidenceType, @ipfsUri,
      @fileHash, @createdAt, @createdBy, @currentAgency, @currentActor
    )
    ON CONFLICT(evidence_id) DO UPDATE SET
      case_id = excluded.case_id,
      investigator_id = excluded.investigator_id,
      evidence_type = excluded.evidence_type,
      ipfs_uri = excluded.ipfs_uri,
      file_hash = excluded.file_hash,
      created_at = excluded.created_at,
      created_by = excluded.created_by,
      current_agency = excluded.current_agency,
      current_actor = excluded.current_actor`
  ).run(record);

  refreshEvidenceSearchIndex(record.evidenceId);
}

export function appendCustodyEventCache(event: CustodyEvent): void {
  const db = getDb();

  // Prevent duplicate writes when sync scans overlapping ranges.
  if (event.txHash && Number.isInteger(event.logIndex)) {
    const duplicate = db
      .prepare(
        `SELECT 1 AS exists_flag
         FROM custody_events
         WHERE tx_hash = ? AND log_index = ?
         LIMIT 1`
      )
      .get(event.txHash, event.logIndex) as { exists_flag: number } | undefined;

    if (duplicate) {
      return;
    }
  }

  db.prepare(
    `INSERT INTO custody_events (
      evidence_id, from_org, to_org, from_actor, to_actor,
      action, notes, occurred_at, tx_hash, log_index
    ) VALUES (
      @evidenceId, @fromOrg, @toOrg, @fromActor, @toActor,
      @action, @notes, @occurredAt, @txHash, @logIndex
    )`
  ).run({
    ...event,
    fromActor: normalizeAddress(event.fromActor),
    toActor: normalizeAddress(event.toActor),
    txHash: event.txHash || null,
    logIndex: Number.isInteger(event.logIndex) ? event.logIndex : -1
  });

  db.prepare(
    `UPDATE evidence_records
     SET current_agency = @toOrg,
         current_actor = @toActor
     WHERE evidence_id = @evidenceId`
  ).run({
    ...event,
    toActor: normalizeAddress(event.toActor)
  });

  refreshEvidenceSearchIndex(event.evidenceId);
}

export function appendInvestigationActionCache(action: InvestigationAction): void {
  const db = getDb();

  // Prevent duplicate writes when sync scans overlapping ranges.
  if (action.txHash && Number.isInteger(action.logIndex)) {
    const duplicate = db
      .prepare(
        `SELECT 1 AS exists_flag
         FROM investigation_actions
         WHERE tx_hash = ? AND log_index = ?
         LIMIT 1`
      )
      .get(action.txHash, action.logIndex) as { exists_flag: number } | undefined;

    if (duplicate) {
      return;
    }
  }

  db.prepare(
    `INSERT INTO investigation_actions (
      evidence_id, actor, agency, action_type, action_notes,
      artifact_uri, action_ref, occurred_at, tx_hash, log_index
    ) VALUES (
      @evidenceId, @actor, @agency, @actionType, @actionNotes,
      @artifactUri, @actionRef, @occurredAt, @txHash, @logIndex
    )`
  ).run({
    ...action,
    actor: normalizeAddress(action.actor),
    txHash: action.txHash || null,
    logIndex: Number.isInteger(action.logIndex) ? action.logIndex : -1
  });

  refreshEvidenceSearchIndex(action.evidenceId);
}

export function getEvidenceWithHistory(evidenceId: number): {
  evidence: EvidenceRecord | null;
  history: CustodyEvent[];
  actions: InvestigationAction[];
} {
  const db = getDb();
  const evidence = db
    .prepare(
      `SELECT
        evidence_id AS evidenceId,
        case_id AS caseId,
        investigator_id AS investigatorId,
        evidence_type AS evidenceType,
        ipfs_uri AS ipfsUri,
        file_hash AS fileHash,
        created_at AS createdAt,
        created_by AS createdBy,
        current_agency AS currentAgency,
        current_actor AS currentActor
      FROM evidence_records
      WHERE evidence_id = ?`
    )
    .get(evidenceId) as EvidenceRecord | undefined;

  const history = db
    .prepare(
      `SELECT
        id,
        evidence_id AS evidenceId,
        from_org AS fromOrg,
        to_org AS toOrg,
        from_actor AS fromActor,
        to_actor AS toActor,
        action,
        notes,
        occurred_at AS occurredAt,
        tx_hash AS txHash,
        log_index AS logIndex
      FROM custody_events
      WHERE evidence_id = ?
      ORDER BY occurred_at ASC, id ASC`
    )
    .all(evidenceId) as CustodyEvent[];

  const actions = db
    .prepare(
      `SELECT
        id,
        evidence_id AS evidenceId,
        actor,
        agency,
        action_type AS actionType,
        action_notes AS actionNotes,
        artifact_uri AS artifactUri,
        action_ref AS actionRef,
        occurred_at AS occurredAt,
        tx_hash AS txHash,
        log_index AS logIndex
      FROM investigation_actions
      WHERE evidence_id = ?
      ORDER BY occurred_at ASC, id ASC`
    )
    .all(evidenceId) as InvestigationAction[];

  return {
    evidence: evidence || null,
    history,
    actions
  };
}

function normalizeFtsQuery(raw: string): string {
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.trim().replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .map((token) => `${token}*`);

  if (tokens.length === 0) return "";
  return tokens.join(" AND ");
}

export function searchEvidence(filters: SearchFilters): SearchResult[] {
  const db = getDb();

  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.agency) {
    where.push("e.current_agency = @agency");
    params.agency = filters.agency;
  }

  if (filters.evidenceType) {
    where.push("e.evidence_type = @evidenceType");
    params.evidenceType = filters.evidenceType;
  }

  if (filters.fromDate) {
    where.push("e.created_at >= @fromDate");
    params.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    where.push("e.created_at <= @toDate");
    params.toDate = filters.toDate;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const q = (filters.q || "").trim();

  const baseSelect = `
    SELECT
      e.evidence_id AS evidenceId,
      e.case_id AS caseId,
      e.investigator_id AS investigatorId,
      e.evidence_type AS evidenceType,
      e.current_agency AS currentAgency,
      e.created_at AS createdAt,
      COALESCE(cstats.custody_count, 0) AS custodyCount,
      COALESCE(astats.action_count, 0) AS actionCount,
      COALESCE(cstats.last_transfer_at, e.created_at) AS lastTransferAt
    FROM evidence_records e
    LEFT JOIN (
      SELECT
        evidence_id,
        COUNT(*) AS custody_count,
        MAX(occurred_at) AS last_transfer_at
      FROM custody_events
      GROUP BY evidence_id
    ) cstats ON cstats.evidence_id = e.evidence_id
    LEFT JOIN (
      SELECT
        evidence_id,
        COUNT(*) AS action_count
      FROM investigation_actions
      GROUP BY evidence_id
    ) astats ON astats.evidence_id = e.evidence_id
  `;

  if (q) {
    const ftsQuery = normalizeFtsQuery(q);
    if (!ftsQuery) return [];

    const query = `
      WITH ranked AS (
        SELECT evidence_id, MIN(bm25(evidence_fts)) AS rank
        FROM evidence_fts
        WHERE evidence_fts MATCH @ftsQuery
        GROUP BY evidence_id
      )
      ${baseSelect}
      INNER JOIN ranked r ON r.evidence_id = e.evidence_id
      ${whereSql}
      ORDER BY r.rank ASC, e.created_at DESC
      LIMIT 200
    `;

    return db.prepare(query).all({ ...params, ftsQuery }) as SearchResult[];
  }

  const query = `
    ${baseSelect}
    ${whereSql}
    ORDER BY e.created_at DESC
    LIMIT 200
  `;

  return db.prepare(query).all(params) as SearchResult[];
}

export function getDashboardMetrics(): {
  totalEvidence: number;
  totalActions: number;
  activeActors: number;
  avgProcessingHours: number;
  agencyBreakdown: Array<{ agency: string; count: number }>;
} {
  const db = getDb();

  const totalEvidence =
    (db.prepare(`SELECT COUNT(*) AS c FROM evidence_records`).get() as { c: number }).c || 0;

  const totalActions =
    (db.prepare(`SELECT COUNT(*) AS c FROM investigation_actions`).get() as { c: number }).c || 0;

  const activeActors =
    (db.prepare(`SELECT COUNT(*) AS c FROM actor_profiles WHERE active = 1`).get() as { c: number }).c ||
    0;

  const avgRow = db
    .prepare(
      `SELECT AVG((julianday(last_transfer_at) - julianday(created_at)) * 24.0) AS avg_hours
       FROM (
         SELECT
           e.evidence_id,
           e.created_at,
           COALESCE(MAX(c.occurred_at), e.created_at) AS last_transfer_at
         FROM evidence_records e
         LEFT JOIN custody_events c ON c.evidence_id = e.evidence_id
         GROUP BY e.evidence_id
       )`
    )
    .get() as { avg_hours: number | null };

  const agencyBreakdown = db
    .prepare(
      `SELECT current_agency AS agency, COUNT(*) AS count
       FROM evidence_records
       GROUP BY current_agency
       ORDER BY count DESC`
    )
    .all() as Array<{ agency: string; count: number }>;

  return {
    totalEvidence,
    totalActions,
    activeActors,
    avgProcessingHours: Number((avgRow.avg_hours || 0).toFixed(2)),
    agencyBreakdown
  };
}

export function getLastSyncedBlock(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM sync_state WHERE key = 'last_synced_block' LIMIT 1")
    .get() as { value: string } | undefined;

  if (!row) {
    return -1;
  }

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : -1;
}

export function setLastSyncedBlock(blockNumber: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sync_state (key, value, updated_at)
     VALUES ('last_synced_block', @value, @updatedAt)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run({
    value: String(blockNumber),
    updatedAt: new Date().toISOString()
  });
}

export function getRecordCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS c FROM evidence_records").get() as { c: number };
  return row.c || 0;
}
