/**
 * @epoch/document-adapter-host — published contract types (v1).
 *
 * The long-running HOST MODEL (service layer, W028): ingestion sessions
 * over typed bytes, the deterministic advance-on-evidence stage driver,
 * idempotent re-runs with typed keys, tenant-scoped reads, and
 * health/liveness — ALL as typed, serialization-friendly data. The host
 * adds no semantic authority of its own: the derivation model is the
 * kernel's (@epoch/document-adapter), the evidence store and capability
 * registry are the W006/W007 kernels' (genuine runtime consumption), and
 * every host state is a projection over those typed inputs.
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type {
  DocumentAdapterError,
  DocumentDescriptor,
  ExtractionCandidate,
  ExtractionStageKind,
  ProvisionalAdapterDefinition,
  StageEvidenceChain,
  StageRunContext,
  TenantScope,
  TrustEscalationOp,
} from '@epoch/document-adapter';
import type { HostStatus } from './version';

/** Opaque ingestion idempotency key (host-supplied typed data). */
export type IdempotencyKey = string;

/** Opaque session identity: `sess:` + 64 lowercase hex. */
export type SessionId = string;

/** Tenant identity (W009 grammar — the tenant the caller acts as). */
export type ActingTenantId = string;

/** Input of {@link import('./host').DocumentAdapterHost.ingestDocument}. */
export interface IngestDocumentInput {
  /** Serialized document content (typed bytes; kernel admission applies). */
  readonly content: unknown;
  /** Serialized document descriptor (content-addressed claims verified). */
  readonly descriptor: unknown;
  /** The tenant the caller ingests FOR (R12): must own the descriptor. */
  readonly asTenant: ActingTenantId;
  /** Stable ingestion intent id (idempotency + duplicate suppression). */
  readonly idempotencyKey: IdempotencyKey;
  /** Host-supplied typed run context (identity + observation instant). */
  readonly run: StageRunContext;
}

/** The admission receipt of one ingestion (typed bytes in, evidence out). */
export interface IngestionReceipt {
  readonly schemaVersion: 1;
  readonly sessionId: SessionId;
  readonly stage: 'uploaded';
  /** Content address of the uploaded-stage evidence record. */
  readonly evidenceDigest: Sha256Hex;
  /** True when this ingestion was an idempotent re-run of an existing session. */
  readonly duplicate: boolean;
}

/** Input of {@link import('./host').DocumentAdapterHost.advanceSession}. */
export interface AdvanceSessionInput {
  readonly sessionId: SessionId;
  /** The stage to advance TO (must be the current stage's legal successor). */
  readonly to: ExtractionStageKind;
  /** The tenant the caller advances FOR (R12). */
  readonly asTenant: ActingTenantId;
  /** Host-supplied typed run context for the stage evidence. */
  readonly run: StageRunContext;
}

/** The outcome of one stage advance (advance-on-evidence). */
export interface StageAdvance {
  readonly schemaVersion: 1;
  readonly sessionId: SessionId;
  readonly from: ExtractionStageKind;
  readonly to: ExtractionStageKind;
  /** Content address of the stage's evidence record. */
  readonly evidenceDigest: Sha256Hex;
  /** True when the advance was already applied (idempotent re-run). */
  readonly duplicate: boolean;
}

/**
 * The serializable session state (deterministic projection): which
 * document, which stage, which evidence chain, which candidates, and —
 * once terminal — which provisional definition. The content bytes
 * themselves stay in host memory and never cross the read surface.
 */
export interface SessionSnapshot {
  readonly schemaVersion: 1;
  readonly sessionId: SessionId;
  readonly idempotencyKey: IdempotencyKey;
  readonly descriptor: DocumentDescriptor;
  readonly tenantScope: TenantScope;
  readonly stage: ExtractionStageKind;
  readonly evidenceChain: StageEvidenceChain;
  /** Content-derived candidate ids, sorted ascending (deterministic). */
  readonly candidateIds: readonly string[];
  /** The provisional definitions (one per candidate, sorted; empty before the terminal stage). */
  readonly definitions: readonly ProvisionalAdapterDefinition[];
}

/** Input of {@link import('./host').DocumentAdapterHost.getSession}. */
export interface GetSessionInput {
  readonly sessionId: SessionId;
  readonly asTenant: ActingTenantId;
}

/** Input of {@link import('./host').DocumentAdapterHost.listSessions}. */
export interface ListSessionsInput {
  readonly asTenant: ActingTenantId;
}

/** Health/liveness as typed data (no wall clock — pure state projection). */
export interface HealthReport {
  readonly schemaVersion: 1;
  readonly service: 'document-adapter';
  readonly status: HostStatus;
  readonly sessionCount: number;
  readonly evidenceCount: number;
  readonly registrationCount: number;
  /** Sessions per pipeline stage (deterministic key order). */
  readonly stageHistogram: Readonly<Record<ExtractionStageKind, number>>;
}

/** The typed service surface this host exposes (typed data). */
export interface ServiceDescription {
  readonly schemaVersion: 1;
  readonly service: 'document-adapter';
  readonly contractVersion: string;
  /** The derivation pipeline the driver advances through. */
  readonly stages: readonly ExtractionStageKind[];
  /** The deterministic document forms admitted at ingestion. */
  readonly formats: readonly string[];
  /** The tenant isolation + trust floor invariants, as stated facts. */
  readonly invariants: readonly string[];
}

/** Input of {@link import('./host').DocumentAdapterHost.requestTrustEscalation}. */
export interface HostTrustEscalationInput {
  readonly sessionId: SessionId;
  readonly op: TrustEscalationOp;
  readonly asTenant: ActingTenantId;
}

/** A candidate + its session (the review-pending read surface). */
export interface SessionCandidates {
  readonly schemaVersion: 1;
  readonly sessionId: SessionId;
  readonly stage: ExtractionStageKind;
  readonly candidates: readonly ExtractionCandidate[];
}

/**
 * The host error taxonomy: the KERNEL taxonomy passes through unchanged
 * (typed, versioned), plus the three service-specific failures
 * (`unknown-session`, `idempotency-conflict`, `registration-conflict`).
 * Every host entry point is total — errors are values, never thrown.
 */
export type DocumentAdapterHostError =
  | DocumentAdapterError
  | {
      readonly code: 'unknown-session';
      readonly message: string;
      readonly sessionId: SessionId;
    }
  | {
      readonly code: 'idempotency-conflict';
      readonly message: string;
      readonly idempotencyKey: IdempotencyKey;
      readonly expectedDocumentDigest: Sha256Hex;
      readonly encounteredDocumentDigest: Sha256Hex;
    }
  | {
      readonly code: 'registration-conflict';
      readonly message: string;
      readonly capabilityId: string;
      readonly version: string;
    };

/** Result of a total host entry point. */
export type HostResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DocumentAdapterHostError };

/** The instant a session was created (host-supplied at ingestion). */
export type SessionCreatedAt = Timestamp;
