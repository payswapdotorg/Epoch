/**
 * The runtime's MIRROR of the @epoch/extension-sdk host contract
 * vocabulary (host function ids, required resource scopes, trust-class
 * grant ceilings, flavors, trust classes) — structurally identical
 * constants, re-declared because the runtime must NOT runtime-depend on
 * the SDK (W008 Tech Lead pin: agent-protocol + capability-registry are
 * the only @epoch runtime dependencies). Drift is impossible to miss:
 * test/sdk-parity.test.ts asserts member-for-member equality against
 * the SDK exports (devDependency), and src/parity.ts pins the type
 * level.
 */
import type { HostFunctionIdView } from './types';

/** The four extension flavors (mirrors @epoch/extension-sdk). */
export const EXTENSION_FLAVORS = ['declarative', 'ui', 'wasm', 'remote'] as const;

/** Extension trust classes (mirrors @epoch/extension-sdk). */
export const EXTENSION_TRUST_CLASSES = ['t0', 't1', 't2', 't3', 't4'] as const;

/** Resource domains (mirrors @epoch/extension-sdk). */
export const RESOURCE_DOMAINS = ['world', 'evidence', 'storage', 'capability'] as const;

/** Resource access kinds (mirrors @epoch/extension-sdk). */
export const RESOURCE_ACCESSES = ['read', 'append', 'write', 'invoke'] as const;

/** Host-function ids (mirrors @epoch/extension-sdk — the narrow closed set). */
export const HOST_FUNCTION_IDS = [
  'capability.invoke',
  'clock.read',
  'evidence.append',
  'log.write',
  'storage.read',
  'storage.write',
  'world.read',
] as const;

/** Data-handling classifications (mirrors @epoch/extension-sdk). */
export const DATA_HANDLING_CLASSIFICATIONS = ['sandbox-only', 'tenant-scoped', 'external-transfer'] as const;

/** Side-effect kinds (mirrors @epoch/extension-sdk). */
export const SIDE_EFFECT_KINDS = [
  'action-proposal',
  'evidence-append',
  'external-effect',
  'sandbox-state-write',
] as const;

/** Declarative contribution kinds (mirrors @epoch/extension-sdk). */
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

/** UI render-surface kinds (mirrors @epoch/extension-sdk). */
export const UI_SURFACE_KINDS = ['inspector', 'overlay', 'panel'] as const;

/** Remote transport kinds (mirrors @epoch/extension-sdk). */
export const REMOTE_TRANSPORT_KINDS = ['custom', 'grpc', 'http', 'mcp'] as const;

/** Wasm section kinds (mirrors @epoch/extension-sdk). */
export const WASM_SECTION_KINDS = ['adapter', 'core-module', 'custom'] as const;

/** WIT primitive value types (mirrors @epoch/extension-sdk). */
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

/** Host log levels (mirrors @epoch/extension-sdk). */
export const HOST_LOG_LEVELS = ['debug', 'error', 'info', 'warn'] as const;

/** Storage key pattern (mirrors @epoch/extension-sdk). */
export const STORAGE_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;

/** WIT-style interface name pattern (mirrors @epoch/extension-sdk). */
export const WASM_INTERFACE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}(:[a-z][a-z0-9-]{0,62}(\/[a-z][a-z0-9-]{0,62})?)?$/;

/** A mirrored resource scope (the legal pairs only). */
export interface ResourceScopeMirror {
  readonly resource: (typeof RESOURCE_DOMAINS)[number];
  readonly access: (typeof RESOURCE_ACCESSES)[number];
}

/** The legal (domain, access) pairs of the v1 host surface (mirror). */
export const LEGAL_RESOURCE_SCOPES: readonly ResourceScopeMirror[] = [
  { resource: 'world', access: 'read' },
  { resource: 'evidence', access: 'append' },
  { resource: 'storage', access: 'read' },
  { resource: 'storage', access: 'write' },
  { resource: 'capability', access: 'invoke' },
];

const scopeKey = (scope: ResourceScopeMirror): string => `${scope.resource}.${scope.access}`;

/**
 * The host-function required-scope table (mirror of the SDK's
 * HOST_FUNCTION_DECLARATIONS): ambient functions map to null.
 */
export const HOST_FUNCTION_REQUIRED_SCOPES: Readonly<
  Record<HostFunctionIdView, ResourceScopeMirror | null>
> = {
  'capability.invoke': { resource: 'capability', access: 'invoke' },
  'clock.read': null,
  'evidence.append': { resource: 'evidence', access: 'append' },
  'log.write': null,
  'storage.read': { resource: 'storage', access: 'read' },
  'storage.write': { resource: 'storage', access: 'write' },
  'world.read': { resource: 'world', access: 'read' },
};

/** A mirrored trust-class grant ceiling. */
export interface TrustCeilingMirror {
  readonly trustClass: (typeof EXTENSION_TRUST_CLASSES)[number];
  readonly hostFunctions: readonly HostFunctionIdView[];
  readonly resourceScopes: readonly ResourceScopeMirror[];
}

/** The trust-class grant ceiling table (mirror of the SDK's). */
export const TRUST_CLASS_GRANT_CEILINGS: readonly TrustCeilingMirror[] = [
  {
    trustClass: 't0',
    hostFunctions: ['clock.read', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't1',
    hostFunctions: ['clock.read', 'evidence.append', 'log.write', 'storage.read', 'world.read'],
    resourceScopes: [
      { resource: 'evidence', access: 'append' },
      { resource: 'world', access: 'read' },
      { resource: 'storage', access: 'read' },
    ],
  },
  {
    trustClass: 't2',
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

/** Does `grant` exceed the ceiling of `trustClass`? Returns the first offender. */
export function grantExceedsCeiling(
  grant: { hostFunctions: readonly string[]; resourceScopes: readonly ResourceScopeMirror[] },
  trustClass: string,
): { hostFunction?: string; resourceScope?: string } {
  const ceiling = TRUST_CLASS_GRANT_CEILINGS.find((entry) => entry.trustClass === trustClass);
  if (ceiling === undefined) return {};
  for (const fn of grant.hostFunctions) {
    if (!ceiling.hostFunctions.includes(fn as HostFunctionIdView)) return { hostFunction: fn };
  }
  for (const scope of grant.resourceScopes) {
    if (!ceiling.resourceScopes.some((allowed) => scopeKey(allowed) === scopeKey(scope))) {
      return { resourceScope: scopeKey(scope) };
    }
  }
  return {};
}

export { scopeKey };
