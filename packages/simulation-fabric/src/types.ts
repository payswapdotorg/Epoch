/**
 * @epoch/simulation-fabric — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/schema.ts` holds the runtime zod validators;
 * `src/parity.ts` proves at compile time that those validators infer
 * exactly these types; `test/contract-drift.test.ts` proves the committed
 * JSON Schema files under `schemas/` are byte-identical to the
 * deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * kind-prefixed; no field encodes a simulation vendor, grid, cloud, or
 * engine. The fabric owns the EXECUTION MODEL only — simulation semantics
 * (registration, invocation, result, conformance) are
 * @epoch/simulation-protocol's authority (W005), consumed verbatim and
 * never re-declared; capabilities are @epoch/capability-registry's (W007),
 * bound by opaque typed reference and never structurally copied; events
 * are @epoch/event-log-shaped (W010), mirrored structurally (the W036
 * precedent); evidence/verification digest grammars are @epoch/evidence's
 * and @epoch/verification's (W006), pinned by compile-time parity; the
 * tenant grammar is @epoch/tenancy's (W009), composed at runtime.
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type {
  InvocationReference,
  SimulationFailure,
  SimulationInvocationRequest,
  SimulatorReference,
  SimulatorRegistration,
} from '@epoch/simulation-protocol';
import type { SIMULATION_FABRIC_RECORD_VERSION } from './version';
import type { RunTransitionCause, SimulationRunStatus } from './version';

/** Simulation run identity (`simrun:<slug>`, derived content-addressed). */
export type SimulationRunId = string;

/** Simulation job identity (`simjob:<slug>`, a caller-supplied opaque handle). */
export type SimulationJobId = string;

/** Acting principal (`principal:<slug>`, the W009/W010 actor grammar). */
export type FabricPrincipalId = string;

/** A submission idempotency key (caller-supplied or content-derived). */
export type FabricIdempotencyKey = string;

/** Tenant scope of a fabric document (`tenant:<slug>`, the W009 grammar). */
export type FabricTenantId = TenantId;

/**
 * An opaque TYPED REFERENCE to a W007 capability registration: the
 * capability id and semver version plus the registration's content
 * address (the manifest digest). A run binds capabilities by this
 * reference ONLY — structural copies of registry records (descriptors,
 * display names, trust surfaces) are rejected by the strict-object
 * validators (`vendor-fields-rejected`).
 */
export interface CapabilityBindingRef {
  readonly capabilityId: string;
  readonly version: string;
  /** The W007 registration's manifest digest (opaque exact-revision pin). */
  readonly registrationDigest: Sha256Hex;
}

/**
 * The resolution-seam alias: what the fabric needs to know about an
 * ADMITTED capability registration (opaque — the service layer adapts the
 * real W007 registry to this shape; the kernel never imports the registry).
 */
export type AdmittedCapabilityBinding = CapabilityBindingRef;

/**
 * One typed run-state transition: the cause, the acting principal
 * (provenance), and the caller-supplied instant. The genesis record's
 * `from` is `null` (nothing precedes submission).
 */
export interface RunTransition {
  readonly from: SimulationRunStatus | null;
  readonly to: SimulationRunStatus;
  readonly cause: RunTransitionCause;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/**
 * One SEALED, content-addressed run-state record (the W023 version-chain
 * convention). States are append-only: a transition appends a new record,
 * never mutates an existing one. `previousRunDigest` chains to the
 * previous state record's digest of the SAME run (null on the genesis
 * record); `stateDigest` is the SHA-256 of this record's canonical JSON
 * (its exact-revision content address). `verifyRunStateChain` walks the
 * chain and rejects tampered digests and broken links.
 */
export interface SimulationRunState {
  readonly schema: 'epoch.simulation-fabric.run-state';
  readonly schemaVersion: typeof SIMULATION_FABRIC_RECORD_VERSION;
  readonly runId: SimulationRunId;
  /** The run's stable identity digest (binds tenant + invocation + simulator + bindings). */
  readonly runDigest: Sha256Hex;
  readonly status: SimulationRunStatus;
  readonly transition: RunTransition;
  /** Digest of the previous state record of this run; null on the genesis record. */
  readonly previousRunDigest: Sha256Hex | null;
  /** SHA-256 of this state record's canonical JSON (its content address). */
  readonly stateDigest: Sha256Hex;
}

/**
 * A sealed simulation result: the admitted W005 `SimulationResult`
 * document plus its canonical digest (the exact-revision address of the
 * prediction artifact — the same digest the W005 admission pipeline
 * computes). Present on a run exactly when its status is `completed`.
 */
export interface SealedSimulationResult {
  readonly result: import('@epoch/simulation-protocol').SimulationResult;
  readonly resultDigest: Sha256Hex;
}

/**
 * A simulation run: the tenant-scoped, append-only execution of ONE W005
 * invocation against an exact simulator registration revision. The run's
 * identity is content-addressed ({@link SimulationRun.runDigest} over the
 * canonical invocation payload + tenant + simulator pin + capability
 * bindings); its supervision history is the sealed state chain. Plain
 * JSON, serialization-friendly by construction.
 */
export interface SimulationRun {
  readonly schemaVersion: typeof SIMULATION_FABRIC_RECORD_VERSION;
  readonly runId: SimulationRunId;
  readonly runDigest: Sha256Hex;
  readonly tenantId: FabricTenantId;
  readonly status: SimulationRunStatus;
  /** Exact-revision reference to the invocation request (W005 shape). */
  readonly invocation: InvocationReference;
  /** Exact-revision reference to the simulator registration (W005 shape). */
  readonly simulator: SimulatorReference;
  /** Capability registrations bound by opaque typed reference (sorted, duplicate-free). */
  readonly capabilityBindings: readonly CapabilityBindingRef[];
  readonly idempotencyKey: FabricIdempotencyKey;
  /** The append-only sealed state chain (index 0 = the genesis submitted record). */
  readonly states: readonly SimulationRunState[];
  /** Digest of the CURRENT (latest) state record. */
  readonly stateDigest: Sha256Hex;
  /** The sealed result; present exactly when `status === 'completed'`. */
  readonly result?: SealedSimulationResult | undefined;
  /** The execution failure (W005 failure shape); present exactly when `status === 'failed'`. */
  readonly failure?: SimulationFailure | undefined;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/** The outcome of an execution entry point (`executeRun` / `ingestResult`). */
export interface ExecutionOutcome {
  /**
   * `executed` — this call drove the run to a terminal status.
   * `replayed-result` — the invocation was already completed under the
   * same idempotency key; the SEALED PRIOR RESULT is returned and the
   * state is unchanged (idempotent replay, no port call).
   */
  readonly disposition: 'executed' | 'replayed-result';
  readonly run: SimulationRun;
  /** The sealed result; present exactly when the run reached `completed`. */
  readonly result?: SealedSimulationResult | undefined;
  /** The execution failure; present exactly when the run reached `failed`. */
  readonly failure?: SimulationFailure | undefined;
}

// --------------------------------------------------------------------------------
// The simulation:* event vocabulary over the W010 event shapes (structural
// mirror — src/events.ts; the W036 delivery-event precedent).
// --------------------------------------------------------------------------------

/** One simulation event sequence number (1-based, contiguous per stream). */
export type SimulationEventSequence = number;

/** The causal parent reference of a simulation event (strictly earlier; W010 shape). */
export interface SimulationCausalParent {
  readonly streamId: string;
  readonly sequence: SimulationEventSequence;
}

/** The typed payload of one simulation event (W010 shape). */
export interface SimulationEventPayload {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, import('@epoch/agent-protocol').JsonValue>>;
}

/**
 * The immutable content of one simulation event — the STRUCTURAL MIRROR of
 * W010's `EventContent` (pinned type-equal at compile time by
 * src/kernel-parity.ts and digest-identical at runtime by the parity
 * tests). One run's lifecycle events form ONE stream
 * (`stream:simulation-<suffix>`); events are FACTS — no mutation API.
 */
export interface SimulationEventContent {
  readonly schemaVersion: typeof import('./version').SIMULATION_EVENT_RECORD_VERSION;
  readonly streamId: string;
  readonly sequence: SimulationEventSequence;
  readonly tenantId: FabricTenantId;
  readonly actor: FabricPrincipalId;
  readonly causalParent: SimulationCausalParent | null;
  readonly payload: SimulationEventPayload;
  readonly occurredAt: Timestamp;
}

/** The SEALED simulation event record: content plus its content address. */
export interface SealedSimulationEvent extends SimulationEventContent {
  readonly contentDigest: Sha256Hex;
}

// --------------------------------------------------------------------------------
// The execution-port adapter seam (lock rule 13: provider semantics are
// adapterized; the core never names a vendor).
// --------------------------------------------------------------------------------

/** What the fabric hands an execution port: the admitted W005 chain plus the run's bindings. */
export interface AdmittedInvocation {
  readonly request: SimulationInvocationRequest;
  readonly registration: SimulatorRegistration;
  readonly capabilityBindings: readonly CapabilityBindingRef[];
}

/**
 * One port execution outcome: either a W005 `simulation.result` document
 * (raw JSON — the fabric admits it through the REAL W005 pipeline and
 * checks conformance before sealing), or a typed execution failure in the
 * W005 failure vocabulary.
 */
export type PortExecution =
  | { readonly ok: true; readonly result: unknown }
  | { readonly ok: false; readonly failure: SimulationFailure };

/**
 * THE adapter seam: all concrete compute (solver engines, grids, clouds,
 * co-simulation bridges) lives behind this port. The fabric core never
 * names a vendor, never transports, and never executes anything itself —
 * it plans, supervises, and ingests. ONE in-memory reference adapter
 * ships inside this package (src/port.ts); external backends are
 * adapters, NEVER core types.
 */
export interface SimulationExecutionPort {
  execute(invocation: AdmittedInvocation): PortExecution;
}

// --------------------------------------------------------------------------------
// Host snapshot (deterministic, serialization-friendly).
// --------------------------------------------------------------------------------

/** One hosted run's bookkeeping: the run, its admitted W005 chain, and its event stream. */
export interface FabricRunEntry {
  readonly run: SimulationRun;
  readonly request: SimulationInvocationRequest;
  readonly registration: SimulatorRegistration;
  readonly events: readonly SealedSimulationEvent[];
}

/** One consumed idempotency-key record (the replay bookkeeping). */
export interface IdempotencyRecord {
  readonly tenantId: FabricTenantId;
  readonly idempotencyKey: FabricIdempotencyKey;
  readonly runId: SimulationRunId;
  readonly runDigest: Sha256Hex;
}

/**
 * A deterministic, serialization-friendly projection of a whole fabric:
 * entries sorted by (tenantId, runId), idempotency records sorted by
 * (tenantId, idempotencyKey). Two fabrics fed the same submissions hold
 * byte-identical snapshots (no insertion-order leaks).
 */
export interface SimulationFabricSnapshot {
  readonly schemaVersion: typeof SIMULATION_FABRIC_RECORD_VERSION;
  readonly entries: readonly FabricRunEntry[];
  readonly idempotency: readonly IdempotencyRecord[];
}
