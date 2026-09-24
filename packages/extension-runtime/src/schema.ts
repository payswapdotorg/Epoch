/**
 * @epoch/extension-runtime — runtime zod validators.
 *
 * Two groups:
 *
 * 1. The manifest/grant/entry-point MIRROR of the @epoch/extension-sdk
 *    contract (parity-pinned by test/sdk-parity.test.ts; NO runtime
 *    dependency): strict objects reject unknown fields; the same
 *    sorted-set, grants-subset-bindings, trust-ceiling, flavor-match,
 *    and data-handling refinements as the SDK schema.
 *
 * 2. The runtime's OWN machinery documents: invocation envelopes,
 *    per-function request/response payload mirrors, sandbox surface
 *    descriptions, audit records, and admitted records.
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
  DATA_HANDLING_CLASSIFICATIONS,
  EXTENSION_FLAVORS,
  EXTENSION_TRUST_CLASSES,
  HOST_FUNCTION_IDS,
  HOST_LOG_LEVELS,
  REMOTE_TRANSPORT_KINDS,
  RESOURCE_ACCESSES,
  RESOURCE_DOMAINS,
  SIDE_EFFECT_KINDS,
  STORAGE_KEY_PATTERN,
  UI_SURFACE_KINDS,
  WASM_INTERFACE_NAME_PATTERN,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
  grantExceedsCeiling,
  scopeKey,
} from './mirror';
import {
  EXTENSION_INVOCATION_ENVELOPE_VERSION,
  HOST_EXECUTION_FAILURE_CODES,
  SANDBOX_SURFACE_DESCRIPTION_VERSION,
} from './version';
import type { ExtensionGrantView } from './types';

type IssueCtx = z.RefinementCtx;

// ---------------------------------------------------------------------------
// Sorted-set helpers (precise-path determinism enforcement — mirror of
// the SDK's helpers; identical messages so parity fixtures report the
// same paths).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Manifest mirror (parity-pinned against @epoch/extension-sdk).
// ---------------------------------------------------------------------------

/** Mirrored extension id. */
export const ExtensionIdViewSchema = z
  .string()
  .regex(/^extension:[a-z0-9][a-z0-9-]{0,62}$/, 'must be "extension:" followed by a lowercase kebab slug')
  .meta({ id: 'ExtensionIdView', title: 'ExtensionIdView', description: 'Mirrored extension identity: "extension:" + lowercase kebab slug.' });

/** Mirrored resource scope (legal pairs only). */
export const ResourceScopeMirrorSchema = z
  .strictObject({
    resource: z.enum(RESOURCE_DOMAINS),
    access: z.enum(RESOURCE_ACCESSES),
  })
  .readonly()
  .superRefine((scope, ctx) => {
    const legal = ['world.read', 'evidence.append', 'storage.read', 'storage.write', 'capability.invoke'];
    if (!legal.includes(`${scope.resource}.${scope.access}`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['access'],
        message: `("${scope.resource}", "${scope.access}") is not a legal resource scope of the v1 host surface — world is read-only, evidence appends, storage reads/writes, capability invokes`,
      });
    }
  })
  .meta({ id: 'ResourceScopeMirror', title: 'ResourceScopeMirror', description: 'Mirrored typed resource scope (legal domain/access pairs only).' });

/** Mirrored host function id. */
export const HostFunctionIdViewSchema = z.enum(HOST_FUNCTION_IDS).meta({
  id: 'HostFunctionIdView',
  title: 'HostFunctionIdView',
  description: 'Mirrored host function id (the narrow closed set).',
});

/** Mirrored capability binding. */
export const CapabilityBindViewSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    versionRange: VersionConstraintSchema,
  })
  .readonly()
  .meta({ id: 'CapabilityBindView', title: 'CapabilityBindView', description: 'Mirrored capability binding (opaque id + version range).' });

/** Mirrored declared grant. */
export const ExtensionGrantViewSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    hostFunctions: z.array(HostFunctionIdViewSchema).min(1).readonly(),
    resourceScopes: z.array(ResourceScopeMirrorSchema).readonly(),
  })
  .readonly()
  .superRefine((grant, ctx) => {
    checkSortedStrings(ctx, grant.hostFunctions, ['hostFunctions'], 'grant hostFunctions');
    checkSortedByKey(ctx, grant.resourceScopes, scopeKey, 'resource', ['resourceScopes'], 'grant resourceScopes');
  })
  .meta({ id: 'ExtensionGrantView', title: 'ExtensionGrantView', description: 'Mirrored declared permission grant (the allow-list unit).' });

/** Mirrored Wasm parameter declaration. */
export const WasmParamViewSchema = z
  .strictObject({
    name: z.string().regex(SLUG_PATTERN),
    type: z.enum(WASM_VALUE_TYPES),
  })
  .readonly()
  .meta({ id: 'WasmParamView', title: 'WasmParamView', description: 'Mirrored Wasm component parameter.' });

/** Mirrored component function declaration. */
export const ComponentFunctionViewSchema = z
  .strictObject({
    functionName: z.string().regex(SLUG_PATTERN),
    params: z.array(WasmParamViewSchema).readonly(),
    result: z.enum(WASM_VALUE_TYPES).optional(),
  })
  .readonly()
  .superRefine((func, ctx) => {
    checkSortedByKey(ctx, func.params, (param) => param.name, 'name', ['params'], 'function params');
  })
  .meta({ id: 'ComponentFunctionView', title: 'ComponentFunctionView', description: 'Mirrored component function declaration.' });

/** Mirrored component interface declaration. */
export const ComponentInterfaceViewSchema = z
  .strictObject({
    interfaceName: z.string().regex(WASM_INTERFACE_NAME_PATTERN),
    functions: z.array(ComponentFunctionViewSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((iface, ctx) => {
    checkSortedByKey(ctx, iface.functions, (func) => func.functionName, 'functionName', ['functions'], 'interface functions');
  })
  .meta({ id: 'ComponentInterfaceView', title: 'ComponentInterfaceView', description: 'Mirrored component interface declaration.' });

/** Mirrored layout section. */
export const LayoutSectionViewSchema = z
  .strictObject({
    name: z.string().regex(SLUG_PATTERN),
    kind: z.enum(WASM_SECTION_KINDS),
    byteSize: z.number().int().min(0),
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({ id: 'LayoutSectionView', title: 'LayoutSectionView', description: 'Mirrored canonical layout section.' });

/** Mirrored Wasm component descriptor. */
export const WasmComponentDescriptorViewSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    componentId: z.string().regex(QUALIFIED_NAME_PATTERN),
    componentVersion: SemverCoreSchema,
    worldName: z.string().regex(SLUG_PATTERN),
    imports: z.array(ComponentInterfaceViewSchema).readonly(),
    exports: z.array(ComponentInterfaceViewSchema).min(1).readonly(),
    sections: z.array(LayoutSectionViewSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((component, ctx) => {
    checkSortedByKey(ctx, component.imports, (iface) => iface.interfaceName, 'interfaceName', ['imports'], 'component imports');
    checkSortedByKey(ctx, component.exports, (iface) => iface.interfaceName, 'interfaceName', ['exports'], 'component exports');
    checkSortedByKey(ctx, component.sections, (section) => section.name, 'name', ['sections'], 'component sections');
  })
  .meta({ id: 'WasmComponentDescriptorView', title: 'WasmComponentDescriptorView', description: 'Mirrored Wasm component descriptor (host-side view).' });

/** Mirrored remote operation declaration. */
export const RemoteOperationViewSchema = z
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
  .meta({ id: 'RemoteOperationView', title: 'RemoteOperationView', description: 'Mirrored remote operation declaration.' });

/** Mirrored remote service descriptor. */
export const RemoteServiceDescriptorViewSchema = z
  .strictObject({
    serviceId: z.string().regex(QUALIFIED_NAME_PATTERN),
    transport: z.enum(REMOTE_TRANSPORT_KINDS),
    contract: CapabilityContractReferenceSchema,
    operations: z.array(RemoteOperationViewSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((service, ctx) => {
    checkSortedByKey(ctx, service.operations, (operation) => operation.name, 'name', ['operations'], 'service operations');
  })
  .meta({ id: 'RemoteServiceDescriptorView', title: 'RemoteServiceDescriptorView', description: 'Mirrored remote service descriptor.' });

/** Mirrored declarative entry point. */
export const DeclarativeEntryPointViewSchema = z
  .strictObject({
    kind: z.literal('declarative'),
    name: z.string().regex(SLUG_PATTERN),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    contributions: z.array(z.enum(CONTRIBUTION_KINDS)).min(1).readonly(),
  })
  .readonly()
  .superRefine((entry, ctx) => {
    checkSortedStrings(ctx, entry.contributions, ['contributions'], 'declarative contributions');
  })
  .meta({ id: 'DeclarativeEntryPointView', title: 'DeclarativeEntryPointView', description: 'Mirrored declarative entry point.' });

/** Mirrored ui entry point. */
export const UiEntryPointViewSchema = z
  .strictObject({
    kind: z.literal('ui'),
    name: z.string().regex(SLUG_PATTERN),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    surface: z.enum(UI_SURFACE_KINDS),
    inputs: z.array(ParameterSpecSchema).readonly(),
    outputs: z.array(ParameterSpecSchema).readonly(),
  })
  .readonly()
  .superRefine((entry, ctx) => {
    checkSortedByKey(ctx, entry.inputs, (spec) => spec.name, 'name', ['inputs'], 'ui inputs');
    checkSortedByKey(ctx, entry.outputs, (spec) => spec.name, 'name', ['outputs'], 'ui outputs');
  })
  .meta({ id: 'UiEntryPointView', title: 'UiEntryPointView', description: 'Mirrored ui entry point (abstract typed declaration).' });

/** Mirrored wasm entry point. */
export const WasmEntryPointViewSchema = z
  .strictObject({
    kind: z.literal('wasm'),
    name: z.string().regex(SLUG_PATTERN),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    component: WasmComponentDescriptorViewSchema,
  })
  .readonly()
  .meta({ id: 'WasmEntryPointView', title: 'WasmEntryPointView', description: 'Mirrored wasm entry point.' });

/** Mirrored remote entry point. */
export const RemoteEntryPointViewSchema = z
  .strictObject({
    kind: z.literal('remote'),
    name: z.string().regex(SLUG_PATTERN),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    service: RemoteServiceDescriptorViewSchema,
  })
  .readonly()
  .meta({ id: 'RemoteEntryPointView', title: 'RemoteEntryPointView', description: 'Mirrored remote entry point.' });

/** Mirrored entry-point declaration union. */
export const EntryPointViewSchema = z
  .discriminatedUnion('kind', [
    DeclarativeEntryPointViewSchema,
    UiEntryPointViewSchema,
    WasmEntryPointViewSchema,
    RemoteEntryPointViewSchema,
  ])
  .meta({ id: 'EntryPointView', title: 'EntryPointView', description: 'Mirrored entry-point declaration (discriminated on kind).' });

/** Mirrored side-effect declaration. */
export const ExtensionSideEffectViewSchema = z
  .strictObject({
    kind: z.enum(SIDE_EFFECT_KINDS),
    description: z.string().min(1).max(2000),
  })
  .readonly()
  .meta({ id: 'ExtensionSideEffectView', title: 'ExtensionSideEffectView', description: 'Mirrored side-effect declaration.' });

/** Mirrored data handling. */
export const ExtensionDataHandlingViewSchema = z
  .strictObject({
    classification: z.enum(DATA_HANDLING_CLASSIFICATIONS),
    notes: z.string().max(4000).optional(),
  })
  .readonly()
  .meta({ id: 'ExtensionDataHandlingView', title: 'ExtensionDataHandlingView', description: 'Mirrored data-handling declaration.' });

/**
 * The manifest mirror: the admission pipeline validates every submitted
 * manifest against this (defense in depth — the host boundary never
 * trusts author-side tooling). Same refinements as the SDK schema.
 */
export const ExtensionManifestViewSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    extensionId: ExtensionIdViewSchema,
    version: SemverCoreSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    flavor: z.enum(EXTENSION_FLAVORS),
    capabilityBindings: z.array(CapabilityBindViewSchema).min(1).readonly(),
    grants: z.array(ExtensionGrantViewSchema).readonly(),
    entryPoints: z.array(EntryPointViewSchema).min(1).readonly(),
    contracts: z.array(CapabilityContractReferenceSchema).readonly(),
    trustClass: z.enum(EXTENSION_TRUST_CLASSES),
    license: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/, 'must be an SPDX-style identifier (or LicenseRef-...)'),
    dataHandling: ExtensionDataHandlingViewSchema,
    sideEffects: z.array(ExtensionSideEffectViewSchema).readonly(),
  })
  .readonly()
  .superRefine((manifest, ctx) => {
    checkSortedByKey(ctx, manifest.capabilityBindings, (binding) => binding.capabilityId, 'capabilityId', ['capabilityBindings'], 'capabilityBindings');
    checkSortedByKey(ctx, manifest.grants, (grant) => grant.capabilityId, 'capabilityId', ['grants'], 'grants');
    checkSortedByKey(ctx, manifest.entryPoints, (entry) => entry.name, 'name', ['entryPoints'], 'entryPoints');
    checkSortedByKey(ctx, manifest.contracts, (reference) => reference.contractId, 'contractId', ['contracts'], 'contracts');
    checkSortedByKey(
      ctx,
      manifest.sideEffects,
      (effect) => `${effect.kind}:${effect.description}`,
      'kind',
      ['sideEffects'],
      'sideEffects',
    );

    const boundIds = new Set(manifest.capabilityBindings.map((binding) => binding.capabilityId));
    manifest.grants.forEach((grant: ExtensionGrantView, grantIndex: number) => {
      if (!boundIds.has(grant.capabilityId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'capabilityId'],
          message: `grants may only scope to BOUND capabilities — "${grant.capabilityId}" is not in capabilityBindings (cross-capability access is inexpressible by declaration)`,
        });
      }
      const exceeding = grantExceedsCeiling(grant, manifest.trustClass);
      if (exceeding.hostFunction !== undefined) {
        const fnIndex = grant.hostFunctions.indexOf(exceeding.hostFunction as never);
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'hostFunctions', fnIndex],
          message: `host function "${exceeding.hostFunction}" exceeds the ${manifest.trustClass} trust-class grant ceiling (least privilege, R24) — escalation by declaration is inexpressible`,
        });
      }
      if (exceeding.resourceScope !== undefined) {
        const scopeIndex = grant.resourceScopes.findIndex(
          (scope) => `${scope.resource}.${scope.access}` === exceeding.resourceScope,
        );
        ctx.addIssue({
          code: 'custom',
          path: ['grants', grantIndex, 'resourceScopes', scopeIndex],
          message: `resource scope "${exceeding.resourceScope}" exceeds the ${manifest.trustClass} trust-class grant ceiling (least privilege, R24) — escalation by declaration is inexpressible`,
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
    id: 'ExtensionManifestView',
    title: 'ExtensionManifestView',
    description:
      'The runtime\u2019s full structural view of an extension manifest (parity-pinned mirror of @epoch/extension-sdk; strict, sorted-set, trust-ceiling, flavor-match refinements).',
  });

// ---------------------------------------------------------------------------
// Runtime-owned machinery documents.
// ---------------------------------------------------------------------------

/** Envelope version discriminator. */
export const InvocationEnvelopeVersionSchema = z
  .literal(EXTENSION_INVOCATION_ENVELOPE_VERSION)
  .meta({ id: 'InvocationEnvelopeVersion', title: 'InvocationEnvelopeVersion', description: 'Version discriminator on invocation envelopes (currently 1).' });

/** The typed host invocation envelope. */
export const HostInvocationEnvelopeSchema = z
  .strictObject({
    schemaVersion: InvocationEnvelopeVersionSchema,
    envelopeId: MessageIdSchema,
    extensionId: ExtensionIdViewSchema,
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    hostFunction: HostFunctionIdViewSchema,
    payload: JsonValueSchema,
  })
  .readonly()
  .meta({
    id: 'HostInvocationEnvelope',
    title: 'HostInvocationEnvelope',
    description:
      'One typed host invocation envelope: session identity, capability scope, host function, and JSON payload (validated against the per-function request contract before dispatch).',
  });

/** Surface-description version discriminator. */
export const SandboxSurfaceDescriptionVersionSchema = z
  .literal(SANDBOX_SURFACE_DESCRIPTION_VERSION)
  .meta({ id: 'SandboxSurfaceDescriptionVersion', title: 'SandboxSurfaceDescriptionVersion', description: 'Version discriminator on sandbox surface descriptions (currently 1).' });

/** One resolved binding pin as published in the surface description. */
export const ResolvedCapabilityBindingSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    capabilityVersion: SemverCoreSchema,
    capabilityManifestDigest: Sha256DigestSchema,
    bindingConstraint: VersionConstraintSchema,
  })
  .readonly()
  .meta({
    id: 'ResolvedCapabilityBinding',
    title: 'ResolvedCapabilityBinding',
    description: 'A binding pin resolved at admission: capability id + version + manifest digest + the declared constraint.',
  });

/** One grant as published in the surface description. */
export const GrantDescriptionSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    hostFunctions: z.array(HostFunctionIdViewSchema).min(1).readonly(),
    resourceScopes: z.array(ResourceScopeMirrorSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'GrantDescription',
    title: 'GrantDescription',
    description: 'One frozen grant in the sandbox surface description: capability-scoped host functions and resource scopes.',
  });

/** The deterministic sandbox surface description. */
export const SandboxSurfaceDescriptionSchema = z
  .strictObject({
    schemaVersion: SandboxSurfaceDescriptionVersionSchema,
    extensionId: ExtensionIdViewSchema,
    extensionVersion: SemverCoreSchema,
    extensionManifestDigest: Sha256DigestSchema,
    flavor: z.enum(EXTENSION_FLAVORS),
    trustClass: z.enum(EXTENSION_TRUST_CLASSES),
    bindings: z.array(ResolvedCapabilityBindingSchema).min(1).readonly(),
    grants: z.array(GrantDescriptionSchema).readonly(),
  })
  .readonly()
  .superRefine((description, ctx) => {
    checkSortedByKey(ctx, description.bindings, (binding) => binding.capabilityId, 'capabilityId', ['bindings'], 'bindings');
    checkSortedByKey(ctx, description.grants, (grant) => grant.capabilityId, 'capabilityId', ['grants'], 'grants');
    for (const grant of description.grants) {
      checkSortedStrings(ctx, grant.hostFunctions, ['hostFunctions'], 'grant hostFunctions');
    }
  })
  .meta({
    id: 'SandboxSurfaceDescription',
    title: 'SandboxSurfaceDescription',
    description:
      'Deterministic execution-surface description: exactly what the admitted extension may do — its content address, resolved binding pins, and frozen grants (sorted everywhere).',
  });

/** One session-local audit record. */
export const InvocationAuditRecordSchema = z
  .strictObject({
    sequence: z.number().int().min(1),
    envelopeId: MessageIdSchema,
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    hostFunction: HostFunctionIdViewSchema,
    decision: z.enum(['denied', 'permitted']),
    denialCode: z
      .enum([
        'validation',
        'unknown-capability',
        'version-unsatisfied',
        'lifecycle-conflict',
        'digest-mismatch',
        'permission-denied',
        'sandbox-violation',
      ])
      .optional(),
  })
  .readonly()
  .meta({
    id: 'InvocationAuditRecord',
    title: 'InvocationAuditRecord',
    description: 'One session-local audit record (deterministic sequence; explicitly NOT the W010 event log).',
  });

/** Host-execution failure codes. */
export const HostExecutionFailureCodeSchema = z.enum(HOST_EXECUTION_FAILURE_CODES).meta({
  id: 'HostExecutionFailureCode',
  title: 'HostExecutionFailureCode',
  description: 'Neutral host-execution failure code: handler-error or handler-unavailable (invocation outcomes, never boundary errors).',
});

/** The outcome of one PERMITTED host call (completed response, or a typed failure). */
export const HostInvocationOutcomeSchema = z
  .discriminatedUnion('status', [
    z
      .strictObject({
        status: z.literal('completed'),
        response: JsonValueSchema,
      })
      .readonly(),
    z
      .strictObject({
        status: z.literal('failed'),
        code: HostExecutionFailureCodeSchema,
        message: z.string().min(1).max(4000),
      })
      .readonly(),
  ])
  .meta({
    id: 'HostInvocationOutcome',
    title: 'HostInvocationOutcome',
    description:
      'The outcome of one permitted host call: a completed JSON response, or a failed execution with a neutral failure code (invocation outcomes, never boundary errors).',
  });

/** The admitted extension record. */
export const AdmittedExtensionRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    manifest: ExtensionManifestViewSchema,
    lifecycle: z.enum(['registered', 'deprecated', 'retired']),
    manifestDigest: Sha256DigestSchema,
    bindings: z.array(ResolvedCapabilityBindingSchema).min(1).readonly(),
  })
  .readonly()
  .superRefine((record, ctx) => {
    checkSortedByKey(ctx, record.bindings, (binding) => binding.capabilityId, 'capabilityId', ['bindings'], 'bindings');
  })
  .meta({
    id: 'AdmittedExtensionRecord',
    title: 'AdmittedExtensionRecord',
    description: 'The admitted extension record: the frozen manifest copy, lifecycle state, content digest, and resolved binding pins.',
  });

// ---------------------------------------------------------------------------
// Per-function request/response payload mirrors (parity-pinned).
// ---------------------------------------------------------------------------

/** `clock.read` request mirror. */
export const ClockReadRequestMirrorSchema = z
  .strictObject({ instant: z.literal(true) })
  .readonly()
  .meta({ id: 'ClockReadRequestMirror', title: 'ClockReadRequestMirror', description: 'clock.read request payload (mirror).' });

/** `log.write` request mirror. */
export const LogWriteRequestMirrorSchema = z
  .strictObject({ level: z.enum(HOST_LOG_LEVELS), message: z.string().min(1).max(2000) })
  .readonly()
  .meta({ id: 'LogWriteRequestMirror', title: 'LogWriteRequestMirror', description: 'log.write request payload (mirror).' });

/** `world.read` request mirror. */
export const WorldReadRequestMirrorSchema = z
  .strictObject({ entityRefs: z.array(z.string().min(1).max(256)).min(1).max(64).readonly() })
  .readonly()
  .meta({ id: 'WorldReadRequestMirror', title: 'WorldReadRequestMirror', description: 'world.read request payload (mirror).' });

/** `evidence.append` request mirror. */
export const EvidenceAppendRequestMirrorSchema = z
  .strictObject({
    statement: z.string().min(1).max(4000),
    subjectDigest: Sha256DigestSchema.optional(),
  })
  .readonly()
  .meta({ id: 'EvidenceAppendRequestMirror', title: 'EvidenceAppendRequestMirror', description: 'evidence.append request payload (mirror).' });

/** `capability.invoke` request mirror. */
export const CapabilityInvokeRequestMirrorSchema = z
  .strictObject({
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    inputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({ id: 'CapabilityInvokeRequestMirror', title: 'CapabilityInvokeRequestMirror', description: 'capability.invoke request payload (mirror).' });

/** `storage.read` request mirror. */
export const StorageReadRequestMirrorSchema = z
  .strictObject({ key: z.string().regex(STORAGE_KEY_PATTERN) })
  .readonly()
  .meta({ id: 'StorageReadRequestMirror', title: 'StorageReadRequestMirror', description: 'storage.read request payload (mirror).' });

/** `storage.write` request mirror. */
export const StorageWriteRequestMirrorSchema = z
  .strictObject({ key: z.string().regex(STORAGE_KEY_PATTERN), value: JsonValueSchema })
  .readonly()
  .meta({ id: 'StorageWriteRequestMirror', title: 'StorageWriteRequestMirror', description: 'storage.write request payload (mirror).' });

/** `clock.read` response mirror. */
export const ClockReadResponseMirrorSchema = z
  .strictObject({ instant: TimestampSchema })
  .readonly()
  .meta({ id: 'ClockReadResponseMirror', title: 'ClockReadResponseMirror', description: 'clock.read response payload (mirror).' });

/** `log.write` response mirror. */
export const LogWriteResponseMirrorSchema = z
  .strictObject({ logged: z.literal(true) })
  .readonly()
  .meta({ id: 'LogWriteResponseMirror', title: 'LogWriteResponseMirror', description: 'log.write response payload (mirror).' });

/** `world.read` response mirror. */
export const WorldReadResponseMirrorSchema = z
  .strictObject({ snapshots: z.array(JsonValueSchema).readonly() })
  .readonly()
  .meta({ id: 'WorldReadResponseMirror', title: 'WorldReadResponseMirror', description: 'world.read response payload (mirror).' });

/** `evidence.append` response mirror. */
export const EvidenceAppendResponseMirrorSchema = z
  .strictObject({ evidenceId: MessageIdSchema })
  .readonly()
  .meta({ id: 'EvidenceAppendResponseMirror', title: 'EvidenceAppendResponseMirror', description: 'evidence.append response payload (mirror).' });

/** `capability.invoke` response mirror. */
export const CapabilityInvokeResponseMirrorSchema = z
  .strictObject({ outputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema).readonly() })
  .readonly()
  .meta({ id: 'CapabilityInvokeResponseMirror', title: 'CapabilityInvokeResponseMirror', description: 'capability.invoke response payload (mirror).' });

/** `storage.read` response mirror. */
export const StorageReadResponseMirrorSchema = z
  .strictObject({ value: JsonValueSchema })
  .readonly()
  .meta({ id: 'StorageReadResponseMirror', title: 'StorageReadResponseMirror', description: 'storage.read response payload (mirror).' });

/** `storage.write` response mirror. */
export const StorageWriteResponseMirrorSchema = z
  .strictObject({ written: z.literal(true) })
  .readonly()
  .meta({ id: 'StorageWriteResponseMirror', title: 'StorageWriteResponseMirror', description: 'storage.write response payload (mirror).' });
