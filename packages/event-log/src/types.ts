/**
 * @epoch/event-log — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * kind-prefixed (or namespaced, for discriminators); no field encodes a
 * provider, broker, database or deployment surface. The log owns the
 * CHANGE HISTORY only — world semantics are @epoch/world-model's
 * authority, action authorization is @epoch/action-protocol /
 * @epoch/authorization's; payloads REFERENCE those vocabularies opaquely
 * (src/subjects.ts), they never re-declare them.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { ActionTypeReference, ProposalReference } from '@epoch/action-protocol';
import type { EVENT_LOG_RECORD_VERSION } from './version';
import type { ActionEventPhase } from './version';

/** Opaque event stream identity (`stream:<slug>`). */
export type EventStreamId = string;

/** Tenant scope of an event (`tenant:<slug>`, the W009 tenancy grammar). */
export type EventTenantId = string;

/** Acting principal of an event (`principal:<slug>`, the W009 identity grammar). */
export type EventActor = string;

/** Event-kind discriminator (`namespace:name`). */
export type EventKindDiscriminator = string;

/** One event sequence number (1-based, contiguous per stream). */
export type EventSequence = number;

/**
 * The causal parent reference: the event this event claims as its cause.
 * The referenced event may live in ANY stream — cross-stream causal
 * references are how streams INTERSECT (the replay pin folds "a stream
 * (or intersecting streams)"). Two invariants are enforced at admission:
 * a same-stream parent must be strictly EARLIER (`causal-cycle` otherwise)
 * and the referenced coordinate must already exist in history
 * (`unknown-parent` otherwise). `null` denotes an independent (root)
 * event.
 */
export interface CausalEventReference {
  readonly streamId: EventStreamId;
  readonly sequence: EventSequence;
}

/**
 * The typed payload of one event: a discriminator selecting the payload
 * family plus opaque JSON data. Discriminators in the reserved `world` /
 * `action` namespaces MUST satisfy the kernel payload contracts
 * (src/subjects.ts); all other namespaces are open (extension) payloads.
 */
export interface EventPayload {
  readonly discriminator: EventKindDiscriminator;
  readonly data: Readonly<Record<string, JsonValue>>;
}

/**
 * One reference to a world-graph subject (the `world:subjects` payload
 * family): an entity id or a relation id in the W002 world-model
 * vocabulary — referenced opaquely, never embedded. The referenced object
 * need not exist in any particular world instance at validation time
 * (existence is the consumer's check; this package owns history, not
 * world semantics).
 */
export type EventSubject =
  | {
      readonly kind: 'entity';
      readonly entityId: string;
    }
  | {
      readonly kind: 'relation';
      readonly relationId: string;
    };


/**
 * The typed data of a `world:subjects` payload: one or more world-graph
 * subjects the event concerns, plus an optional human-readable note.
 */
export interface WorldSubjectsEventData {
  readonly subjects: readonly EventSubject[];
  readonly note?: string | undefined;
}

/**
 * The typed data of an `action:lifecycle` payload: an exact-revision
 * proposal reference (@epoch/action-protocol vocabulary), the action
 * type, and the lifecycle phase this event records. This is a FACT record
 * of the action lifecycle — the authorization decision itself is
 * @epoch/authorization's authority.
 */
export interface ActionLifecycleEventData {
  readonly action: ProposalReference;
  readonly actionType: ActionTypeReference;
  readonly phase: ActionEventPhase;
  readonly detail?: Readonly<Record<string, JsonValue>> | undefined;
}

/**
 * The immutable content of one logged event — every envelope field EXCEPT
 * the content digest. `occurredAt` is PRODUCER-SUPPLIED (part of the
 * fact): this package never reads a clock, so admission and replay are
 * deterministic by construction (W010 pin: any timestamp a consumer needs
 * comes FROM event payload data).
 */
export interface EventContent {
  readonly schemaVersion: typeof EVENT_LOG_RECORD_VERSION;
  readonly streamId: EventStreamId;
  readonly sequence: EventSequence;
  readonly tenantId: EventTenantId;
  readonly actor: EventActor;
  readonly causalParent: CausalEventReference | null;
  readonly payload: EventPayload;
  readonly occurredAt: string;
}

/**
 * The published event record: immutable content plus the SHA-256 digest
 * of that content's canonical JSON (the exact-revision content address of
 * the fact). Serialization-friendly by construction: a plain JSON object.
 */
export interface EventRecord {
  readonly event: EventContent;
  readonly contentDigest: Sha256Hex;
}

/**
 * A creation envelope: the event content plus the digest CLAIMED for it.
 * The log recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection): an event whose claimed digest
 * does not match its content never enters history.
 */
export interface EventRegistration {
  readonly event: EventContent;
  readonly digest: Sha256Hex;
}

/** Deterministic per-stream projection exposed by the read primitives. */
export interface StreamInfo {
  readonly streamId: EventStreamId;
  readonly tenantId: EventTenantId;
  readonly firstSequence: EventSequence;
  readonly lastSequence: EventSequence;
  readonly eventCount: number;
}

/** Options of the cursor-based `readStream` primitive. */
export interface ReadStreamOptions {
  /** Exclusive lower bound (the cursor: read events with sequence > after). */
  readonly after?: EventSequence;
  /** Inclusive upper bound (read events with sequence <= to). */
  readonly to?: EventSequence;
  /** Maximum number of records returned (positive). */
  readonly limit?: number;
}

/** Options of the `EventLog` constructor. */
export interface EventLogOptions {
  /**
   * Tenant this log is scoped to. When provided, ANY append carrying a
   * different tenant id is rejected with `cross-tenant-denied` (R12 — the
   * tenant isolation boundary); a log without an expected tenant still
   * fixes each stream's tenant at its first event and rejects later
   * cross-tenant appends to that stream.
   */
  readonly expectedTenantId?: EventTenantId;
}

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface EventLogIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed event-log error taxonomy (W010 Tech Lead pin). Every entry
 * point is total — errors are values, never exceptions:
 *
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor/provider fields; reserved-namespace payload data must satisfy
 *   the kernel payload contracts);
 * - `digest-mismatch` — claimed digest ≠ recomputed canonical SHA-256;
 * - `cross-tenant-denied` — tenant scope violation (R12);
 * - `sequence-gap` — append skipping forward past last+1;
 * - `out-of-order-sequence` — append below the expected sequence (not a
 *   duplicate of an existing event);
 * - `duplicate-sequence` — append at an already-logged sequence;
 * - `unknown-parent` — causal parent does not exist (in this stream);
 * - `causal-cycle` — causal parent is the event itself or a later event;
 * - `unknown-stream` — read/resolve of a stream that does not exist.
 */
export type EventLogError =
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly EventLogIssue[];
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
      readonly streamId: EventStreamId;
    }
  | {
      readonly code: 'sequence-gap';
      readonly message: string;
      readonly streamId: EventStreamId;
      readonly expectedSequence: EventSequence;
      readonly encounteredSequence: EventSequence;
    }
  | {
      readonly code: 'out-of-order-sequence';
      readonly message: string;
      readonly streamId: EventStreamId;
      readonly expectedSequence: EventSequence;
      readonly encounteredSequence: EventSequence;
    }
  | {
      readonly code: 'duplicate-sequence';
      readonly message: string;
      readonly streamId: EventStreamId;
      readonly sequence: EventSequence;
    }
  | {
      readonly code: 'unknown-parent';
      readonly message: string;
      readonly streamId: EventStreamId;
      readonly parentSequence: EventSequence;
    }
  | {
      readonly code: 'causal-cycle';
      readonly message: string;
      readonly streamId: EventStreamId;
      readonly sequence: EventSequence;
      readonly parentSequence: EventSequence;
    }
  | {
      readonly code: 'unknown-stream';
      readonly message: string;
      readonly streamId: EventStreamId;
    };

/** Total-result wrapper of every event-log entry point. */
export type EventLogResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EventLogError };

/**
 * A deterministic, serialization-friendly projection of a whole log:
 * stream infos sorted by streamId ascending, records sorted by
 * (streamId, sequence). Two logs containing the same events always emit
 * byte-identical snapshots, regardless of append order (no
 * insertion-order leaks).
 */
export interface EventLogSnapshot {
  readonly schemaVersion: typeof EVENT_LOG_RECORD_VERSION;
  readonly streams: readonly StreamInfo[];
  readonly records: readonly EventRecord[];
}

/** Options of snapshot restoration (`EventLog.fromSnapshot`): the log-level tenant guard, applied to every restored record. */
export type RestoreOptions = EventLogOptions;
