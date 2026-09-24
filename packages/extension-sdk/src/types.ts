/**
 * @epoch/extension-sdk — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * provider-neutral; the flavor, host-function, resource-scope, trust,
 * transport, and contribution vocabularies name ROLES and BOUNDARIES,
 * never vendors, models, engines, or API surfaces. No field encodes an
 * endpoint, provider, or framework. Strict objects reject unknown
 * (vendor) fields at validation.
 *
 * Capability scoping (lock rule 9): {@link ExtensionManifest.capabilityBindings}
 * binds the extension to registered capabilities (the W007 registry
 * vocabulary); binding to unknown or retired capabilities is rejected by
 * the host (see @epoch/extension-runtime, W008's host machinery).
 *
 * Sandboxing (lock rule 10): {@link ExtensionManifest.grants} is the
 * declared allow-list surface — capability-scoped host-function grants
 * plus resource scopes. Enforcement denies anything not explicitly
 * granted; grants above the trust-class ceiling are invalid by
 * declaration (see TRUST_CLASS_GRANT_CEILINGS in src/version.ts).
 */
import type { ParameterSpec, Sha256Hex, Timestamp, MessageId, JsonValue } from '@epoch/agent-protocol';
import type { CapabilityContractReference, CapabilityLifecycleState } from '@epoch/capability-registry';
import type { VersionConstraint } from '@epoch/capability-registry';
import type {
  ContributionKind,
  DataHandlingClassification,
  ExtensionFlavor,
  ExtensionTrustClass,
  HostFunctionId,
  ResourceAccess,
  ResourceDomain,
  RemoteTransportKind,
  SideEffectKind,
  UiSurfaceKind,
  WasmSectionKind,
  WasmValueType,
  HostLogLevel,
} from './version';

/** Opaque, stable extension identity (`extension:` + kebab slug). */
export type ExtensionId = string;

/** The extension's semantic version (semver core, R18). */
export type ExtensionVersion = string;

/** Entry-point name (kebab slug; unique and sorted within a manifest). */
export type EntryPointName = string;

/**
 * A capability binding: which capability (opaque, stable id) at which
 * version range THIS extension binds to (R18 — versioned capabilities,
 * never floating references; the concrete version is resolved by the
 * host against the capability registry at admission). Shape-compatible
 * with the W007 adapter binding by design (same fields, same constraint
 * vocabulary).
 */
export interface CapabilityBinding {
  readonly capabilityId: string;
  readonly versionRange: VersionConstraint;
}

/**
 * A typed resource scope: the (domain, access) pair a grant carries for
 * a host call to be permitted. Only the pairs in LEGAL_RESOURCE_SCOPES
 * (src/version.ts) are valid.
 */
export interface ResourceScope {
  readonly resource: ResourceDomain;
  readonly access: ResourceAccess;
}

/**
 * One declared permission grant — the allow-list unit. Grants are
 * CAPABILITY-SCOPED: the host functions and resource scopes apply only
 * while serving the named capability binding. `hostFunctions` must be
 * sorted and duplicate-free (deterministic set semantics);
 * `resourceScopes` likewise.
 */
export interface ExtensionGrant {
  readonly capabilityId: string;
  readonly hostFunctions: readonly HostFunctionId[];
  readonly resourceScopes: readonly ResourceScope[];
}

/** One declared side effect (empty list = the extension declares purity). */
export interface ExtensionSideEffect {
  readonly kind: SideEffectKind;
  readonly description: string;
}

/** Data-handling declaration for the manifest. */
export interface ExtensionDataHandling {
  readonly classification: DataHandlingClassification;
  readonly notes?: string | undefined;
}

/** Wasm component parameter declaration (WIT primitive type). */
export interface WasmParamDeclaration {
  readonly name: string;
  readonly type: WasmValueType;
}

/** One function of a Wasm Component Model interface declaration. */
export interface ComponentFunctionDeclaration {
  readonly functionName: string;
  readonly params: readonly WasmParamDeclaration[];
  /** Result type; absent when the function returns nothing. */
  readonly result?: WasmValueType | undefined;
}

/** One import or export interface of a Wasm component world. */
export interface ComponentInterfaceDeclaration {
  readonly interfaceName: string;
  readonly functions: readonly ComponentFunctionDeclaration[];
}

/**
 * One canonical layout section of a Wasm component package. Sections
 * are sorted by `name` ascending and unique (deterministic canonical
 * ordering); `contentDigest` is the SHA-256 of the section's bytes
 * (verification machinery in runtimes/wasm).
 */
export interface LayoutSection {
  readonly name: string;
  readonly kind: WasmSectionKind;
  readonly byteSize: number;
  readonly contentDigest: Sha256Hex;
}

/**
 * The Wasm Component Model descriptor — the AUTHOR-side document a
 * `wasm`-flavor extension embeds in its manifest. Declares the
 * component identity, its WIT world (imports the host must provide,
 * exports the host may call), and the canonical section layout with
 * per-section sizes and content digests. ZERO actual Wasm binaries,
 * ZERO vendored toolchains (W008 scope discipline); host-side layout
 * validation lives in runtimes/wasm and deliberately re-validates
 * independently (sandbox boundaries never trust author-side tooling).
 */
export interface WasmComponentDescriptor {
  readonly schemaVersion: 1;
  readonly componentId: string;
  readonly componentVersion: string;
  readonly worldName: string;
  readonly imports: readonly ComponentInterfaceDeclaration[];
  readonly exports: readonly ComponentInterfaceDeclaration[];
  readonly sections: readonly LayoutSection[];
}

/** One declared operation of a remote service. */
export interface RemoteOperationDeclaration {
  readonly name: string;
  readonly inputs: readonly ParameterSpec[];
  readonly outputs: readonly ParameterSpec[];
}

/**
 * The remote-service descriptor — a TYPED SHAPE ONLY (W008 scope
 * discipline): opaque service identity, transport kind, the versioned
 * contract the service honors, and the operation surface. NO endpoint,
 * NO credentials, NO vendor fields — endpoint binding is deployment
 * configuration behind a future adapter (W029), never contract content.
 */
export interface RemoteServiceDescriptor {
  readonly serviceId: string;
  readonly transport: RemoteTransportKind;
  readonly contract: CapabilityContractReference;
  readonly operations: readonly RemoteOperationDeclaration[];
}

/** Shared entry-point fields. */
interface EntryPointBase {
  readonly name: EntryPointName;
  readonly title: string;
  readonly description?: string | undefined;
}

/**
 * The declarative-flavor entry point: a typed contribution declaration
 * (world types, mappings, constraints, …) with no executable content.
 */
export interface DeclarativeEntryPoint extends EntryPointBase {
  readonly kind: 'declarative';
  readonly contributions: readonly ContributionKind[];
}

/**
 * The ui-flavor entry point: an ABSTRACT typed declaration of one
 * render surface (kind + input/output parameter specs). The app layer
 * renders these later (W014+); React is NOT a dependency here.
 */
export interface UiEntryPoint extends EntryPointBase {
  readonly kind: 'ui';
  readonly surface: UiSurfaceKind;
  readonly inputs: readonly ParameterSpec[];
  readonly outputs: readonly ParameterSpec[];
}

/** The wasm-flavor entry point: embeds one Wasm component descriptor. */
export interface WasmEntryPoint extends EntryPointBase {
  readonly kind: 'wasm';
  readonly component: WasmComponentDescriptor;
}

/** The remote-flavor entry point: embeds one remote-service descriptor. */
export interface RemoteEntryPoint extends EntryPointBase {
  readonly kind: 'remote';
  readonly service: RemoteServiceDescriptor;
}

/**
 * One declared extension entry point. The `kind` must match the
 * manifest `flavor` one-for-one (refinement-enforced).
 */
export type EntryPointDeclaration =
  | DeclarativeEntryPoint
  | UiEntryPoint
  | WasmEntryPoint
  | RemoteEntryPoint;

/**
 * The extension manifest: the immutable, content-addressed authoring
 * document every extension ships. Identity is (extensionId, version);
 * the manifest binds capabilities (W007 registry vocabulary), declares
 * its permission allow-list (grants), declares entry points for its
 * flavor, honors versioned contracts, declares its trust class
 * (materialized as a grant ceiling), license, data handling, and side
 * effects. Set-typed arrays (bindings, grants, entryPoints, contracts)
 * are sorted + duplicate-free so equivalent content has exactly one
 * canonical serialization and one digest.
 */
export interface ExtensionManifest {
  readonly schemaVersion: 1;
  readonly extensionId: ExtensionId;
  readonly version: ExtensionVersion;
  readonly displayName: string;
  readonly description?: string | undefined;
  readonly flavor: ExtensionFlavor;
  readonly capabilityBindings: readonly CapabilityBinding[];
  readonly grants: readonly ExtensionGrant[];
  readonly entryPoints: readonly EntryPointDeclaration[];
  readonly contracts: readonly CapabilityContractReference[];
  readonly trustClass: ExtensionTrustClass;
  readonly license: string;
  readonly dataHandling: ExtensionDataHandling;
  readonly sideEffects: readonly ExtensionSideEffect[];
}

/**
 * A registration envelope: the manifest plus the digest CLAIMED for its
 * content. The host recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection): a manifest whose digest does
 * not match its content never crosses the sandbox boundary.
 */
export interface ExtensionRegistration {
  readonly manifest: ExtensionManifest;
  readonly digest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// Host-function request/response payload contracts (lock rule 10: the
// narrow, typed host surface). The runtime validates every invocation
// envelope's payload against the request contract before dispatch, and
// every host implementation responds in the response contract.
// ---------------------------------------------------------------------------

/** `clock.read` request (no parameters). */
export interface ClockReadRequest {
  readonly instant: true;
}

/** `clock.read` response. */
export interface ClockReadResponse {
  readonly instant: Timestamp;
}

/** `log.write` request. */
export interface LogWriteRequest {
  readonly level: HostLogLevel;
  readonly message: string;
}

/** `log.write` response (acknowledgement). */
export interface LogWriteResponse {
  readonly logged: true;
}

/** `world.read` request: entity references to project. */
export interface WorldReadRequest {
  readonly entityRefs: readonly string[];
}

/** `world.read` response: one projection snapshot per requested ref. */
export interface WorldReadResponse {
  readonly snapshots: readonly JsonValue[];
}

/** `evidence.append` request. */
export interface EvidenceAppendRequest {
  readonly statement: string;
  readonly subjectDigest?: Sha256Hex | undefined;
}

/** `evidence.append` response. */
export interface EvidenceAppendResponse {
  readonly evidenceId: MessageId;
}

/** `capability.invoke` request (dispatch through the Capability Fabric). */
export interface CapabilityInvokeRequest {
  readonly capabilityId: string;
  readonly inputs: Readonly<Record<string, JsonValue>>;
}

/** `capability.invoke` response. */
export interface CapabilityInvokeResponse {
  readonly outputs: Readonly<Record<string, JsonValue>>;
}

/** `storage.read` request. */
export interface StorageReadRequest {
  readonly key: string;
}

/** `storage.read` response (`null` value = absent key). */
export interface StorageReadResponse {
  readonly value: JsonValue;
}

/** `storage.write` request. */
export interface StorageWriteRequest {
  readonly key: string;
  readonly value: JsonValue;
}

/** `storage.write` response (acknowledgement). */
export interface StorageWriteResponse {
  readonly written: true;
}

/** Issue codes reported by the SDK's total entry points. */
export type ExtensionSdkErrorCode =
  | 'validation'
  | 'lifecycle-conflict'
  | 'digest-mismatch';

/** One flattened validation issue (dotted path + message). */
export interface ExtensionSdkIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed error taxonomy, SDK side (the full shared taxonomy is
 * `validation | unknown-capability | version-unsatisfied |
 * lifecycle-conflict | digest-mismatch | permission-denied |
 * sandbox-violation` — the W008 Tech Lead pin; the host-side codes are
 * produced by @epoch/extension-runtime, which mirrors this surface
 * structurally with parity tests, no runtime dependency). Every SDK
 * entry point is total — errors are values, never exceptions.
 */
export type ExtensionSdkError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ExtensionSdkIssue[];
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly from: CapabilityLifecycleState;
      readonly to: CapabilityLifecycleState;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of an SDK operation: a value or a typed error. */
export type ExtensionSdkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExtensionSdkError };
