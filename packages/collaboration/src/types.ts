/**
 * @epoch/collaboration — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Authority model (architecture lock rules 1/3/12 + the W010 pin):
 * collaboration is a COORDINATION surface — it never mutates the world
 * model (world semantics are @epoch/world-model's authority) and never
 * makes authorization decisions (@epoch/authorization's). Participants
 * coordinate; their ACTIONS still flow through the Action Gateway.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { ProposalReference } from '@epoch/action-protocol';
import type {
  CollaborationEventKind,
  PresenceState,
  SessionState,
} from './version';
import type { COLLABORATION_RECORD_VERSION } from './version';

/** Opaque collaboration session identity (`session:<slug>`). */
export type CollaborationSessionId = string;

/** Tenant scope of a session (`tenant:<slug>`, the W009 tenancy grammar). */
export type CollaborationTenantId = string;

/** Opaque participant principal id (`principal:<slug>`, the W009 identity grammar). */
export type ParticipantPrincipalId = string;

/**
 * Optional tenant-hierarchy narrowing of a session: the workspace and
 * project the session coordinates within (opaque W009 tenancy ids; a
 * session may be tenant-wide when omitted).
 */
export interface SessionScope {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/**
 * The immutable session record — the session's opening fact. All
 * subsequent lifecycle, membership, presence, and coordination facts are
 * events in the session journal (appended, never mutated). `openedAt`
 * and `createdAt`-style instants are PRODUCER-SUPPLIED payload data:
 * this package never reads a clock.
 */
export interface CollaborationSession {
  readonly schemaVersion: typeof COLLABORATION_RECORD_VERSION;
  readonly sessionId: CollaborationSessionId;
  readonly tenantId: CollaborationTenantId;
  readonly scope?: SessionScope | undefined;
  readonly displayName: string;
  readonly createdBy: ParticipantPrincipalId;
  readonly openedAt: string;
}

/**
 * A session creation envelope: the session record plus the digest
 * CLAIMED for it. The hub recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection).
 */
export interface SessionRegistration {
  readonly session: CollaborationSession;
  readonly digest: Sha256Hex;
}

/** The published session record: content plus its content address. */
export interface CollaborationSessionRecord {
  readonly session: CollaborationSession;
  readonly sessionDigest: Sha256Hex;
}

/**
 * A coordination subject: what a session or participant is focusing on.
 * An opaque reference into the shared model — a world entity (W002
 * vocabulary) or an action proposal at an exact revision (W003
 * vocabulary). References only: coordination never embeds or mutates
 * them.
 */
export type CollaborationSubject =
  | {
      readonly kind: 'world-entity';
      readonly entityId: string;
    }
  | {
      readonly kind: 'action-proposal';
      readonly proposal: ProposalReference;
    };

/**
 * The immutable content of one session-scoped coordination event — the
 * envelope minus the digest. `occurredAt` is PRODUCER-SUPPLIED. The
 * journal is append-only with strict per-session sequence discipline
 * (contiguous from 1 — the event-log discipline applied to the session
 * scope).
 */
export interface CollaborationEvent {
  readonly schemaVersion: typeof COLLABORATION_RECORD_VERSION;
  readonly sessionId: CollaborationSessionId;
  readonly sequence: number;
  readonly tenantId: CollaborationTenantId;
  readonly actor: ParticipantPrincipalId;
  readonly kind: CollaborationEventKind;
  readonly participant?: ParticipantPrincipalId | undefined;
  readonly presence?: PresenceState | undefined;
  readonly subject?: CollaborationSubject | undefined;
  readonly data?: Readonly<Record<string, JsonValue>> | undefined;
  readonly occurredAt: string;
}

/** The published coordination event record: content plus its content address. */
export interface CollaborationEventRecord {
  readonly event: CollaborationEvent;
  readonly contentDigest: Sha256Hex;
}

/** A coordination event creation envelope (content + claimed digest). */
export interface CollaborationEventRegistration {
  readonly event: CollaborationEvent;
  readonly digest: Sha256Hex;
}

/** Options of the cursor-based journal read. */
export interface ReadJournalOptions {
  /** Exclusive lower bound (read events with sequence > after). */
  readonly after?: number;
  /** Maximum number of records returned (positive). */
  readonly limit?: number;
}

/** Options of the `CollaborationHub` constructor. */
export interface CollaborationHubOptions {
  /**
   * Tenant this hub is scoped to. When provided, ANY session creation or
   * event append carrying a different tenant id is rejected with
   * `cross-tenant-denied` (R12); reads are optionally tenant-checked
   * through the `asTenant` read option.
   */
  readonly expectedTenantId?: CollaborationTenantId;
}

/** Options of the read entry points (the tenant view). */
export interface ReadOptions {
  /**
   * The tenant the caller is reading FOR. When provided and different
   * from the session's tenant, the read is a typed
   * `cross-tenant-denied` rejection (R12 — cross-tenant JOIN/READ
   * attempts are typed rejections).
   */
  readonly asTenant?: CollaborationTenantId;
}

/** The membership projection of one session participant. */
export interface ParticipantPresence {
  readonly principalId: ParticipantPrincipalId;
  readonly presence: PresenceState;
  /** Sequence of the event that last touched this participant. */
  readonly lastSequence: number;
}

/** The session state projection (lifecycle + membership + journal cursor). */
export interface SessionStateInfo {
  readonly session: CollaborationSession;
  readonly state: SessionState;
  readonly participants: readonly ParticipantPresence[];
  readonly lastSequence: number;
  readonly eventCount: number;
}

/**
 * The typed collaboration error taxonomy (W010 Tech Lead pin). Every
 * entry point is total — errors are values, never exceptions:
 *
 * - `version-unsupported` — schemaVersion skew;
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor fields; kind/presence/member consistency);
 * - `digest-mismatch` — claimed digest ≠ recomputed canonical SHA-256;
 * - `cross-tenant-denied` — tenant scope violation (R12: cross-tenant
 *   create/append/join/read attempts);
 * - `duplicate-session` — session ids are unique forever;
 * - `unknown-session` — operating on a session that does not exist;
 * - `session-closed` — appending to a closed session's journal;
 * - `sequence-gap` / `out-of-order-sequence` / `duplicate-sequence` —
 *   the strict per-session journal sequence discipline;
 * - `duplicate-participant` — joining an already-active participant;
 * - `unknown-participant` — leaving/presence for a non-active
 *   participant;
 * - `invalid-presence-transition` — an illegal presence state change.
 */
export type CollaborationError =
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly CollaborationIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly sessionId: CollaborationSessionId;
    }
  | {
      readonly code: 'duplicate-session';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
    }
  | {
      readonly code: 'unknown-session';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
    }
  | {
      readonly code: 'session-closed';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
    }
  | {
      readonly code: 'sequence-gap';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly expectedSequence: number;
      readonly encounteredSequence: number;
    }
  | {
      readonly code: 'out-of-order-sequence';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly expectedSequence: number;
      readonly encounteredSequence: number;
    }
  | {
      readonly code: 'duplicate-sequence';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly sequence: number;
    }
  | {
      readonly code: 'duplicate-participant';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly principalId: ParticipantPrincipalId;
    }
  | {
      readonly code: 'unknown-participant';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly principalId: ParticipantPrincipalId;
    }
  | {
      readonly code: 'invalid-presence-transition';
      readonly message: string;
      readonly sessionId: CollaborationSessionId;
      readonly principalId: ParticipantPrincipalId;
      readonly from: PresenceState;
      readonly to: PresenceState;
    };

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface CollaborationIssue {
  readonly path: string;
  readonly message: string;
}

/** Total-result wrapper of every collaboration entry point. */
export type CollaborationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CollaborationError };

/**
 * A deterministic, serialization-friendly projection of a whole hub:
 * session records sorted by sessionId, coordination journals sorted by
 * (sessionId, sequence). Two hubs containing the same facts emit
 * byte-identical snapshots regardless of creation/append order.
 */
export interface CollaborationSnapshot {
  readonly schemaVersion: typeof COLLABORATION_RECORD_VERSION;
  readonly sessions: readonly CollaborationSessionRecord[];
  readonly events: readonly CollaborationEventRecord[];
}
