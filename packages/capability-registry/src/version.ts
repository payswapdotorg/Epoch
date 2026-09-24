/**
 * Capability Registry contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors @epoch/verification): a serialized
 * capability manifest (or registry record) is admitted only when its
 * `schemaVersion` equals {@link CAPABILITY_MANIFEST_VERSION} exactly; skew
 * surfaces as a `validation` issue at path ["schemaVersion"] before any
 * other schema diagnostics. {@link CAPABILITY_REGISTRY_CONTRACT_VERSION}
 * versions the published contract surface (`schemas/` + the typed index
 * export).
 */

/** Version of the published capability-registry contract surface (schemas/ + types). */
export const CAPABILITY_REGISTRY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized manifest and record. */
export const CAPABILITY_MANIFEST_VERSION = 1 as const;

/**
 * Capability lifecycle states (typed transitions; architecture.md
 * "Capability Fabric" + the W007 work order):
 *
 * - `registered` — admitted to the registry; resolves for new bindings.
 * - `deprecated` — ADVISORY withdrawal: still resolves for new bindings,
 *   consumers are warned. Deprecation never breaks a resolution.
 * - `retired` — terminal: does NOT resolve for new bindings (existing
 *   bindings are a host/fabric concern, not a registry concern).
 */
export const CAPABILITY_LIFECYCLE_STATES = [
  'registered',
  'deprecated',
  'retired',
] as const;

/** One capability lifecycle state. */
export type CapabilityLifecycleState = (typeof CAPABILITY_LIFECYCLE_STATES)[number];

/**
 * The legal lifecycle transition table. Forward-only:
 * `registered -> deprecated`, `registered -> retired` (immediate
 * retirement, e.g. a security yank), `deprecated -> retired`. There is no
 * revival (`* -> registered` is illegal) and `retired` is terminal — a
 * capability that must return does so as a NEW registration at a NEW
 * version, never by resurrecting state.
 */
export const CAPABILITY_LIFECYCLE_TRANSITIONS: Readonly<
  Record<CapabilityLifecycleState, readonly CapabilityLifecycleState[]>
> = {
  registered: ['deprecated', 'retired'],
  deprecated: ['retired'],
  retired: [],
};

/**
 * Capability origin vocabulary (architecture.md, "Capability Fabric"):
 * where a registered capability comes from. Sources include first-party,
 * community, external software, and provisional document-derived mappings
 * — the vocabulary names the origin, never a vendor, product, or provider.
 */
export const CAPABILITY_ORIGINS = [
  'first-party',
  'community',
  'external-software',
  'provisional-document-derived',
] as const;

/** Where a registered capability originates. */
export type CapabilityOrigin = (typeof CAPABILITY_ORIGINS)[number];
