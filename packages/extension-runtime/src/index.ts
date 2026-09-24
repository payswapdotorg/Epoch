/**
 * @epoch/extension-runtime — public API (kernel layer, Work Order W008).
 *
 * The sandboxed HOST machinery model for capability-scoped extension
 * hosting (architecture lock rules 9/10): admission with digest
 * verification and capability-registry binding resolution, permission
 * enforcement at the boundary (grant checks on EVERY host call, typed
 * denials with precise paths), typed invocation envelopes, in-memory
 * reference host state (deterministic defaults, injectable external
 * providers), and deterministic execution-surface descriptions.
 *
 * - NO persistence, NO UI, NO workflow engine, NO network.
 * - Runtime dependencies are exactly @epoch/agent-protocol and
 *   @epoch/capability-registry (genuine composition). The
 *   @epoch/extension-sdk contract surface is consumed through the
 *   parity-pinned structural mirror (src/mirror.ts + src/schema.ts +
 *   src/parity.ts + test/sdk-parity.test.ts — devDependency only).
 * - runtimes/wasm (the Wasm Component Model host-side layout
 *   machinery) is exercised through this package's vitest project and
 *   tsconfig.wasm.json (the contracts/* non-package-directory
 *   precedent).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection
 * under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + host-side vocabularies.
export {
  EXTENSION_INVOCATION_ENVELOPE_VERSION,
  EXTENSION_RUNTIME_CONTRACT_VERSION,
  HOST_EXECUTION_FAILURE_CODES,
  PERMISSION_DENIED_REASONS,
  SANDBOX_SURFACE_DESCRIPTION_VERSION,
  SANDBOX_VIOLATION_DETAILS,
} from './version';
export type {
  HostExecutionFailureCode,
  PermissionDeniedReason,
  SandboxViolationDetail,
} from './version';

// Published types.
export type {
  AdmittedExtensionRecord,
  CapabilityInvoker,
  ExtensionDataHandlingView,
  ExtensionGrantView,
  ExtensionIdView,
  ExtensionManifestView,
  ExtensionRuntimeError,
  ExtensionRuntimeErrorCode,
  ExtensionRuntimeIssue,
  ExtensionRuntimeResult,
  EntryPointView,
  GrantDescription,
  HostClock,
  HostExecutionOutcome,
  HostInvocationEnvelope,
  HostRequestPayloads,
  InvokeResult,
  InvocationAuditRecord,
  ResolvedCapabilityBinding,
  SandboxSurfaceDescription,
  SessionEvidenceRecord,
  SessionLogRecord,
  WorldViewProvider,
} from './types';
export type {
  CapabilityBindView,
  ComponentFunctionView,
  ComponentInterfaceView,
  ExtensionSideEffectView,
  LayoutSectionView,
  RemoteOperationView,
  RemoteServiceDescriptorView,
  WasmComponentDescriptorView,
} from './types';

// Mirrored vocabulary (parity-pinned against @epoch/extension-sdk).
export {
  CONTRIBUTION_KINDS,
  DATA_HANDLING_CLASSIFICATIONS,
  EXTENSION_FLAVORS,
  EXTENSION_TRUST_CLASSES,
  HOST_FUNCTION_IDS,
  HOST_FUNCTION_REQUIRED_SCOPES,
  HOST_LOG_LEVELS,
  LEGAL_RESOURCE_SCOPES,
  REMOTE_TRANSPORT_KINDS,
  RESOURCE_ACCESSES,
  RESOURCE_DOMAINS,
  SIDE_EFFECT_KINDS,
  TRUST_CLASS_GRANT_CEILINGS,
  UI_SURFACE_KINDS,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
  grantExceedsCeiling,
} from './mirror';
export type { ResourceScopeMirror, TrustCeilingMirror } from './mirror';

// Runtime validators.
export {
  AdmittedExtensionRecordSchema,
  ExtensionManifestViewSchema,
  GrantDescriptionSchema,
  HostExecutionFailureCodeSchema,
  HostInvocationEnvelopeSchema,
  HostInvocationOutcomeSchema,
  InvocationAuditRecordSchema,
  ResolvedCapabilityBindingSchema,
  SandboxSurfaceDescriptionSchema,
} from './schema';

// Permission enforcement at the boundary (pure, total, typed denials).
export { enforceInvocation, isBoundCapability } from './enforcement';

// In-memory reference host state + injectable providers.
export {
  DEFAULT_CLOCK_INSTANT,
  InMemoryEvidenceBook,
  ExtensionStorageNamespace,
  SessionLogRing,
  cannedCapabilityInvoker,
  emptyWorldView,
  fixedClock,
  mapWorldView,
  unavailableCapabilityInvoker,
} from './state';

// The reference sandbox host (admission + lifecycle).
export {
  ExtensionSandboxHost,
  type ExtensionAdmissionInput,
  type ExtensionSandboxHostOptions,
} from './host';

// The sandboxed session (invoke + surface description + audit).
export { ExtensionSession } from './session';

// Total parse surface.
export { parseInvocationEnvelope, parseSandboxSurfaceDescription } from './parse';

// Compile-time contract parity (type-only; devDependency evidence).
export type {
  ExtensionRuntimeEnvelopeSync,
  ExtensionRuntimeErrorTaxonomySync,
  ExtensionRuntimeManifestMirrorSync,
  ExtensionRuntimePayloadMirrorSync,
} from './parity';

// Published schema surface + contract emission.
export { EXTENSION_RUNTIME_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  EXTENSION_RUNTIME_CONTRACT_DIR,
  renderExtensionRuntimeContractFiles,
  typeToKebabCase,
} from './contract-emission';
