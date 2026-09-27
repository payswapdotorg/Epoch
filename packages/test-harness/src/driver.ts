/**
 * The ScenarioDriver contract: the ONLY seam through which the scenario
 * engine touches the outside world.
 *
 * The harness NEVER mocks Epoch kernels and NEVER imports kernel
 * internals. The TEST TREE provides the driver: an object whose `runStep`
 * dispatches one declared driver operation against REAL workspace kernels
 * (composed as devDependencies of the test tree) through their public
 * admission paths, and reports the outcome in the typed `StepReport`
 * shape below. External providers stay fixture-driven per their own
 * adapters' reference behavior (the W029 precedent).
 *
 * Everything the driver reports must be DERIVED DATA (digests, ids, typed
 * errors): the runner records it in the trace and the invariant library
 * verifies it. A driver must be deterministic: two runs of the same
 * scenario against the same driver produce byte-identical traces — which
 * is exactly what the runner's double-run asserts.
 */
import type { JsonValue } from '@epoch/agent-protocol';
import type { CallStep, ScenarioDefinition } from './scenario';

/** The typed cross-tenant denial shape (R12) as kernels surface it. */
export interface DenialRecord {
  readonly code: string;
  readonly expectedTenantId: string;
  readonly encounteredTenantId: string;
}

/** The typed authority-routing rejection shape. */
export interface AuthorityRejection {
  readonly code: string;
  readonly message: string;
}

/** One event a step emitted (already sealed by the emitting kernel). */
export interface EmittedEventRecord {
  readonly streamId: string;
  readonly sequence: number;
  readonly discriminator: string;
  readonly contentDigest: string;
}

/** One digest-bearing record a step produced (for provenance verification). */
export interface ProvenanceRecord {
  readonly content: JsonValue;
  readonly claimedDigest: string;
  /** The parent digest this record chains to (null = chain root). */
  readonly parentDigest: string | null;
}

/** Canonical ids observed on one projection surface during a step. */
export interface IdentityObservation {
  readonly surface: string;
  readonly ids: readonly string[];
}

/** The observed outcome class of a call step. */
export type StepOutcome = 'ok' | 'denied' | 'authority-rejected' | 'rejected';

/** The typed report a driver returns for one executed step. */
export interface StepReport {
  readonly stepId: string;
  /** The kernel call returned ok (true) or a typed error (false). */
  readonly ok: boolean;
  /** Canonical digest of the ok value (null when the call failed). */
  readonly valueDigest: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  /** The typed cross-tenant denial, when the boundary produced one. */
  readonly denial: DenialRecord | null;
  /** The typed authority-routing rejection, when a bypass was rejected. */
  readonly authorityRejection: AuthorityRejection | null;
  /** Events emitted by this step (each already sealed + digest-bearing). */
  readonly events: readonly EmittedEventRecord[];
  /** Digest-bearing records produced by this step (verify + chain). */
  readonly provenance: readonly ProvenanceRecord[];
  /** Canonical ids observed on projection surfaces during this step. */
  readonly identities: readonly IdentityObservation[];
}

/** The result of one driver step: the (possibly new) world + the report. */
export interface StepResult<World> {
  readonly world: World;
  readonly report: StepReport;
}

/** Context handed to the driver for one step. */
export interface StepContext {
  readonly scenario: ScenarioDefinition;
  readonly stepIndex: number;
  /** The reports of every previously executed step, in order. */
  readonly priorReports: readonly StepReport[];
}

/**
 * The driver contract. `World` is the driver's own composed state (opaque
 * to the harness — the driver owns the world it creates in `begin`).
 *
 * CONTRACT (violations are DriverContractError, never silent):
 *   - `driverOps` lists every driverOp `runStep` accepts;
 *   - `stateDigest(world)` is a PURE digest over the composed world state
 *     (the runner calls it after `begin` and after every step; a step
 *     that changes nothing must return an identical digest);
 *   - `runStep` returns the world to carry forward (immutable kernels
 *     return a new world; no-ops return the same one) plus the typed
 *     report of DERIVED data only.
 */
export interface ScenarioDriver<World = unknown> {
  /** Stable driver name (recorded in every trace). */
  readonly name: string;
  /** Every driverOp this driver accepts (call steps are checked against it). */
  readonly driverOps: readonly string[];
  /** Build a fresh world for one scenario run (all setup happens here). */
  begin(scenario: ScenarioDefinition): World;
  /** Pure digest over the composed world state (deterministic, canonical). */
  stateDigest(world: World): string;
  /** Execute one call step against the world, reporting derived data only. */
  runStep(world: World, step: CallStep, context: StepContext): StepResult<World>;
}

/**
 * Typed failure of the engine itself (never a kernel failure): an unknown
 * driverOp or a driver contract violation. Kernel-side outcomes always
 * travel as typed `StepReport` data.
 */
export class DriverContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverContractError';
  }
}

/** Guard: a step is a call step. */
export function isCallStep(step: { kind: string }): step is CallStep {
  return step.kind === 'call';
}
