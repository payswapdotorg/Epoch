/**
 * @epoch/extension-sdk — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * extension door (same policy as the W002/W006/W007 validators). Every
 * exported schema is part of the published surface emitted under
 * `schemas/`.
 *
 * Deterministic set semantics: every set-typed array (bindings, grants,
 * entry points, contracts, host functions, resource scopes,
 * contributions, sections, interfaces, functions, params, operations,
 * side effects) must be SORTED ASCENDING and duplicate-free — enforced
 * by superRefinement with PRECISE paths (the offending index), so
 * equivalent manifests have exactly one canonical serialization and one
 * content digest, and permutation is a typed validation error, not a
 * silent revision change.
 *
 * Security refinements (not representable in the structural JSON Schema
 * projection — the manifest.json fidelity note):
 * - resource scopes must be legal (domain, access) pairs;
 * - grants may only scope to BOUND capabilities;
 * - grants may not exceed the declared trust-class ceiling;
 * - entry-point kind must match the manifest flavor;
 * - `external-transfer` data handling requires the `remote` flavor.
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  MessageIdSchema,
  PARAMETER_NAME_PATTERN,
  ParameterSpecSchema,
  QUALIFIED_NAME_PATTERN,
  SLUG_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import {
  CapabilityContractReferenceSchema,
  SemverCoreSchema,
  Sha256DigestSchema,
  VersionConstraintSchema,
} from '@epoch/capability-registry';
import {
  CONTRIBUTION_KINDS,
  EXTENSION_DATA_HANDLINGS,
  EXTENSION_FLAVORS,
  EXTENSION_MANIFEST_VERSION,
  EXTENSION_SIDE_EFFECT_KINDS,
  EXTENSION_TRUST_CLASSES,
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
} from './version';
import type { ExtensionGrant } from './types';

type IssueCtx = z.RefinementCtx;

// ---------------------------------------------------------------------------
// Primitives and vocabulary schemas.
// ---------------------------------------------------------------------------

/** Opaque extension identity: `extension:` + lowercase kebab slug. */
export const ExtensionIdSchema = z
  .string()
  .regex(/^extension:[a-z0-9][a-z0-9-]{0,62}$/, 'must be "extension:" followed by a lowercase kebab slug')
  .meta({
    id: 'ExtensionId',
    title: 'ExtensionId',
    description: 'Opaque, stable extension identity: "extension:" followed by a lowercase kebab slug.',
  });

/** Entry-point name (kebab slug; unique and sorted within a manifest). */
export const EntryPointNameSchema = z
  .string()
  .regex(SLUG_PATTERN, 'must be a lowercase kebab slug')
  .meta({
    id: 'EntryPointName',
    title: 'EntryPointName',
    description: 'Entry-point name: a lowercase kebab slug, unique and sorted within a manifest.',
  });

/** Version discriminator on serialized manifests and registrations (v1). */
export const ExtensionManifestVersionSchema = z
  .literal(EXTENSION_MANIFEST_VERSION)
  .meta({
    id: 'ExtensionManifestVersion',
    title: 'ExtensionManifestVersion',
    description: 'Version discriminator carried by every serialized extension manifest and registration (currently 1).',
  });

/** Version discriminator on serialized Wasm component descriptors (v1). */
export const WasmComponentDescriptorVersionSchema = z
  .literal(1)
  .meta({
    id: 'WasmComponentDescriptorVersion',
    title: 'WasmComponentDescriptorVersion',
    description: 'Version discriminator carried by every serialized Wasm component descriptor (currently 1).',
  });

/** Extension flavor vocabulary. */
export const ExtensionFlavorSchema = z.enum(EXTENSION_FLAVORS).meta({
  id: 'ExtensionFlavor',
  title: 'ExtensionFlavor',
  description:
    'Extension flavor: declarative manifest/schema, TypeScript/React UI (abstract typed declarations), Wasm Component Model, or remote service adapter.',
});

/** Extension trust classes (T0..T4, spec/extension-architecture.md). */
export const ExtensionTrustClassSchema = z.enum(EXTENSION_TRUST_CLASSES).meta({
  id: 'ExtensionTrustClass',
  title: 'ExtensionTrustClass',
  description:
    'Extension trust class: t0 untrusted/read-only, t1 provisional model population, t2 validated simulation/evaluation, t3 trusted reversible execution, t4 certified controlled autonomy.',
});

/** Resource domains. */
export const ResourceDomainSchema = z.enum(RESOURCE_DOMAINS).meta({
  id: 'ResourceDomain',
  title: 'ResourceDomain',
  description: 'Resource domain a sandboxed extension can touch: world, evidence, storage, or capability.',
});

/** Resource access kinds. */
export const ResourceAccessSchema = z.enum(RESOURCE_ACCESSES).meta({
  id: 'ResourceAccess',
  title: 'ResourceAccess',
  description: 'Kind of access over a resource domain: read, append, write, or invoke.',
});

/** The legal (domain, access) pairs of the v1 host surface, as scope keys. */
const LEGAL_SCOPE_KEYS = new Set(LEGAL_RESOURCE_SCOPES.map((scope) => `${scope.resource}.${scope.access}`));

/** A typed resource scope (legal pairs only). */
export const ResourceScopeSchema = z
  .strictObject({
    resource: ResourceDomainSchema,
    access: ResourceAccessSchema,
  })
  .readonly()
  .superRefine((scope, ctx) => {
    if (!LEGAL_SCOPE_KEYS.has(`${scope.resource}.${scope.access}`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['access'],
        message: `("${scope.resource}", "${scope.access}") is not a legal resource scope of the v1 host surface — world is read-only, evidence appends, storage reads/writes, capability invokes`,
      });
    }
  })
  .meta({
    id: 'ResourceScope',
    title: 'ResourceScope',
    description:
      'Typed resource scope: a legal (domain, access) pair a grant carries for host calls to be permitted. The v1 host surface offers no direct world mutation.',
  });

/** Host-function ids (the closed, narrow host surface). */
export const HostFunctionIdSchema = z.enum(HOST_FUNCTION_IDS).meta({
  id: 'HostFunctionId',
  title: 'HostFunctionId',
  description:
    'Host function id: capability.invoke, clock.read, evidence.append, log.write, storage.read, storage.write, or world.read.',
});

/** Host log levels. */
export const HostLogLevelSchema = z.enum(HOST_LOG_LEVELS).meta({
  id: 'HostLogLevel',
  title: 'HostLogLevel',
  description: 'Log level of a log.write host call: debug, error, info, or warn.',
});

/** The typed host-function contract entry. */
export const HostFunctionDeclarationSchema = z
  .strictObject({
    hostFunction: HostFunctionIdSchema,
    description: z.string().min(1).max(2000),
    requiredScope: ResourceScopeSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'HostFunctionDeclaration',
    title: 'HostFunctionDeclaration',
    description:
      'Host-function contract entry: the function, what it does, and the resource scope a grant must carry (null when ambient).',
  });

/** The trust-class grant ceiling entry. */
export const TrustClassGrantCeilingSchema = z
  .strictObject({
    trustClass: ExtensionTrustClassSchema,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    hostFunctions: z.array(HostFunctionIdSchema).min(1).readonly(),
    resourceScopes: z.array(ResourceScopeSchema).min(1).readonly(),
  })
  .readonly()
  .meta({
    id: 'TrustClassGrantCeiling',
    title: 'TrustClassGrantCeiling',
    description:
      'Maximum host functions and resource scopes a manifest of a given trust class may declare; anything above the ceiling is invalid by declaration (least privilege, R24).',
  });

/** Data-handling classifications. */
export const DataHandlingClassificationSchema = z.enum(EXTENSION_DATA_HANDLINGS).meta({
  id: 'DataHandlingClassification',
  title: 'DataHandlingClassification',
  description: 'Data-handling classification: sandbox-only, tenant-scoped, or external-transfer.',
});

/** Side-effect kinds. */
export const SideEffectKindSchema = z.enum(EXTENSION_SIDE_EFFECT_KINDS).meta({
  id: 'SideEffectKind',
  title: 'SideEffectKind',
  description: 'Side-effect kind: action-proposal, evidence-append, external-effect, or sandbox-state-write.',
});

/** Declarative contribution kinds. */
export const ContributionKindSchema = z.enum(CONTRIBUTION_KINDS).meta({
  id: 'ContributionKind',
  title: 'ContributionKind',
  description: 'Declarative contribution kind: world types, mappings, reconstructions, visualizations, animations, interactions, agents, constraints, simulators, evaluators, verification methods, workflows, connectors.',
});

/** UI render-surface kinds (abstract; rendering is the app layer, W014+). */
export const UiSurfaceKindSchema = z.enum(UI_SURFACE_KINDS).meta({
  id: 'UiSurfaceKind',
  title: 'UiSurfaceKind',
  description: 'Abstract render-surface kind of a ui entry point: inspector, overlay, or panel.',
});

/** Remote transport kinds. */
export const RemoteTransportKindSchema = z.enum(REMOTE_TRANSPORT_KINDS).meta({
  id: 'RemoteTransportKind',
  title: 'RemoteTransportKind',
  description: 'Remote-service transport kind: custom, grpc, http, or mcp (protocol roles, never vendors; no endpoint in the contract).',
});

// ---------------------------------------------------------------------------
// Sorted-set helpers (precise-path determinism enforcement).
// ---------------------------------------------------------------------------

/** Report unsorted or duplicate string-array entries at the offending index. */
function checkSortedStrings(
  ctx: IssueCtx,
  values: readonly string[],
  basePath: readonly (string | number)[],
  label: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1]!;
    const current = values[index]!;
    if (current === previous) {
      ctx.addIssue({
        code: 'custom',
        path: [...basePath, index],
        message: `${label} must be duplicate-free ("${current}" repeats) — set-typed arrays are sorted ascending`,
      });
    } else if (current < previous) {
      ctx.addIssue({
        code: 'custom',
        path: [...basePath, index],
        message: `${label} must be sorted ascending ("${current}" follows "${previous}") — set-typed arrays have one canonical order`,
      });
    }
  }
}

/**
 * Report unsorted or duplicate object-array entries keyed by `keyOf`,
 * with the offending index AND key field in the issue path
 * (e.g. `sections.1.name`) — precise-path determinism enforcement.
 */
function checkSortedByKey<T>(
  ctx: IssueCtx,
  values: readonly T[],
  keyOf: (value: T) => string,
  keyField: string,
  basePath: readonly (string | number)[],
  label: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = keyOf(values[index - 1]!);
    const current = keyOf(values[index]!);
    if (current === previous) {
      ctx.addIssue({
        code: 'custom',
        path: [...basePath, index, keyField],
        message: `${label} must be duplicate-free ("${current}" repeats) — set-typed arrays are sorted ascending`,
      });
    } else if (current < previous) {
      ctx.addIssue({
        code: 'custom',
        path: [...basePath, index, keyField],
        message: `${label} must be sorted ascending ("${current}" follows "${previous}") — set-typed arrays have one canonical order`,
      });
    }
  }
}

const scopeKey = (scope: { resource: string; access: string }): string => `${scope.resource}.${scope.access}`;

// ---------------------------------------------------------------------------
// Capability bindings and grants.
// ---------------------------------------------------------------------------

/** A capability binding (opaque id + version range, W007 vocabulary). */
export const CapabilityBindingSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    versionRange: VersionConstraintSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityBinding',
    title: 'CapabilityBinding',
    description:
      'Capability binding: the opaque capability id and the version range this extension binds to (R18 — never a floating reference; the host resolves the concrete version).',
  });

/**
 * One declared permission grant — the allow-list unit. Set-typed arrays
 * are sorted + duplicate-free (canonical set semantics).
 */
export const ExtensionGrantSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    hostFunctions: z.array(HostFunctionIdSchema).min(1).readonly(),
    resourceScopes: z.array(ResourceScopeSchema).readonly(),
  })
  .readonly()
  .superRefine((grant, ctx) => {
    checkSortedStrings(ctx, grant.hostFunctions, ['hostFunctions'], 'grant hostFunctions');
    checkSortedByKey(ctx, grant.resourceScopes, scopeKey, 'resource', ['resourceScopes'], 'grant resourceScopes');
  })
  .meta({
    id: 'ExtensionGrant',
    title: 'ExtensionGrant',
    description:
      'Declared permission grant: capability-scoped host-function allow-list plus resource scopes; enforcement denies anything not explicitly granted.',
  });

// ---------------------------------------------------------------------------
// Wasm Component Model descriptor (author side; host machinery in runtimes/wasm).
// ---------------------------------------------------------------------------

/** Wasm component parameter (WIT primitive type). */
export const WasmParamDeclarationSchema = z
  .strictObject({
    name: z.string().regex(SLUG_PATTERN),
    type: z.enum(WASM_VALUE_TYPES),
  })
  .readonly()
  .meta({
    id: 'WasmParamDeclaration',
    title: 'WasmParamDeclaration',
    description: 'Wasm component parameter: kebab name plus WIT primitive type.',
  });

/** WIT primitive value types. */
export const WasmValueTypeSchema = z.enum(WASM_VALUE_TYPES).meta({
  id: 'WasmValueType',
  title: 'WasmValueType',
  description: 'WIT primitive value type: bool, char, f32, f64, s8..s64, string, or u8..u64.',
});

/** Canonical section kinds. */
export const WasmSectionKindSchema = z.enum(WASM_SECTION_KINDS).meta({
  id: 'WasmSectionKind',
  title: 'WasmSectionKind',
  description: 'Canonical Wasm section kind: adapter, core-module, or custom.',
});

/** One function of a Wasm interface declaration. */
export const ComponentFunctionDeclarationSchema = z
  .strictObject({
    functionName: z.string().regex(SLUG_PATTERN),
    params: z.array(WasmParamDeclarationSchema).readonly(),
    result: z.enum(WASM_VALUE_TYPES).optional(),
  })
  .readonly()
  .superRefine((func, ctx) => {
    checkSortedByKey(ctx, func.params, (param) => param.name, 'name', ['params'], 'function params');
  })
  .meta({
    id: 'ComponentFunctionDeclaration',
    title: 'ComponentFunctionDeclaration',
    description: 'One function of a Wasm component interface: kebab name, sorted parameters, optional result type.',
  });

/** One import/export interface of a Wasm component world. */
export const ComponentInterfaceDeclarationSchema = z
  .strictObject({
    interfaceName: z.string().regex(WASM_INTERFACE_NAME_PATTERN),
    functions: z.array(ComponentFunctionDeclarationSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((iface, ctx) => {
    checkSortedByKey(
      ctx,
      iface.functions,
      (func) => func.functionName,
      'functionName',
      ['functions'],
      'interface functions',
    );
  })
  .meta({
    id: 'ComponentInterfaceDeclaration',
    title: 'ComponentInterfaceDeclaration',
    description:
      'One import/export interface of a Wasm component world: WIT-style name (kebab or ns:kebab) and its sorted, duplicate-free function surface.',
  });

/** One canonical layout section. */
export const LayoutSectionSchema = z
  .strictObject({
    name: z.string().regex(SLUG_PATTERN),
    kind: WasmSectionKindSchema,
    byteSize: z.number().int().min(0),
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'LayoutSection',
    title: 'LayoutSection',
    description:
      'Canonical layout section: kebab name, kind (adapter/core-module/custom), byte size, and the SHA-256 content digest of the section bytes.',
  });

/**
 * The Wasm Component Model descriptor (author side). Canonical ordering
 * refinements: imports/exports sorted by interface name; sections sorted
 * by name; at least one export; at least one section. Host-side
 * validation (runtimes/wasm) deliberately re-validates independently.
 */
export const WasmComponentDescriptorSchema = z
  .strictObject({
    schemaVersion: WasmComponentDescriptorVersionSchema,
    componentId: z.string().regex(QUALIFIED_NAME_PATTERN),
    componentVersion: SemverCoreSchema,
    worldName: z.string().regex(SLUG_PATTERN),
    imports: z.array(ComponentInterfaceDeclarationSchema).readonly(),
    exports: z.array(ComponentInterfaceDeclarationSchema).min(1).readonly(),
    sections: z.array(LayoutSectionSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((component, ctx) => {
    checkSortedByKey(
      ctx,
      component.imports,
      (iface) => iface.interfaceName,
      'interfaceName',
      ['imports'],
      'component imports',
    );
    checkSortedByKey(
      ctx,
      component.exports,
      (iface) => iface.interfaceName,
      'interfaceName',
      ['exports'],
      'component exports',
    );
    checkSortedByKey(ctx, component.sections, (section) => section.name, 'name', [
      'sections',
    ], 'component sections');
  })
  .meta({
    id: 'WasmComponentDescriptor',
    title: 'WasmComponentDescriptor',
    description:
      'Wasm Component Model descriptor: component identity, WIT world (imports/exports), and the canonical section layout with per-section digests. Zero vendored toolchains, zero binaries.',
  });

// ---------------------------------------------------------------------------
// Remote service descriptor (typed shape only — no endpoint, no vendor).
// ---------------------------------------------------------------------------

/** One declared remote operation. */
export const RemoteOperationDeclarationSchema = z
  .strictObject({
    name: z.string().regex(SLUG_PATTERN),
    inputs: z.array(ParameterSpecSchema).readonly(),
    outputs: z.array(ParameterSpecSchema).readonly(),
  })
  .readonly()
  .superRefine((operation, ctx) => {
    checkSortedByKey(ctx, operation.inputs, (spec) => spec.name, 'name', ['inputs'], 'operation inputs');
    checkSortedByKey(ctx, operation.outputs, (spec) => spec.name, 'name', ['outputs'], 'operation outputs');
  })
  .meta({
    id: 'RemoteOperationDeclaration',
    title: 'RemoteOperationDeclaration',
    description: 'One declared remote operation: kebab name plus typed inputs/outputs (shared ParameterSpec shape).',
  });

/** The remote-service descriptor (typed shape only). */
export const RemoteServiceDescriptorSchema = z
  .strictObject({
    serviceId: z.string().regex(QUALIFIED_NAME_PATTERN),
    transport: RemoteTransportKindSchema,
    contract: CapabilityContractReferenceSchema,
    operations: z.array(RemoteOperationDeclarationSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((service, ctx) => {
    checkSortedByKey(
      ctx,
      service.operations,
      (operation) => operation.name,
      'name',
      ['operations'],
      'service operations',
    );
  })
  .meta({
    id: 'RemoteServiceDescriptor',
    title: 'RemoteServiceDescriptor',
    description:
      'Remote-service descriptor: opaque service id, transport kind, the versioned contract it honors, and its operation surface. Endpoint binding is deployment configuration (W029), never contract content.',
  });

// ---------------------------------------------------------------------------
// Entry points (per flavor).
// ---------------------------------------------------------------------------

/** Declarative-flavor entry point. */
export const DeclarativeEntryPointSchema = z
  .strictObject({
    kind: z.literal('declarative'),
    name: EntryPointNameSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    contributions: z.array(ContributionKindSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((entry, ctx) => {
    checkSortedStrings(ctx, entry.contributions, ['contributions'], 'declarative contributions');
  })
  .meta({
    id: 'DeclarativeEntryPoint',
    title: 'DeclarativeEntryPoint',
    description: 'Declarative entry point: a typed contribution declaration (world types, mappings, constraints, ...) with no executable content.',
  });

/** UI-flavor entry point (abstract typed declaration; no React here). */
export const UiEntryPointSchema = z
  .strictObject({
    kind: z.literal('ui'),
    name: EntryPointNameSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    surface: UiSurfaceKindSchema,
    inputs: z.array(ParameterSpecSchema).readonly(),
    outputs: z.array(ParameterSpecSchema).readonly(),
  })
  .readonly()
  .superRefine((entry, ctx) => {
    checkSortedByKey(ctx, entry.inputs, (spec) => spec.name, 'name', ['inputs'], 'ui inputs');
    checkSortedByKey(ctx, entry.outputs, (spec) => spec.name, 'name', ['outputs'], 'ui outputs');
  })
  .meta({
    id: 'UiEntryPoint',
    title: 'UiEntryPoint',
    description:
      'UI entry point: abstract typed declaration of one render surface (kind + parameter specs). Rendering is the app layer (W014+); React is not a dependency here.',
  });

/** Wasm-flavor entry point. */
export const WasmEntryPointSchema = z
  .strictObject({
    kind: z.literal('wasm'),
    name: EntryPointNameSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    component: WasmComponentDescriptorSchema,
  })
  .readonly()
  .meta({
    id: 'WasmEntryPoint',
    title: 'WasmEntryPoint',
    description: 'Wasm entry point: embeds one Wasm Component Model descriptor (host-side machinery in runtimes/wasm).',
  });

/** Remote-flavor entry point. */
export const RemoteEntryPointSchema = z
  .strictObject({
    kind: z.literal('remote'),
    name: EntryPointNameSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    service: RemoteServiceDescriptorSchema,
  })
  .readonly()
  .meta({
    id: 'RemoteEntryPoint',
    title: 'RemoteEntryPoint',
    description: 'Remote entry point: embeds one remote-service descriptor (typed shape only).',
  });

/** One declared extension entry point (discriminated on `kind`). */
export const EntryPointDeclarationSchema = z
  .discriminatedUnion('kind', [
    DeclarativeEntryPointSchema,
    UiEntryPointSchema,
    WasmEntryPointSchema,
    RemoteEntryPointSchema,
  ])
  .meta({
    id: 'EntryPointDeclaration',
    title: 'EntryPointDeclaration',
    description:
      'One declared extension entry point: declarative, ui, wasm, or remote. The kind must match the manifest flavor (refinement-enforced).',
  });

// ---------------------------------------------------------------------------
// Manifest-level declarations.
// ---------------------------------------------------------------------------

/** One declared side effect. */
export const ExtensionSideEffectSchema = z
  .strictObject({
    kind: SideEffectKindSchema,
    description: z.string().min(1).max(2000),
  })
  .readonly()
  .meta({
    id: 'ExtensionSideEffect',
    title: 'ExtensionSideEffect',
    description: 'One declared side effect: kind plus description (empty list = declared purity).',
  });

/** Data-handling declaration. */
export const ExtensionDataHandlingSchema = z
  .strictObject({
    classification: DataHandlingClassificationSchema,
    notes: z.string().max(4000).optional(),
  })
  .readonly()
  .meta({
    id: 'ExtensionDataHandling',
    title: 'ExtensionDataHandling',
    description:
      'Data-handling declaration: sandbox-only, tenant-scoped, or external-transfer (external-transfer requires the remote flavor).',
  });

const ceilingFor = (trustClass: string) =>
  TRUST_CLASS_GRANT_CEILINGS.find((ceiling) => ceiling.trustClass === trustClass)!;

const grantExceedsCeiling = (grant: ExtensionGrant, trustClass: string): { host?: string; scope?: string } => {
  const ceiling = ceilingFor(trustClass);
  for (const fn of grant.hostFunctions) {
    if (!ceiling.hostFunctions.includes(fn)) return { host: fn };
  }
  for (const scope of grant.resourceScopes) {
    if (!ceiling.resourceScopes.some((allowed) => allowed.resource === scope.resource && allowed.access === scope.access)) {
      return { scope: `${scope.resource}.${scope.access}` };
    }
  }
  return {};
};

/**
 * The extension manifest (v1). Canonical set semantics + security
 * refinements (precise paths):
 * - capabilityBindings: min 1, sorted + unique by capabilityId;
 * - grants: sorted + unique by capabilityId, each grant scoped to a
 *   BOUND capability, each grant within the trust-class ceiling;
 * - entryPoints: min 1, sorted + unique by name, kind matches flavor;
 * - contracts: sorted + unique by contractId;
 * - sideEffects: sorted + unique by (kind, description);
 * - dataHandling external-transfer requires the remote flavor.
 */
export const ExtensionManifestSchema = z
  .strictObject({
    schemaVersion: ExtensionManifestVersionSchema,
    extensionId: ExtensionIdSchema,
    version: SemverCoreSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    flavor: ExtensionFlavorSchema,
    capabilityBindings: z.array(CapabilityBindingSchema).min(1).readonly(),
    grants: z.array(ExtensionGrantSchema).readonly(),
    entryPoints: z.array(EntryPointDeclarationSchema).min(1).readonly(),
    contracts: z.array(CapabilityContractReferenceSchema).readonly(),
    trustClass: ExtensionTrustClassSchema,
    license: z.string().regex(LICENSE_PATTERN, 'must be an SPDX-style identifier (or LicenseRef-...)'),
    dataHandling: ExtensionDataHandlingSchema,
    sideEffects: z.array(ExtensionSideEffectSchema).readonly(),
  })
  .readonly()
  .superRefine((manifest, ctx) => {
    checkSortedByKey(
      ctx,
      manifest.capabilityBindings,
      (binding) => binding.capabilityId,
      'capabilityId',
      ['capabilityBindings'],
      'capabilityBindings',
    );
    checkSortedByKey(ctx, manifest.grants, (grant) => grant.capabilityId, 'capabilityId', ['grants'], 'grants');
    checkSortedByKey(
      ctx,
      manifest.entryPoints,
      (entry) => entry.name,
      'name',
      ['entryPoints'],
      'entryPoints',
    );
    checkSortedByKey(
      ctx,
      manifest.contracts,
      (reference) => reference.contractId,
      'contractId',
      ['contracts'],
      'contracts',
    );
    checkSortedByKey(
      ctx,
      manifest.sideEffects,
      (effect) => `${effect.kind}:${effect.description}`,
      'kind',
      ['sideEffects'],
      'sideEffects',
    );

    const boundIds = new Set(manifest.capabilityBindings.map((binding) => binding.capabilityId));
    manifest.grants.forEach((grant, grantIndex) => {
      if (!boundIds.has(grant.capabilityId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'capabilityId'],
          message: `grants may only scope to BOUND capabilities — "${grant.capabilityId}" is not in capabilityBindings (cross-capability access is inexpressible by declaration)`,
        });
      }
      const exceeding = grantExceedsCeiling(grant, manifest.trustClass);
      if (exceeding.host !== undefined) {
        const fnIndex = grant.hostFunctions.indexOf(exceeding.host as never);
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'hostFunctions', fnIndex],
          message: `host function "${exceeding.host}" exceeds the ${manifest.trustClass} trust-class grant ceiling (least privilege, R24) — escalation by declaration is inexpressible`,
        });
      }
      if (exceeding.scope !== undefined) {
        const scopeIndex = grant.resourceScopes.findIndex(
          (scope) => `${scope.resource}.${scope.access}` === exceeding.scope,
        );
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'resourceScopes', scopeIndex],
          message: `resource scope "${exceeding.scope}" exceeds the ${manifest.trustClass} trust-class grant ceiling (least privilege, R24) — escalation by declaration is inexpressible`,
        });
      }
    });

    manifest.entryPoints.forEach((entry, entryIndex) => {
      if (entry.kind !== manifest.flavor) {
        ctx.addIssue({
          code: 'custom',
          path: ['entryPoints', entryIndex, 'kind'],
          message: `entry point kind "${entry.kind}" does not match the manifest flavor "${manifest.flavor}"`,
        });
      }
    });

    if (manifest.dataHandling.classification === 'external-transfer' && manifest.flavor !== 'remote') {
      ctx.addIssue({
        code: 'custom',
        path: ['dataHandling', 'classification'],
        message: `"external-transfer" data handling requires the "remote" flavor — the sandboxed host surface performs no network transfer itself`,
      });
    }
  })
  .meta({
    id: 'ExtensionManifest',
    title: 'ExtensionManifest',
    description:
      'Immutable, content-addressed extension manifest: identity, version, flavor, capability bindings, permission grants, entry points, honored contracts, trust class, license, data handling, and declared side effects.',
  });

/** A registration envelope (manifest + claimed digest). */
export const ExtensionRegistrationSchema = z
  .strictObject({
    manifest: ExtensionManifestSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'ExtensionRegistration',
    title: 'ExtensionRegistration',
    description:
      'Registration envelope: the manifest plus the digest claimed for its content; the host recomputes and rejects mismatches (tamper detection).',
  });

// ---------------------------------------------------------------------------
// Host-function request/response payload contracts.
// ---------------------------------------------------------------------------

/** `clock.read` request. */
export const ClockReadRequestSchema = z
  .strictObject({ instant: z.literal(true) })
  .readonly()
  .meta({ id: 'ClockReadRequest', title: 'ClockReadRequest', description: 'clock.read request (marker form; no parameters).' });

/** `clock.read` response. */
export const ClockReadResponseSchema = z
  .strictObject({ instant: TimestampSchema })
  .readonly()
  .meta({ id: 'ClockReadResponse', title: 'ClockReadResponse', description: 'clock.read response: the host-provided UTC instant (canonical form).' });

/** `log.write` request. */
export const LogWriteRequestSchema = z
  .strictObject({
    level: HostLogLevelSchema,
    message: z.string().min(1).max(2000),
  })
  .readonly()
  .meta({ id: 'LogWriteRequest', title: 'LogWriteRequest', description: 'log.write request: level plus message.' });

/** `log.write` response. */
export const LogWriteResponseSchema = z
  .strictObject({ logged: z.literal(true) })
  .readonly()
  .meta({ id: 'LogWriteResponse', title: 'LogWriteResponse', description: 'log.write response (acknowledgement marker).' });

/** `world.read` request. */
export const WorldReadRequestSchema = z
  .strictObject({
    entityRefs: z.array(z.string().min(1).max(256)).min(1).max(64).readonly(),
  })
  .readonly()
  .meta({ id: 'WorldReadRequest', title: 'WorldReadRequest', description: 'world.read request: entity references to project (bounded: 1..64).' });

/** `world.read` response. */
export const WorldReadResponseSchema = z
  .strictObject({
    snapshots: z.array(JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({ id: 'WorldReadResponse', title: 'WorldReadResponse', description: 'world.read response: one read-only projection snapshot per requested ref (null when unknown).' });

/** `evidence.append` request. */
export const EvidenceAppendRequestSchema = z
  .strictObject({
    statement: z.string().min(1).max(4000),
    subjectDigest: Sha256DigestSchema.optional(),
  })
  .readonly()
  .meta({ id: 'EvidenceAppendRequest', title: 'EvidenceAppendRequest', description: 'evidence.append request: statement plus optional subject digest.' });

/** `evidence.append` response. */
export const EvidenceAppendResponseSchema = z
  .strictObject({ evidenceId: MessageIdSchema })
  .readonly()
  .meta({ id: 'EvidenceAppendResponse', title: 'EvidenceAppendResponse', description: 'evidence.append response: the opaque evidence id.' });

/** `capability.invoke` request. */
export const CapabilityInvokeRequestSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    inputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({ id: 'CapabilityInvokeRequest', title: 'CapabilityInvokeRequest', description: 'capability.invoke request: the bound capability plus named inputs (parameter-name keys).' });

/** `capability.invoke` response. */
export const CapabilityInvokeResponseSchema = z
  .strictObject({
    outputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({ id: 'CapabilityInvokeResponse', title: 'CapabilityInvokeResponse', description: 'capability.invoke response: named outputs.' });

/** `storage.read` request. */
export const StorageReadRequestSchema = z
  .strictObject({
    key: z.string().regex(STORAGE_KEY_PATTERN),
  })
  .readonly()
  .meta({ id: 'StorageReadRequest', title: 'StorageReadRequest', description: 'storage.read request: the extension-scoped storage key.' });

/** `storage.read` response. */
export const StorageReadResponseSchema = z
  .strictObject({
    value: JsonValueSchema,
  })
  .readonly()
  .meta({ id: 'StorageReadResponse', title: 'StorageReadResponse', description: 'storage.read response: the stored value (null = absent).' });

/** `storage.write` request. */
export const StorageWriteRequestSchema = z
  .strictObject({
    key: z.string().regex(STORAGE_KEY_PATTERN),
    value: JsonValueSchema,
  })
  .readonly()
  .meta({ id: 'StorageWriteRequest', title: 'StorageWriteRequest', description: 'storage.write request: the extension-scoped key plus the JSON value.' });

/** `storage.write` response. */
export const StorageWriteResponseSchema = z
  .strictObject({ written: z.literal(true) })
  .readonly()
  .meta({ id: 'StorageWriteResponse', title: 'StorageWriteResponse', description: 'storage.write response (acknowledgement marker).' });
