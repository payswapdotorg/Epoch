/**
 * @epoch/adapter-sdk — public API (kernel layer, Work Order W007).
 *
 * The Adapter SDK: the typed interfaces concrete Capability Fabric
 * adapters implement. Provider-NEUTRAL by construction (lock rule 13)
 * — any vendor/provider/model/API surface is a property of concrete
 * adapters (W029's Git/IFC/MCP/FMI reference set and later marketplace
 * adapters), NEVER of these contracts. The SDK ships ZERO concrete
 * adapters and ZERO Wasm/runtime machinery (the extension runtime is
 * W008's surface).
 *
 * - Per-category adapter contracts: typed request/response envelopes
 *   discriminated by the eight Capability Fabric categories, with
 *   payloads structurally aligned to the frozen W003/W005/W006 contract
 *   shapes where they meet (pinned by devDependency parity tests —
 *   NO runtime coupling; @epoch/agent-protocol is the only @epoch
 *   runtime dependency).
 * - Capability binding: an adapter declares which capability id + version
 *   range it serves; `negotiateBinding` / `negotiateBestBinding` check
 *   the binding at bind time and produce an exact, content-addressed
 *   `BindingPin` (capability manifest digest + adapter descriptor
 *   digest) — or a typed error. Never a guess.
 * - Deterministic descriptor serialization: canonical JSON + SHA-256
 *   content addressing.
 * - Typed error taxonomy: validation, unknown-capability,
 *   version-unsatisfied, lifecycle-conflict, binding-conflict — with
 *   precise paths, as values (never thrown).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ACTION_FAILURE_CODES,
  ADAPTER_DESCRIPTOR_VERSION,
  ADAPTER_ENVELOPE_VERSION,
  ADAPTER_SDK_CONTRACT_VERSION,
} from './version';

// Published contract types.
export type {
  ActionAdapter,
  ActionRequestPayload,
  ActionResponsePayload,
  AdapterDescriptor,
  AdapterId,
  AdapterRequest,
  AdapterRequestEnvelope,
  AdapterRequestPayloads,
  AdapterResponse,
  AdapterResponseEnvelope,
  AdapterResponsePayloads,
  AdapterSdkError,
  AdapterSdkErrorCode,
  AdapterSdkIssue,
  AdapterSdkResult,
  BindableCapability,
  BindingPin,
  CapabilityAdapter,
  CapabilityBinding,
  CapabilityCategory,
  CapabilityLifecycleState,
  CapabilityVersionRange,
  EvaluatorAdapter,
  EvaluatorRequestPayload,
  EvaluatorResponsePayload,
  JustificationReference,
  NeutralRequestPayload,
  NeutralResponsePayload,
  ReconstructionAdapter,
  SemanticAdapter,
  SimulationAdapter,
  SimulationFailureCode,
  SimulationRequestPayload,
  SimulationResponsePayload,
  SourceAdapter,
  VerificationAdapter,
  VerificationRequestPayload,
  VerificationResponsePayload,
  VisualizationAdapter,
} from './types';

// Runtime validators.
export {
  ADAPTER_ID_PATTERN,
  ActionRequestPayloadSchema,
  ActionResponsePayloadSchema,
  AdapterDescriptorSchema,
  AdapterDescriptorVersionSchema,
  AdapterEnvelopeVersionSchema,
  AdapterIdSchema,
  AdapterRequestSchema,
  AdapterResponseSchema,
  BindableCapabilitySchema,
  BindingPinSchema,
  CapabilityBindingSchema,
  CapabilityCategorySchema,
  CapabilityLifecycleStateSchema,
  EvaluatorRequestPayloadSchema,
  EvaluatorResponsePayloadSchema,
  NeutralRequestPayloadSchema,
  NeutralResponsePayloadSchema,
  SHA256_HEX_PATTERN,
  SemverCoreSchema,
  SimulationRequestPayloadSchema,
  SimulationResponsePayloadSchema,
  VerificationRequestPayloadSchema,
  VerificationResponsePayloadSchema,
  VersionConstraintSchema,
} from './schema';

// Semantic-version machinery (self-contained, parity-pinned against
// @epoch/capability-registry — see src/semver.ts).
export {
  compareSemver,
  parseSemverCore,
  satisfiesVersionConstraint,
  type SemverParse,
  type SemverParts,
  type VersionConstraint,
} from './semver';

// Total parse surface.
export { parseAdapterRequest, parseAdapterResponse } from './parse';
export { parseAdapterDescriptor, validateAdapterDescriptor } from './descriptor';

// Descriptor discipline (deterministic serialization + content addressing).
export {
  computeAdapterDescriptorDigest,
  serializeAdapterDescriptor,
} from './descriptor';

// Bind-time version negotiation.
export { negotiateBestBinding, negotiateBinding } from './negotiation';

// Compile-time contract parity (type-only).
export type {
  AdapterSdkEnvelopeSync,
  AdapterSdkLiteralSync,
  AdapterSdkSchemaSync,
} from './parity';

// Published schema surface + contract emission.
export { ADAPTER_SDK_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  ADAPTER_SDK_CONTRACT_DIR,
  renderAdapterSdkContractFiles,
  typeToKebabCase,
} from './contract-emission';
