/**
 * @epoch/adapter-fmi — public API (service layer, Work Order W029).
 *
 * The co-simulation participant REFERENCE adapter (the co-simulation
 * standard's vocabulary is quarantined in src/provider). One W007
 * surface:
 *
 * - SIMULATION: typed participants (declared, value-kinded, unit-carrying
 *   ports) execute deterministic, content-addressed step exchanges —
 *   identical inputs produce identical step digests; step replay is
 *   idempotent (the sealed prior step); different content under the
 *   same key is the typed `replay-conflict`. Participants derive REAL
 *   W005 simulator registrations and execute behind the W021
 *   simulation-fabric execution-port seam (devDependency parity).
 *
 * Cross-cutting invariants (tested): tenant isolation
 * (tenant-isolation-rejected), tamper detection (digest-mismatch),
 * port conformance (port-conformance-rejected -> the W005
 * input-out-of-domain vocabulary), determinism, provider neutrality
 * (per-adapter blocklist), and W007 registration under the simulation
 * category.
 *
 * In-memory reference behavior: NO network, NO live co-simulation
 * runtimes, NO real side effects — fixtures stand in for provider
 * payloads. Zero wall-clock, zero randomness (step instants derive
 * deterministically from the step number).
 *
 * Runtime dependency policy (W029 Tech Lead pin, frozen):
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/simulation-protocol,
 * @epoch/tenancy, and zod — NOTHING else at runtime. Compatibility with
 * @epoch/capability-registry, @epoch/evidence, @epoch/event-log,
 * @epoch/action-policy and the W021 simulation-fabric service types is
 * exercised via devDependencies + compile-time parity (src/parity.ts) +
 * runtime parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  FMI_ADAPTER_CATEGORIES,
  FMI_ADAPTER_CONTRACT_VERSION,
  FMI_ADAPTER_RECORD_VERSION,
  FMI_SIMULATION_CONTRACT_ID,
  PORT_DIRECTIONS,
  PORT_VALUE_KINDS,
  STEP_DISPOSITIONS,
} from './version';
export type {
  PortDirection,
  PortValueKind,
  StepDisposition,
} from './version';

// Published contract types (the NEUTRAL seam).
export type {
  ParticipantPort,
  ParticipantSimulatorRegistration,
  ParticipantState,
  StepExchange,
  TypedParticipant,
} from './types';

// Typed error taxonomy (values, never thrown).
export type {
  FmiAdapterError,
  FmiAdapterErrorCode,
  FmiAdapterIssue,
  FmiAdapterResult,
} from './errors';

// Runtime validators (the NEUTRAL seam).
export {
  ParticipantIdSchema,
  ParticipantPortSchema,
  ParticipantStateSchema,
  StepExchangeSchema,
  StepInputSchema,
  TypedParticipantSchema,
} from './schema';

// The provider seam (the standard's vocabulary — fixtures + payload parsing).
export {
  PROVIDER_CAUSALITIES,
  PROVIDER_DESCRIPTOR_VERSION,
  PROVIDER_STANDARD_NAME,
  PROVIDER_STANDARD_VERSIONS,
  ProviderParticipantSchema,
  ProviderVariableSchema,
  neutralParticipantIdOf,
  parseProviderParticipant,
} from './provider/payload';
export type {
  ProviderParticipant,
  ProviderParticipantParse,
  ProviderVariable,
} from './provider/payload';
export {
  conflictingParticipant,
  malformedParticipant,
  outputlessParticipant,
  referenceParticipant,
} from './provider/fixtures';

// The typed participant model (projection + deterministic step semantics).
export {
  computeStep,
  descriptorDigestOf,
  initialStateOf,
  parametersOf,
  portConformanceGate,
  portsOfDirection,
  projectParticipant,
  verifyParticipant,
  verifyStep,
} from './participant';
export type { PortConformanceInput, ProjectionInput } from './participant';

// The W005 simulator-registration derivation (the fabric-facing seam).
export {
  REGISTRATION_INSTANT,
  deriveParticipantRegistration,
  deriveSimulatorRegistration,
  registrationDigestOf,
  simulatorIdOf,
} from './registration';
export type { DeriveRegistrationInput } from './registration';

// The W007 adapter surface + the participant host.
export { FmiAdapterHost, FmiSimulationAdapter } from './adapters';
export type {
  AdmitParticipantInput,
  StepInput,
} from './adapters';

// W007 descriptor discipline + capability-registration derivation (content-addressed, standard-neutral).
export {
  CAPABILITY_VERSION,
  SIMULATION_ADAPTER_DESCRIPTOR,
  SIMULATION_ADAPTER_DESCRIPTOR_DIGEST,
  deriveCapabilityRegistrations,
} from './descriptor';
export type {
  DerivedCapabilityManifest,
  DerivedCapabilityRegistration,
} from './descriptor';
