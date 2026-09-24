/**
 * Epoch Simulation Protocol v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * IN-PACKAGE ownership boundary `packages/simulation-protocol/contracts/`
 * (Work Order W005 — W005 owns no repository-root `contracts/*`
 * directory, so the versioned contract surface is published inside the
 * package). It is self-contained: no imports, no runtime code, no
 * vendor/framework/engine vocabulary. The runtime implementation lives in
 * `@epoch/simulation-protocol` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's inferred
 * types are identical to these declarations.
 *
 * Simulation predicts; evaluation judges (evaluation is owned by
 * `@epoch/evaluation-protocol`). Simulators remain external capabilities
 * (architecture lock rule 5): this surface declares registration,
 * invocation, and result message shapes — never an engine, never an
 * execution fabric.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every message as `protocolVersion`)
 */

/**
 * Mirrored shared primitives (owned and versioned at `contracts/agent`);
 * redeclared here so this contract surface is self-contained. They MUST
 * stay structurally identical — enforced by parity assertions against
 * `@epoch/simulation-protocol`, whose message shapes embed them.
 */

/** UTC instant in canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export type Timestamp = string;

/** Opaque message identifier (unique within the emitting scope; UUIDs fit). */
export type MessageId = string;

/** JSON-representable value (finite numbers only). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Value kinds a simulator input/output parameter can carry. */
export type ParameterKind =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'entity-reference'
  | 'json';

/**
 * A named simulator input/output parameter. `enumValues` is present if
 * and only if `kind` is `"enum"`; `unit` may only be present for the
 * numeric kinds (runtime refinements).
 */
export type ParameterSpec = {
  name: string;
  kind: ParameterKind;
  required: boolean;
  description: string;
  enumValues?: string[] | undefined;
  unit?: string | undefined;
};

/**
 * Cost profile. `basis: "none"` means no cost accounting applies; every
 * other basis requires exactly one ISO 4217 currency and one non-negative
 * decimal amount string. (Basis vocabulary is shared with the agent
 * contract; `per-proposal` covers per-invocation accounting here.)
 */
export type CostProfile =
  | { basis: 'none' }
  | { basis: 'per-proposal'; currency: string; amount: string }
  | { basis: 'per-session'; currency: string; amount: string }
  | { basis: 'per-hour'; currency: string; amount: string };

/** Latency profile in whole milliseconds (p95 >= p50, runtime refinement). */
export type LatencyProfile = {
  p50Milliseconds: number;
  p95Milliseconds: number;
};

/** Exact simulation-protocol version admitted by contract version 1.0.0. */
export type SimulationProtocolVersion = '1.0.0';

/** Discriminating message kinds of the simulation protocol. */
export type SimulationMessageKind =
  | 'simulation.registration'
  | 'simulation.invocation-request'
  | 'simulation.result';

/** Registered simulator identifier: `simulator:` + lowercase slug. */
export type SimulatorId = string;

/**
 * Declared fidelity: a summary of the fidelity level plus the list of
 * known systematic deviations (an empty list is the explicit claim
 * "none known").
 */
export type FidelityProfile = {
  summary: string;
  knownDeviations: string[];
};

/**
 * Declared validity domain: summary, at least one included scope, and
 * explicitly excluded regimes. An empty `includes` list is an
 * unregistrable non-declaration (runtime refinement).
 */
export type ValidityDomain = {
  summary: string;
  includes: string[];
  excludes: string[];
};

/** How a simulator handles seeds (neutral vocabulary). */
export type SeedPolicy = 'not-applicable' | 'external-seed' | 'internal-seed';

/**
 * Reproducibility declaration. `deterministic` is the digest-stability
 * claim: the same invocation request (exact revision, including any
 * external seed) always produces the same canonical result digest.
 * Runtime refinement: `deterministic: false` combined with
 * `internal-seed` is contradictory and rejected.
 */
export type ReproducibilityProfile = {
  deterministic: boolean;
  seedPolicy: SeedPolicy;
};

/**
 * The simulator registration message (`messageKind:
 * "simulation.registration"`): one provider-neutral declaration of a
 * simulator's contract — inputs, outputs, fidelity, validity domain,
 * assumptions, reproducibility, cost and latency. A simulator that cannot
 * declare its validity domain and assumptions is not registrable: both
 * are required and non-empty. Unknown fields are rejected (strict
 * objects), so no engine- or solver-specific field can be smuggled into a
 * registration.
 */
export type SimulatorRegistration = {
  protocolVersion: SimulationProtocolVersion;
  messageKind: 'simulation.registration';
  messageId: MessageId;
  createdAt: Timestamp;
  simulatorId: SimulatorId;
  displayName: string;
  description?: string | undefined;
  inputs: ParameterSpec[];
  outputs: ParameterSpec[];
  fidelity: FidelityProfile;
  validityDomain: ValidityDomain;
  assumptions: string[];
  reproducibility: ReproducibilityProfile;
  costProfile: CostProfile;
  latencyProfile: LatencyProfile;
};

/**
 * Exact-revision reference to a registered simulator: the simulator id
 * plus the SHA-256 digest of the registration's canonical JSON.
 */
export type SimulatorReference = {
  simulatorId: SimulatorId;
  registrationDigest: string;
};

/**
 * The simulation invocation request message (`messageKind:
 * "simulation.invocation-request"`): a request to run a registered
 * simulator at an exact registration revision, with named inputs and an
 * optional seed. At least one input is required (runtime refinement);
 * seed discipline (`external-seed` requires a seed, other policies forbid
 * one) is enforced by the runtime conformance checks.
 */
export type SimulationInvocationRequest = {
  protocolVersion: SimulationProtocolVersion;
  messageKind: 'simulation.invocation-request';
  messageId: MessageId;
  createdAt: Timestamp;
  requestId: MessageId;
  simulator: SimulatorReference;
  inputs: { [key: string]: JsonValue };
  seed?: number | undefined;
  notes?: string | undefined;
};

/**
 * Exact-revision reference to an invocation request: the request id plus
 * the SHA-256 digest of the request's canonical JSON.
 */
export type InvocationReference = {
  requestId: MessageId;
  requestDigest: string;
};

/** Machine-readable simulation failure codes (protocol-level, neutral). */
export type SimulationFailureCode =
  | 'input-out-of-domain'
  | 'numerical-divergence'
  | 'resource-limit-exceeded'
  | 'internal-error';

/** A simulation failure with a machine-readable code and required reason. */
export type SimulationFailure = {
  code: SimulationFailureCode;
  message: string;
};

/** Outcome status of a simulation run. */
export type SimulationResultStatus = 'completed' | 'failed';

/** A completed run: at least one named output value. */
export type CompletedSimulationResult = {
  status: 'completed';
  outputs: { [key: string]: JsonValue };
};

/** A failed run: machine-readable failure, no outputs. */
export type FailedSimulationResult = {
  status: 'failed';
  failure: SimulationFailure;
};

/** The exhaustive run outcome union. */
export type SimulationOutcome = CompletedSimulationResult | FailedSimulationResult;

/**
 * The simulation result message (`messageKind: "simulation.result"`): the
 * prediction artifact for one admitted invocation request. Carries NO
 * wall-clock or measurement fields — a deterministic simulator's result
 * digest must be a pure function of the request digest (digest
 * stability). `resultId` is opaque (deterministic simulators derive it
 * from the request digest); `deterministic` mirrors the registration and
 * is conformance-checked.
 */
export type SimulationResult = {
  protocolVersion: SimulationProtocolVersion;
  messageKind: 'simulation.result';
  resultId: MessageId;
  request: InvocationReference;
  simulator: SimulatorReference;
  outcome: SimulationOutcome;
  deterministic: boolean;
};
