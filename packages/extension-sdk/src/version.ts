/**
 * @epoch/extension-sdk — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a serialized
 * extension manifest is admitted only when its `schemaVersion` equals
 * {@link EXTENSION_MANIFEST_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"] before any other schema
 * diagnostics. {@link EXTENSION_SDK_CONTRACT_VERSION} versions the
 * published contract surface (`schemas/` + the typed index export).
 *
 * Extension lifecycle (W008 Tech Lead pin): `registered -> deprecated ->
 * retired`, ALIGNED with the W007 registry semantics — the states and the
 * transition table are the @epoch/capability-registry constants
 * re-exported (genuine runtime composition; zero drift possible), never
 * re-declared.
 *
 * Provider neutrality (lock rule 13): every vocabulary below names a
 * ROLE, SURFACE, or BOUNDARY — never a vendor, model, engine, or API.
 */

/** Version of the published extension-sdk contract surface (schemas/ + types). */
export const EXTENSION_SDK_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized extension manifest and registration. */
export const EXTENSION_MANIFEST_VERSION = 1 as const;

/** Version discriminator carried by every serialized Wasm component descriptor. */
export const WASM_COMPONENT_DESCRIPTOR_VERSION = 1 as const;

/**
 * Extension lifecycle states — the W007 registry vocabulary, re-exported
 * (aligned semantics: `deprecated` is advisory and still binds; `retired`
 * is terminal and does not accept new bindings).
 */
export {
  CAPABILITY_LIFECYCLE_STATES as EXTENSION_LIFECYCLE_STATES,
  CAPABILITY_LIFECYCLE_TRANSITIONS as EXTENSION_LIFECYCLE_TRANSITIONS,
} from '@epoch/capability-registry';

/**
 * Opaque extension identity: `extension:` + lowercase kebab slug
 * (mirrors the agent-protocol AgentId discipline). The identity is
 * stable across versions; versions evolve, the id never does.
 */
export const EXTENSION_ID_PATTERN = /^extension:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The four extension flavors (architecture.md, "Extensions" — binding):
 * declarative manifest/schema, TypeScript/React UI, Wasm Component Model,
 * remote service adapter. The `ui` flavor models its entry points as
 * abstract typed declarations only — React rendering machinery belongs
 * to the app layer (W014+); React is NOT a dependency of this package.
 */
export const EXTENSION_FLAVORS = ['declarative', 'ui', 'wasm', 'remote'] as const;

/** One extension flavor. */
export type ExtensionFlavor = (typeof EXTENSION_FLAVORS)[number];

/**
 * The extension trust ladder (spec/extension-architecture.md, "Trust"):
 * T0 untrusted/read-only, T1 provisional model population, T2 validated
 * simulation/evaluation, T3 trusted reversible execution, T4 certified
 * controlled autonomy. The class is DECLARED in the manifest and
 * materializes as a grant ceiling (see TRUST_CLASS_GRANT_CEILINGS).
 */
export const EXTENSION_TRUST_CLASSES = ['t0', 't1', 't2', 't3', 't4'] as const;

/** One extension trust class. */
export type ExtensionTrustClass = (typeof EXTENSION_TRUST_CLASSES)[number];

/** Resource domains a sandboxed extension can touch through the host surface. */
export const RESOURCE_DOMAINS = ['world', 'evidence', 'storage', 'capability'] as const;

/** One resource domain. */
export type ResourceDomain = (typeof RESOURCE_DOMAINS)[number];

/** Kinds of access over a resource domain. */
export const RESOURCE_ACCESSES = ['read', 'append', 'write', 'invoke'] as const;

/** One kind of resource access. */
export type ResourceAccess = (typeof RESOURCE_ACCESSES)[number];

/**
 * The legal (domain, access) pairs of the v1 host surface. The host
 * surface deliberately offers NO direct world mutation — world change
 * happens only through the Action Gateway (lock rule 3), never through
 * extension host functions.
 */
export const LEGAL_RESOURCE_SCOPES: readonly { readonly resource: ResourceDomain; readonly access: ResourceAccess }[] = [
  { resource: 'world', access: 'read' },
  { resource: 'evidence', access: 'append' },
  { resource: 'storage', access: 'read' },
  { resource: 'storage', access: 'write' },
  { resource: 'capability', access: 'invoke' },
];

/**
 * The closed host-function vocabulary (lock rule 10: extensions receive
 * a NARROW, typed host-function surface; every host call is
 * permission-checked against declared grants). Sorted ascending; the
 * order is the canonical enumeration order.
 */
export const HOST_FUNCTION_IDS = [
  'capability.invoke',
  'clock.read',
  'evidence.append',
  'log.write',
  'storage.read',
  'storage.write',
  'world.read',
] as const;

/** One host function id. */
export type HostFunctionId = (typeof HOST_FUNCTION_IDS)[number];

/**
 * The typed host-function contract: each host function, what it does, and
 * the resource scope a grant MUST carry for the call to be permitted.
 * `capability.invoke` dispatches through the Capability Fabric (the
 * adapter contracts are W007's; NO vendor adapter ships here).
 * `clock.read` and `log.write` are ambient — they require no resource
 * scope. Sorted by hostFunction ascending (deterministic).
 */
export interface HostFunctionDeclaration {
  readonly hostFunction: HostFunctionId;
  readonly description: string;
  /** Resource scope a grant must carry for this call, or null when ambient. */
  readonly requiredScope: { readonly resource: ResourceDomain; readonly access: ResourceAccess } | null;
}

/** The host-function contract table (sorted by hostFunction ascending). */
export const HOST_FUNCTION_DECLARATIONS: readonly HostFunctionDeclaration[] = [
  {
    hostFunction: 'capability.invoke',
    description:
      'Invoke a bound capability through the Capability Fabric with named inputs; the concrete adapter is resolved by the host, never by the extension.',
    requiredScope: { resource: 'capability', access: 'invoke' },
  },
  {
    hostFunction: 'clock.read',
    description: 'Read the host-provided UTC clock instant (deterministic when the host injects a fixed clock).',
    requiredScope: null,
  },
  {
    hostFunction: 'evidence.append',
    description: 'Append one evidence statement to the evidence sink; evidence addressing and chain custody are W006 machinery.',
    requiredScope: { resource: 'evidence', access: 'append' },
  },
  {
    hostFunction: 'log.write',
    description: 'Emit one structured log record to the session log.',
    requiredScope: null,
  },
  {
    hostFunction: 'storage.read',
    description: 'Read one value from the extension-scoped storage namespace.',
    requiredScope: { resource: 'storage', access: 'read' },
  },
  {
    hostFunction: 'storage.write',
    description: 'Write one value into the extension-scoped storage namespace (reversible host state, never durable world state).',
    requiredScope: { resource: 'storage', access: 'write' },
  },
  {
    hostFunction: 'world.read',
    description: 'Read read-only world-model projections for the referenced entities; world mutation is action-gateway territory, never an extension host call.',
    requiredScope: { resource: 'world', access: 'read' },
  },
];

/**
 * The trust-class grant ceilings (least privilege, R24): the maximum
 * host functions and resource scopes a manifest of a given trust class
 * may DECLARE. Anything not granted is denied at the boundary
 * (runtime enforcement); anything above the ceiling is rejected at
 * validation — escalation by declaration is inexpressible.
 *
 * Ladder rationale (spec/extension-architecture.md, "Trust"):
 * - t0 untrusted/read-only — reads only, no side effects;
 * - t1 provisional model population — may append evidence (provisional
 *   contributions enter the evidence chain, never world state directly);
 * - t2 validated simulation/evaluation — may invoke fabric capabilities;
 * - t3 trusted reversible execution — may write host storage (reversible);
 * - t4 certified controlled autonomy — the full v1 host surface.
 *
 * Sorted by trustClass ascending (deterministic).
 */
export interface TrustClassGrantCeiling {
  readonly trustClass: ExtensionTrustClass;
  readonly title: string;
  readonly description: string;
  readonly hostFunctions: readonly HostFunctionId[];
  readonly resourceScopes: readonly { readonly resource: ResourceDomain; readonly access: ResourceAccess }[];
}

/** The trust-class grant ceiling table (sorted by trustClass ascending). */
export const TRUST_CLASS_GRANT_CEILINGS: readonly TrustClassGrantCeiling[] = [
  {
    trustClass: 't0',
    title: 'untrusted / read-only',
    description: 'T0 extensions may only read ambient state and world/storage projections; no side-effecting host call is declarable.',
    hostFunctions: ['clock.read', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't1',
    title: 'provisional model population',
    description: 'T1 extensions may additionally append provisional evidence statements (model population flows through the evidence chain).',
    hostFunctions: ['clock.read', 'evidence.append', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't2',
    title: 'validated simulation/evaluation',
    description: 'T2 extensions may additionally invoke Capability Fabric capabilities (simulators, evaluators, verifiers) through the host.',
    hostFunctions: ['capability.invoke', 'clock.read', 'evidence.append', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't3',
    title: 'trusted reversible execution',
    description: 'T3 extensions may additionally write host storage (reversible session state; durable world change remains action-gateway territory).',
    hostFunctions: [
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
    ],
  },
  {
    trustClass: 't4',
    title: 'certified controlled autonomy',
    description: 'T4 extensions may declare the full v1 host-function surface (still no direct world mutation — that is lock rule 3, forever).',
    hostFunctions: [
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ],
    resourceScopes: [
      { resource: 'capability', access: 'invoke' },
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
    ],
  },
];

/** Data-handling classifications a manifest may declare. */
export const EXTENSION_DATA_HANDLINGS = ['sandbox-only', 'tenant-scoped', 'external-transfer'] as const;

/** One data-handling classification. */
export type DataHandlingClassification = (typeof EXTENSION_DATA_HANDLINGS)[number];

/** Side-effect kinds an extension may declare (empty list = declared pure). */
export const EXTENSION_SIDE_EFFECT_KINDS = [
  'action-proposal',
  'evidence-append',
  'external-effect',
  'sandbox-state-write',
] as const;

/** One side-effect kind. */
export type SideEffectKind = (typeof EXTENSION_SIDE_EFFECT_KINDS)[number];

/**
 * Contribution kinds of the declarative flavor (spec/
 * extension-architecture.md, "Extension can contribute"): world types,
 * mappings, reconstructions, visualizations, animations, interactions,
 * agents, constraints, simulators, evaluators, verification methods,
 * workflows, connectors. Sorted ascending (canonical order).
 */
export const CONTRIBUTION_KINDS = [
  'agent',
  'animation',
  'constraint',
  'connector',
  'evaluator',
  'interaction',
  'mapping',
  'reconstruction',
  'simulator',
  'verification-method',
  'visualization',
  'workflow',
  'world-type',
] as const;

/** One declarative contribution kind. */
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

/**
 * Abstract render-surface kinds for the `ui` flavor. The SDK models UI
 * entry points as typed declarations only; actual rendering is the app
 * layer's business (W014+). Names describe surface ROLES, never widgets
 * or frameworks.
 */
export const UI_SURFACE_KINDS = ['inspector', 'overlay', 'panel'] as const;

/** One UI render-surface kind. */
export type UiSurfaceKind = (typeof UI_SURFACE_KINDS)[number];

/**
 * Transport kinds of the remote-service flavor (spec/
 * extension-architecture.md, "Remote capability": HTTP/gRPC/MCP/custom
 * service). Transports are protocol ROLES, not vendors; endpoint
 * binding is deployment configuration, never contract content — the
 * descriptor carries NO endpoint field at all.
 */
export const REMOTE_TRANSPORT_KINDS = ['custom', 'grpc', 'http', 'mcp'] as const;

/** One remote transport kind. */
export type RemoteTransportKind = (typeof REMOTE_TRANSPORT_KINDS)[number];

/**
 * WIT primitive value types admitted by the v1 Wasm component surface
 * (numeric primitives, bool, char, string). Composite types (list,
 * record, variant) are future surface — recorded as a limitation.
 */
export const WASM_VALUE_TYPES = [
  'bool',
  'char',
  'f32',
  'f64',
  's16',
  's32',
  's64',
  's8',
  'string',
  'u16',
  'u32',
  'u64',
  'u8',
] as const;

/** One WIT primitive value type. */
export type WasmValueType = (typeof WASM_VALUE_TYPES)[number];

/**
 * Section kinds of the canonical Wasm component layout (host-side
 * machinery lives in runtimes/wasm): a component package carries core
 * modules, adapter shims, and custom sections, each content-addressed.
 */
export const WASM_SECTION_KINDS = ['adapter', 'core-module', 'custom'] as const;

/** One canonical section kind. */
export type WasmSectionKind = (typeof WASM_SECTION_KINDS)[number];

/** WIT-style interface name: kebab, optionally `namespace:kebab`. */
export const WASM_INTERFACE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}(:[a-z][a-z0-9-]{0,62}(\/[a-z][a-z0-9-]{0,62})?)?$/;

/** Storage key: single-line, bounded, neutral charset. */
export const STORAGE_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;

/** Log level vocabulary for `log.write`. */
export const HOST_LOG_LEVELS = ['debug', 'error', 'info', 'warn'] as const;

/** One log level. */
export type HostLogLevel = (typeof HOST_LOG_LEVELS)[number];

/** SPDX-style license identifier (or LicenseRef-…), single line. */
export const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
