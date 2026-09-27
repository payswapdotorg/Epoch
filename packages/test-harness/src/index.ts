/**
 * @epoch/test-harness — public API (W032).
 *
 * The Cross-domain Integration Harness: a typed, deterministic SCENARIO
 * ENGINE generalizing the W031 reference-slice pattern.
 *
 *   SCENARIO DSL  — declarative, content-addressed scenario definitions
 *                   (actors, fixtures, a typed step sequence, an identity
 *                   map, expected invariants), digest-stable serialization.
 *   DRIVER SEAM   — the typed ScenarioDriver contract: the ONLY way the
 *                   engine touches composed kernels. The harness never
 *                   mocks Epoch kernels and never imports kernel
 *                   internals; the TEST TREE composes the real kernels
 *                   (as its devDependencies) behind a driver.
 *   RUNNER        — executes a scenario, records the sealed, replayable
 *                   execution TRACE (per step: input digest, output
 *                   digest, events emitted, provenance, identity
 *                   observations, state-digest delta), double-runs for
 *                   replay determinism, and emits the typed RESULT record.
 *   INVARIANTS    — the reusable library: tenant isolation, provenance
 *                   chains, authority routing, identity preservation,
 *                   trace integrity, expectation conformance,
 *                   scenario round-trip, replay determinism.
 *   REPORTING     — machine-readable, content-addressed run records.
 *
 * Runtime dependency policy (W032 Tech Lead pin, frozen):
 * @epoch/agent-protocol (canonical digests), @epoch/tenancy (tenant-id
 * primitives) and zod — NOTHING else. The composed kernels are
 * devDependencies of the TEST trees, never of this library.
 *
 * Determinism: zero wall-clock, zero randomness, zero network. Two runs
 * of the same scenario against the same driver produce byte-identical
 * traces (asserted by the runner's built-in double-run).
 */

// Value primitives (digest discipline).
export {
  DIGEST_PATTERN,
  isDigest,
  canonicalJson,
  digestOf,
  digestRecord,
  jsonRoundTrip,
} from './values';
export type { JsonValue } from './values';

// The Scenario DSL.
export {
  SCENARIO_RECORD_VERSION,
  ScenarioActorSchema,
  ScenarioFixtureSchema,
  StepRouteSchema,
  StepExpectationSchema,
  CallStepSchema,
  AssertStepSchema,
  ScenarioStepSchema,
  IdentityBindingSchema,
  InvariantExpectationSchema,
  ScenarioDefinitionSchema,
  parseScenario,
  scenarioContent,
  scenarioDigest,
  serializeScenario,
  deserializeScenario,
} from './scenario';
export type {
  ScenarioActor,
  ScenarioFixture,
  StepRoute,
  StepExpectation,
  CallStep,
  AssertStep,
  ScenarioStep,
  IdentityBinding,
  InvariantExpectation,
  ScenarioDefinition,
  ScenarioParseError,
  DeserializedScenario,
} from './scenario';

// The driver seam.
export {
  DriverContractError,
  isCallStep,
} from './driver';
export type {
  DenialRecord,
  AuthorityRejection,
  EmittedEventRecord,
  ProvenanceRecord,
  IdentityObservation,
  StepOutcome,
  StepReport,
  StepResult,
  StepContext,
  ScenarioDriver,
} from './driver';

// The execution trace.
export {
  TRACE_RECORD_VERSION,
  traceContent,
  sealTrace,
  verifyTrace,
  serializeTrace,
  stepDigest,
  outcomeOf,
} from './trace';
export type {
  AssertFinding,
  TraceStepEntry,
  ExecutionTrace,
  TraceVerification,
} from './trace';

// The invariant library.
export {
  INVARIANT_IDS,
  RUN_LEVEL_INVARIANTS,
  TENANT_DENIAL_CODES,
  isRunLevelInvariant,
  evaluateInvariant,
  checkScenarioRoundTrip,
  checkReplayDeterminism,
  INVARIANT_CHECKS,
} from './invariants';
export type {
  InvariantId,
  InvariantFinding,
  InvariantContext,
  InvariantCheck,
  RunLevelEvidence,
  IdentityByIdArgument,
  IdentityBySurfaceArgument,
} from './invariants';

// The runner + result records.
export {
  runScenario,
} from './runner';
export type {
  RunScenarioOptions,
  ScenarioResult,
  ScenarioRun,
  RunOutcome,
} from './runner';

// The reporting surface.
export {
  renderRunReport,
  serializeRunReport,
  formatRunSummary,
  stepReportDigest,
  serializedScenarioOf,
} from './reporting';
export type { RunReportRecord } from './reporting';
