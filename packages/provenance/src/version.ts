/**
 * Provenance contract versions and closed vocabularies.
 *
 * Versioning policy (v1): a serialized provenance graph is admitted only
 * when its `schemaVersion` equals {@link PROVENANCE_RECORD_VERSION} exactly;
 * the parser reports a distinct `version-mismatch` issue before schema
 * validation. {@link PROVENANCE_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export) as a whole.
 */

/** Version of the published provenance contract surface (schemas/ + types). */
export const PROVENANCE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized provenance graph. */
export const PROVENANCE_RECORD_VERSION = 1 as const;

/**
 * PROV-DM agent kinds, adapted: who can act. PROV defines person,
 * organization, and software agent; Epoch adds `hardware` (robots, sensors,
 * instruments) and `system` (composed services) as first-class acting
 * things. The vocabulary is deliberately small and neutral.
 */
export const PROVENANCE_AGENT_KINDS = [
  'person',
  'organization',
  'software',
  'hardware',
  'system',
] as const;

/**
 * The six core PROV-DM binary relations adapted into typed statements:
 * generation, usage, association, attribution, derivation, delegation.
 * PROV's optional time/role qualifiers become optional fields on the
 * statement types.
 */
export const PROVENANCE_RELATIONS = [
  'was-generated-by',
  'used',
  'was-associated-with',
  'was-attributed-to',
  'was-derived-from',
  'acted-on-behalf-of',
] as const;
