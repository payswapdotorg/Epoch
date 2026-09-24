/**
 * @epoch/extension-sdk — public API (kernel layer, Work Order W008).
 *
 * The typed AUTHORING surface of Epoch extensions (architecture.md,
 * "Extensions" — binding): declarative manifests across the four
 * flavors (declarative, ui, wasm, remote), capability-scoped permission
 * grants with trust-class ceilings (lock rules 9/10), the narrow typed
 * host-function contract surface, extension lifecycle aligned with the
 * W007 registry, a typed error taxonomy, and deterministic
 * content-addressed serialization.
 *
 * - Provider-NEUTRAL by construction (lock rule 13): zero concrete
 *   extensions, zero vendor adapters, zero endpoints, zero React
 *   rendering machinery (the ui flavor ships abstract typed entry-point
 *   declarations only — the app renders later, W014+); strict objects
 *   reject unknown (vendor) fields.
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared primitives) and @epoch/capability-registry
 *   (capability binding vocabulary: constraints, contracts, lifecycle) —
 *   genuine runtime composition per the W008 pin.
 * - Host-side sandbox machinery lives in @epoch/extension-runtime
 *   (mirrors these shapes with parity tests, NO runtime coupling);
 *   Wasm host-side layout machinery lives in runtimes/wasm.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection
 * under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  CONTRIBUTION_KINDS,
  EXTENSION_FLAVORS,
  EXTENSION_ID_PATTERN,
  EXTENSION_LIFECYCLE_STATES,
  EXTENSION_LIFECYCLE_TRANSITIONS,
  EXTENSION_MANIFEST_VERSION,
  EXTENSION_SDK_CONTRACT_VERSION,
  EXTENSION_SIDE_EFFECT_KINDS,
  EXTENSION_TRUST_CLASSES,
  EXTENSION_DATA_HANDLINGS,
  HOST_FUNCTION_DECLARATIONS,
  HOST_FUNCTION_IDS,
  HOST_LOG_LEVELS,
  LEGAL_RESOURCE_SCOPES,
  LICENSE_PATTERN,
  REMOTE_TRANSPORT_KINDS,
  RESOURCE_ACCESSES,
  RESOURCE_DOMAINS,
  STORAGE_KEY_PATTERN,
  TRUST_CLASS_GRANT_CEILINGS,
  UI_SURFACE_KINDS,
  WASM_INTERFACE_NAME_PATTERN,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
  WASM_COMPONENT_DESCRIPTOR_VERSION,
} from './version';
export type {
  ContributionKind,
  DataHandlingClassification,
  ExtensionFlavor,
  ExtensionTrustClass,
  HostFunctionId,
  HostLogLevel,
  RemoteTransportKind,
  ResourceAccess,
  ResourceDomain,
  SideEffectKind,
  UiSurfaceKind,
  WasmSectionKind,
  WasmValueType,
} from './version';
export type { HostFunctionDeclaration, TrustClassGrantCeiling } from './version';

// Published contract types.
export type {
  CapabilityBinding,
  CapabilityInvokeRequest,
  CapabilityInvokeResponse,
  ClockReadRequest,
  ClockReadResponse,
  ComponentFunctionDeclaration,
  ComponentInterfaceDeclaration,
  DeclarativeEntryPoint,
  EntryPointDeclaration,
  EntryPointName,
  EvidenceAppendRequest,
  EvidenceAppendResponse,
  ExtensionDataHandling,
  ExtensionGrant,
  ExtensionId,
  ExtensionManifest,
  ExtensionRegistration,
  ExtensionSdkError,
  ExtensionSdkIssue,
  ExtensionSdkErrorCode,
  ExtensionSdkResult,
  ExtensionSideEffect,
  ExtensionVersion,
  LayoutSection,
  LogWriteRequest,
  LogWriteResponse,
  RemoteEntryPoint,
  RemoteOperationDeclaration,
  RemoteServiceDescriptor,
  ResourceScope,
  StorageReadRequest,
  StorageReadResponse,
  StorageWriteRequest,
  StorageWriteResponse,
  UiEntryPoint,
  WasmComponentDescriptor,
  WasmEntryPoint,
  WasmParamDeclaration,
  WorldReadRequest,
  WorldReadResponse,
} from './types';

// Runtime validators.
export {
  CapabilityBindingSchema,
  CapabilityInvokeRequestSchema,
  CapabilityInvokeResponseSchema,
  ClockReadRequestSchema,
  ClockReadResponseSchema,
  ComponentFunctionDeclarationSchema,
  ComponentInterfaceDeclarationSchema,
  ContributionKindSchema,
  DataHandlingClassificationSchema,
  DeclarativeEntryPointSchema,
  EntryPointDeclarationSchema,
  EntryPointNameSchema,
  EvidenceAppendRequestSchema,
  EvidenceAppendResponseSchema,
  ExtensionDataHandlingSchema,
  ExtensionFlavorSchema,
  ExtensionGrantSchema,
  ExtensionIdSchema,
  ExtensionManifestSchema,
  ExtensionManifestVersionSchema,
  ExtensionRegistrationSchema,
  ExtensionSideEffectSchema,
  ExtensionTrustClassSchema,
  HostFunctionDeclarationSchema,
  HostFunctionIdSchema,
  HostLogLevelSchema,
  LayoutSectionSchema,
  LogWriteRequestSchema,
  LogWriteResponseSchema,
  RemoteEntryPointSchema,
  RemoteOperationDeclarationSchema,
  RemoteServiceDescriptorSchema,
  RemoteTransportKindSchema,
  ResourceAccessSchema,
  ResourceDomainSchema,
  ResourceScopeSchema,
  SideEffectKindSchema,
  StorageReadRequestSchema,
  StorageReadResponseSchema,
  StorageWriteRequestSchema,
  StorageWriteResponseSchema,
  TrustClassGrantCeilingSchema,
  UiEntryPointSchema,
  UiSurfaceKindSchema,
  WasmComponentDescriptorSchema,
  WasmComponentDescriptorVersionSchema,
  WasmParamDeclarationSchema,
  WasmSectionKindSchema,
  WasmValueTypeSchema,
  WorldReadRequestSchema,
  WorldReadResponseSchema,
} from './schema';

// Lifecycle vocabulary + transition checker (W007-aligned).
export {
  checkExtensionLifecycleTransition,
  type ExtensionLifecycleTransition,
} from './lifecycle';

// Total parse surface.
export {
  parseExtensionManifest,
  parseExtensionRegistration,
  parseWasmComponentDescriptor,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeExtensionManifestDigest,
  computeWasmComponentDescriptorDigest,
  sealExtensionManifest,
  serializeExtensionManifest,
  serializeWasmComponentDescriptor,
  verifyExtensionManifestDigest,
  verifyWasmComponentDescriptorDigest,
} from './serialize';

// Compile-time contract parity (type-only).
export type { ExtensionSdkSchemaSync, ExtensionSdkResultSync } from './parity';

// Published schema surface + contract emission.
export { EXTENSION_SDK_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  EXTENSION_SDK_CONTRACT_DIR,
  renderExtensionSdkContractFiles,
  typeToKebabCase,
} from './contract-emission';
