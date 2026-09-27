/**
 * @epoch/adapter-github — published contract types (v1), the NEUTRAL
 * seam (architecture lock rule 13).
 *
 * The record surfaces below are the provider-AGNOSTIC shapes everything
 * outside `src/provider/` speaks: W002 assertion-convention observation
 * records (statement / provenance / confidence / validity — mirrored
 * EXACTLY from the world-model contracts and pinned by compile-time
 * parity in src/parity.ts), W006 exact-revision source references, W003
 * change proposals (the REAL action-protocol types — a runtime
 * dependency), and the W022 authority-decision/outcome mirrors the
 * action surface routes through. No provider vocabulary appears in any
 * shape, key, or enum (pinned by test/neutrality.test.ts).
 */
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { ActionProposal, ProposalReference } from '@epoch/action-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { GITHUB_ADAPTER_RECORD_VERSION } from './version';
import type { ChangeKind, ChangeDispatchDisposition } from './version';

// ---------------------------------------------------------------------------
// W002 assertion-convention mirrors (parity-pinned; see src/parity.ts).
// ---------------------------------------------------------------------------

/** Actor reference — the W002 `ActorRef` shape (mirrored exactly). */
export interface WorkspaceActorRef {
  readonly id: string;
  readonly role:
    | 'human'
    | 'agent'
    | 'system'
    | 'external-provider'
    | 'sensor'
    | 'importer';
  readonly displayName?: string | undefined;
}

/** Evidence kind — the W002 `EvidenceKind` vocabulary (mirrored exactly). */
export type WorkspaceEvidenceKind =
  | 'document'
  | 'measurement'
  | 'observation'
  | 'computation'
  | 'assertion'
  | 'external'
  | 'other';

/** Evidence reference — the W002 `EvidenceRef` shape (mirrored exactly). */
export interface WorkspaceEvidenceRef {
  readonly id: string;
  readonly kind: WorkspaceEvidenceKind;
  readonly digest?: string | undefined;
  readonly locator?: string | undefined;
  readonly description?: string | undefined;
}

/** Provenance — the W002 `Provenance` shape (mirrored exactly). */
export interface WorkspaceProvenance {
  readonly actor: WorkspaceActorRef;
  readonly method: string;
  readonly evidence: readonly WorkspaceEvidenceRef[];
  readonly derivedFrom?: readonly string[] | undefined;
  readonly recordedVia?: string | undefined;
}

/** Confidence distribution — the W002 `ConfidenceDistribution` shape (mirrored exactly). */
export type WorkspaceConfidenceDistribution =
  | { readonly kind: 'point'; readonly value: number }
  | {
      readonly kind: 'interval';
      readonly lower: number;
      readonly upper: number;
      readonly bias?: 'none' | 'low' | 'high' | undefined;
    }
  | {
      readonly kind: 'set';
      readonly values: readonly number[];
      readonly weights?: readonly number[] | undefined;
    };

/** Confidence — the W002 `Confidence` shape (mirrored exactly). */
export interface WorkspaceConfidence {
  readonly distribution: WorkspaceConfidenceDistribution;
  readonly method?: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported' | undefined;
  readonly rationale?: string | undefined;
}

/** Temporal validity — the W002 `Validity` shape (mirrored exactly). */
export interface WorkspaceValidity {
  readonly from?: Timestamp | undefined;
  readonly to?: Timestamp | undefined;
}

/**
 * What one observation states — the W002 `AssertionStatement` shape
 * (mirrored exactly): an entity epoch, a property value, or a relation.
 */
export type WorkspaceStatement =
  | {
      readonly kind: 'entity';
      readonly entityId: string;
      readonly entityType: string;
      readonly properties?: Readonly<Record<string, JsonValue>> | undefined;
    }
  | {
      readonly kind: 'entity-property';
      readonly entityId: string;
      readonly property: string;
      readonly value: JsonValue;
    }
  | {
      readonly kind: 'relation';
      readonly relationType: string;
      readonly source: string;
      readonly target: string;
      readonly properties?: Readonly<Record<string, JsonValue>> | undefined;
    };

// ---------------------------------------------------------------------------
// Observation records and projections (the source-category surface).
// ---------------------------------------------------------------------------

/**
 * One OBSERVATION record: a single W002-convention assertion-shaped
 * observation of the hosted workspace state, content-addressed
 * (`contentDigest` over the canonical record content), provenance-
 * carrying (the adapter actor + the exact provider-snapshot digest as
 * external evidence), and confidence-explicit (an imported, certain
 * observation of provider state states its certainty).
 */
export interface WorkspaceObservationRecord {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** Neutral workspace identity (`sw:<slug>`), derived from the snapshot. */
  readonly workspaceId: string;
  /** Deterministic record identity (content-derived, stable across replays). */
  readonly recordId: string;
  readonly statement: WorkspaceStatement;
  readonly provenance: WorkspaceProvenance;
  readonly confidence: WorkspaceConfidence;
  readonly validity?: WorkspaceValidity | undefined;
  readonly observedAt: Timestamp;
  /** SHA-256 of the record content's canonical JSON (its content address). */
  readonly contentDigest: Sha256Hex;
}

/**
 * The exact-revision source reference — the W006 `ExactRevisionRef`
 * convention (mirrored exactly; pinned in src/parity.ts): the observed
 * provider snapshot, addressed by content digest.
 */
export interface WorkspaceSourceRef {
  readonly artifactId: string;
  readonly revision: string;
  readonly digest: Sha256Hex;
}

/**
 * A whole-workspace projection: the sealed provider snapshot (source
 * reference), the full sorted observation-record set, and the
 * content-addressed projection identity. Deterministic: the same
 * (tenant, snapshot) always projects byte-identically.
 */
export interface WorkspaceProjection {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly workspaceId: string;
  readonly source: WorkspaceSourceRef;
  readonly observedAt: Timestamp;
  /** Sorted by `recordId` ascending — no provider ordering leaks. */
  readonly records: readonly WorkspaceObservationRecord[];
  /** SHA-256 of the projection content (all records + source + scope). */
  readonly projectionDigest: Sha256Hex;
}

/** The outcome of a snapshot ingestion (idempotent, content-addressed). */
export interface SnapshotIngestionRecord {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly workspaceId: string;
  readonly snapshotDigest: Sha256Hex;
  readonly revisionCount: number;
  readonly workItemCount: number;
  readonly ingestedAt: Timestamp;
  /**
   * `ingested` — the snapshot was admitted and sealed;
   * `duplicate` — identical content under the same key; the SEALED PRIOR
   * record is returned (idempotent replay, no state change).
   */
  readonly disposition: 'ingested' | 'duplicate';
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The action surface: proposal plans and authority records.
// ---------------------------------------------------------------------------

/**
 * The neutral change-proposal plan: the W003 action proposal document
 * (REAL `@epoch/action-protocol` type — the frozen proposal contract),
 * its exact-revision reference, and the neutral change parameters. The
 * plan is deterministic: identical inputs derive identical proposals
 * (content-derived ids) and identical digests.
 */
export interface ChangeProposalPlan {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly workspaceId: string;
  readonly changeKind: ChangeKind;
  readonly actionId: string;
  readonly proposal: ActionProposal;
  readonly proposalRef: ProposalReference;
  readonly planDigest: Sha256Hex;
}

/**
 * The authority-side typed DECISION record (the W022 decision mirror):
 * what the action authority decided about a proposal — allow / deny /
 * requires-approval — sealed by the authority with its own content
 * digest. The adapter records the authority's verdict verbatim; it never
 * forms its own.
 */
export interface AuthorityDecisionRecord {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly outcome: 'allow' | 'deny' | 'requires-approval';
  /** The authority's sealed decision digest (its exact-revision address). */
  readonly decisionDigest: Sha256Hex;
  readonly denialCode?: string | undefined;
  readonly denialReason?: string | undefined;
  readonly actionStatus: string;
  readonly decidedAt: Timestamp;
}

/**
 * The authority-side typed OUTCOME record (the W022 outcome mirror):
 * what the authority's execution dispatch actually did — a record-shaped
 * result with evidence references, sealed by the authority. The adapter
 * never executes; outcomes are the authority's typed records.
 */
export interface AuthorityOutcomeRecord {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly kind: 'succeeded' | 'failed';
  readonly failure?: { readonly code: string; readonly reason: string } | undefined;
  readonly evidenceRefs: readonly string[];
  /** The authority's sealed outcome-record digest (its exact-revision address). */
  readonly outcomeDigest: Sha256Hex;
  readonly executedAt: Timestamp;
}

/**
 * One routed change end-to-end: the plan, the authority's decision, the
 * authority's outcome (iff dispatched), and the disposition mapping. The
 * record is content-addressed and append-only (idempotent routing: a
 * replayed dispatch under the same key returns the sealed prior record).
 */
export interface ChangeDispatchRecord {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly workspaceId: string;
  readonly changeKind: ChangeKind;
  readonly actionId: string;
  readonly planDigest: Sha256Hex;
  readonly decision: AuthorityDecisionRecord;
  readonly outcome?: AuthorityOutcomeRecord | undefined;
  readonly disposition: ChangeDispatchDisposition;
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The action-authority seam (the ONLY route a change proposal takes).
// ---------------------------------------------------------------------------

/** The W009-shaped authorization context riding every submission. */
export interface AuthorityAuthorization {
  readonly principalId: string;
  readonly context: unknown;
  readonly justification?: string | undefined;
}

/** One proposal submission to the action authority (the W022 seam input). */
export interface ActionAuthoritySubmission {
  readonly tenantId: TenantId;
  readonly actionId: string;
  /** The W003 action-proposal document (admitted by the authority). */
  readonly proposal: unknown;
  readonly authorization: AuthorityAuthorization;
  readonly decidedAt: Timestamp;
  /** Required iff the proposal demands human approval. */
  readonly approval?: { readonly deadline: Timestamp; readonly maxDelegationDepth: number } | undefined;
}

/** The result of a submission: the authority's typed decision, or a typed error. */
export type ActionAuthorityDecisionResult =
  | { readonly ok: true; readonly decision: AuthorityDecisionRecord }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** One execution dispatch request to the action authority. */
export interface ActionAuthorityExecutionRequest {
  readonly tenantId: TenantId;
  readonly actionId: string;
  readonly authorization: AuthorityAuthorization;
  readonly evidenceRefs?: readonly string[] | undefined;
  readonly at: Timestamp;
}

/** The result of a dispatch: the authority's typed outcome record, or a typed error. */
export type ActionAuthorityExecutionResult =
  | { readonly ok: true; readonly outcome: AuthorityOutcomeRecord }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/**
 * THE action-authority seam (architecture lock rule 3: actions execute
 * only through the Action Gateway): the ONLY route a change proposal
 * takes. The adapter holds no credentials and NEVER executes; it submits
 * proposals and requests dispatch, and records the authority's typed
 * decision/outcome records verbatim. The reference wiring over the REAL
 * W022 gateway is exercised by the parity tests (devDependency — never a
 * runtime edge).
 */
export interface ActionAuthorityPort {
  submitAction(request: ActionAuthoritySubmission): ActionAuthorityDecisionResult;
  executeAction(request: ActionAuthorityExecutionRequest): ActionAuthorityExecutionResult;
}
