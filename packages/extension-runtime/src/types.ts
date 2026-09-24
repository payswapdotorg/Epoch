/**
 * @epoch/extension-runtime — published contract types (v1).
 *
 * The HOST-side machinery surface: invocation envelopes, execution
 * outcomes, the typed error taxonomy (the shared W008 taxonomy with
 * host-side permission/sandbox codes), the in-memory session/record
 * surfaces, and the deterministic sandbox surface description.
 *
 * The manifest/grant/entry-point shapes consumed at the boundary are
 * the runtime's MIRROR of the @epoch/extension-sdk contract types
 * (src/schema.ts infers exactly the *View types below; src/parity.ts +
 * test/sdk-parity.test.ts pin the structural compatibility — NO runtime
 * dependency, the W007 kernel-to-kernel pattern).
 */
import type {
  JsonValue,
  MessageId,
  Sha256Hex,
  Timestamp,
} from '@epoch/agent-protocol';
import type { CapabilityContractReference, VersionConstraint } from '@epoch/capability-registry';
import type {
  EXTENSION_FLAVORS,
  EXTENSION_TRUST_CLASSES,
  HOST_FUNCTION_IDS,
  HOST_LOG_LEVELS,
  ResourceScopeMirror,
} from './mirror';
import type {
  CONTRIBUTION_KINDS,
  DATA_HANDLING_CLASSIFICATIONS,
  REMOTE_TRANSPORT_KINDS,
  SIDE_EFFECT_KINDS,
  UI_SURFACE_KINDS,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
} from './mirror';
import type {
  HostExecutionFailureCode,
  PermissionDeniedReason,
  SandboxViolationDetail,
} from './version';

// ---------------------------------------------------------------------------
// Mirrored extension-manifest view (parity-pinned against the SDK).
// ---------------------------------------------------------------------------

/** Mirrored extension id (`extension:` + kebab slug). */
export type ExtensionIdView = string;

/** A mirrored capability binding. */
export interface CapabilityBindView {
  readonly capabilityId: string;
  readonly versionRange: VersionConstraint;
}

/** A mirrored declared grant (the allow-list unit). */
export interface ExtensionGrantView {
  readonly capabilityId: string;
  readonly hostFunctions: readonly HostFunctionIdView[];
  readonly resourceScopes: readonly ResourceScopeMirror[];
}

/** Mirrored host function id. */
export type HostFunctionIdView = (typeof HOST_FUNCTION_IDS)[number];

/** A mirrored side-effect declaration. */
export interface ExtensionSideEffectView {
  readonly kind: (typeof SIDE_EFFECT_KINDS)[number];
  readonly description: string;
}

/** Mirrored data handling. */
export interface ExtensionDataHandlingView {
  readonly classification: (typeof DATA_HANDLING_CLASSIFICATIONS)[number];
  readonly notes?: string | undefined;
}

/** Mirrored Wasm component descriptor. */
export interface WasmComponentDescriptorView {
  readonly schemaVersion: 1;
  readonly componentId: string;
  readonly componentVersion: string;
  readonly worldName: string;
  readonly imports: readonly ComponentInterfaceView[];
  readonly exports: readonly ComponentInterfaceView[];
  readonly sections: readonly LayoutSectionView[];
}

/** Mirrored component interface declaration. */
export interface ComponentInterfaceView {
  readonly interfaceName: string;
  readonly functions: readonly ComponentFunctionView[];
}

/** Mirrored component function declaration. */
export interface ComponentFunctionView {
  readonly functionName: string;
  readonly params: readonly { readonly name: string; readonly type: (typeof WASM_VALUE_TYPES)[number] }[];
  readonly result?: (typeof WASM_VALUE_TYPES)[number] | undefined;
}

/** Mirrored layout section. */
export interface LayoutSectionView {
  readonly name: string;
  readonly kind: (typeof WASM_SECTION_KINDS)[number];
  readonly byteSize: number;
  readonly contentDigest: Sha256Hex;
}

/** Mirrored remote operation declaration. */
export interface RemoteOperationView {
  readonly name: string;
  readonly inputs: readonly import('@epoch/agent-protocol').ParameterSpec[];
  readonly outputs: readonly import('@epoch/agent-protocol').ParameterSpec[];
}

/** Mirrored remote service descriptor. */
export interface RemoteServiceDescriptorView {
  readonly serviceId: string;
  readonly transport: (typeof REMOTE_TRANSPORT_KINDS)[number];
  readonly contract: CapabilityContractReference;
  readonly operations: readonly RemoteOperationView[];
}

/** Mirrored entry-point declaration (discriminated on `kind`). */
export type EntryPointView =
  | {
      readonly kind: 'declarative';
      readonly name: string;
      readonly title: string;
      readonly description?: string | undefined;
      readonly contributions: readonly (typeof CONTRIBUTION_KINDS)[number][];
    }
  | {
      readonly kind: 'ui';
      readonly name: string;
      readonly title: string;
      readonly description?: string | undefined;
      readonly surface: (typeof UI_SURFACE_KINDS)[number];
      readonly inputs: readonly import('@epoch/agent-protocol').ParameterSpec[];
      readonly outputs: readonly import('@epoch/agent-protocol').ParameterSpec[];
    }
  | {
      readonly kind: 'wasm';
      readonly name: string;
      readonly title: string;
      readonly description?: string | undefined;
      readonly component: WasmComponentDescriptorView;
    }
  | {
      readonly kind: 'remote';
      readonly name: string;
      readonly title: string;
      readonly description?: string | undefined;
      readonly service: RemoteServiceDescriptorView;
    };

/**
 * The runtime's full structural view of an extension manifest — the
 * mirror the admission pipeline validates against (strict objects
 * reject unknown fields; sorted-set semantics enforced; grants ⊆
 * bindings; trust ceilings; flavor match — the same refinements as the
 * SDK's schema, parity-pinned). zod parse returns a fresh tree, so the
 * admitted manifest is a private, effectively-frozen copy.
 */
export interface ExtensionManifestView {
  readonly schemaVersion: 1;
  readonly extensionId: ExtensionIdView;
  readonly version: string;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly flavor: (typeof EXTENSION_FLAVORS)[number];
  readonly capabilityBindings: readonly CapabilityBindView[];
  readonly grants: readonly ExtensionGrantView[];
  readonly entryPoints: readonly EntryPointView[];
  readonly contracts: readonly CapabilityContractReference[];
  readonly trustClass: (typeof EXTENSION_TRUST_CLASSES)[number];
  readonly license: string;
  readonly dataHandling: ExtensionDataHandlingView;
  readonly sideEffects: readonly ExtensionSideEffectView[];
}

// ---------------------------------------------------------------------------
// Invocation envelopes and outcomes.
// ---------------------------------------------------------------------------

/** One typed host invocation envelope (validated before dispatch). */
export interface HostInvocationEnvelope {
  readonly schemaVersion: 1;
  readonly envelopeId: MessageId;
  readonly extensionId: ExtensionIdView;
  readonly capabilityId: string;
  readonly hostFunction: HostFunctionIdView;
  readonly payload: JsonValue;
}

/** Payload-level request mirrors (validated per host function). */
export interface HostRequestPayloads {
  readonly 'clock.read': { readonly instant: true };
  readonly 'log.write': { readonly level: (typeof HOST_LOG_LEVELS)[number]; readonly message: string };
  readonly 'world.read': { readonly entityRefs: readonly string[] };
  readonly 'evidence.append': { readonly statement: string; readonly subjectDigest?: Sha256Hex | undefined };
  readonly 'capability.invoke': { readonly capabilityId: string; readonly inputs: Readonly<Record<string, JsonValue>> };
  readonly 'storage.read': { readonly key: string };
  readonly 'storage.write': { readonly key: string; readonly value: JsonValue };
}

/** The outcome of a PERMITTED host call. */
export type HostExecutionOutcome =
  | { readonly status: 'completed'; readonly response: JsonValue }
  | { readonly status: 'failed'; readonly code: HostExecutionFailureCode; readonly message: string };

/** Result of `session.invoke`: a completed/failed outcome or a typed boundary error. */
export type InvokeResult =
  | { readonly ok: true; readonly envelopeId: MessageId; readonly outcome: HostExecutionOutcome }
  | { readonly ok: false; readonly error: ExtensionRuntimeError };

// ---------------------------------------------------------------------------
// The typed error taxonomy (the shared W008 taxonomy, host side).
// ---------------------------------------------------------------------------

/** Issue codes reported by the runtime's total entry points. */
export type ExtensionRuntimeErrorCode =
  | 'validation'
  | 'unknown-capability'
  | 'version-unsatisfied'
  | 'lifecycle-conflict'
  | 'digest-mismatch'
  | 'permission-denied'
  | 'sandbox-violation';

/** One flattened validation issue (dotted path + message). */
export interface ExtensionRuntimeIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy (host side; total — errors are values). */
export type ExtensionRuntimeError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ExtensionRuntimeIssue[];
    }
  | {
      readonly code: 'unknown-capability';
      readonly message: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'version-unsatisfied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly constraint: VersionConstraint;
      readonly availableVersions: readonly string[];
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly from: 'registered' | 'deprecated' | 'retired';
      readonly to: 'registered' | 'deprecated' | 'retired';
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    }
  | {
      readonly code: 'permission-denied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly extensionId: ExtensionIdView;
      readonly capabilityId: string;
      readonly hostFunction: HostFunctionIdView;
      readonly reason: PermissionDeniedReason;
    }
  | {
      readonly code: 'sandbox-violation';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly extensionId: ExtensionIdView;
      readonly detail: SandboxViolationDetail;
    };

/** Result of a runtime operation: a value or a typed error. */
export type ExtensionRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExtensionRuntimeError };

// ---------------------------------------------------------------------------
// Admission, sessions, and the deterministic surface description.
// ---------------------------------------------------------------------------

/** A binding pin resolved at admission (content-addressed both sides). */
export interface ResolvedCapabilityBinding {
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly capabilityManifestDigest: Sha256Hex;
  readonly bindingConstraint: VersionConstraint;
}

/** One grant as published in the surface description (sorted arrays). */
export interface GrantDescription {
  readonly capabilityId: string;
  readonly hostFunctions: readonly HostFunctionIdView[];
  readonly resourceScopes: readonly ResourceScopeMirror[];
}

/**
 * The deterministic execution-surface description: exactly what the
 * admitted extension may do — its content address, resolved binding
 * pins, and frozen grants. Sorted everywhere (by capabilityId); two
 * sessions admitted from equivalent inputs produce identical
 * descriptions regardless of admission order.
 */
export interface SandboxSurfaceDescription {
  readonly schemaVersion: 1;
  readonly extensionId: ExtensionIdView;
  readonly extensionVersion: string;
  readonly extensionManifestDigest: Sha256Hex;
  readonly flavor: (typeof EXTENSION_FLAVORS)[number];
  readonly trustClass: (typeof EXTENSION_TRUST_CLASSES)[number];
  readonly bindings: readonly ResolvedCapabilityBinding[];
  readonly grants: readonly GrantDescription[];
}

/** The admitted extension record (session state; serialization-friendly). */
export interface AdmittedExtensionRecord {
  readonly schemaVersion: 1;
  readonly manifest: ExtensionManifestView;
  readonly lifecycle: 'registered' | 'deprecated' | 'retired';
  readonly manifestDigest: Sha256Hex;
  readonly bindings: readonly ResolvedCapabilityBinding[];
}

/** One session-local audit record (deterministic sequence; NOT the W010 event log). */
export interface InvocationAuditRecord {
  readonly sequence: number;
  readonly envelopeId: MessageId;
  readonly capabilityId: string;
  readonly hostFunction: HostFunctionIdView;
  readonly decision: 'permitted' | 'denied';
  readonly denialCode?: ExtensionRuntimeErrorCode;
}

/** One session log record written by `log.write` (in-memory, bounded). */
export interface SessionLogRecord {
  readonly sequence: number;
  readonly level: (typeof HOST_LOG_LEVELS)[number];
  readonly message: string;
  readonly instant: Timestamp;
}

/** One in-memory evidence statement appended by `evidence.append`. */
export interface SessionEvidenceRecord {
  readonly sequence: number;
  readonly evidenceId: MessageId;
  readonly statement: string;
  readonly subjectDigest?: Sha256Hex | undefined;
  readonly attributedExtensionId: ExtensionIdView;
}

// ---------------------------------------------------------------------------
// Injectable host-side providers (the reference host is in-memory and
// deterministic; real adapters arrive in later Work Orders).
// ---------------------------------------------------------------------------

/** Read-only world projection provider (`world.read`). */
export interface WorldViewProvider {
  readonly readProjection: (refs: readonly string[]) => readonly JsonValue[];
}

/** Deterministic clock provider (`clock.read`). */
export interface HostClock {
  readonly now: () => Timestamp;
}

/** Capability Fabric invocation provider (`capability.invoke`). */
export interface CapabilityInvoker {
  readonly invoke: (request: {
    readonly capabilityId: string;
    readonly inputs: Readonly<Record<string, JsonValue>>;
  }) => HostExecutionOutcome;
}

/** Resource-scope view re-export for external consumers. */
export type { ResourceScopeMirror };
