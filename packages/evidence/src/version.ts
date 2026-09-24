/**
 * Evidence contract versions and closed vocabularies.
 *
 * Versioning policy (v1): a serialized evidence record is admitted only when
 * its `schemaVersion` equals {@link EVIDENCE_RECORD_VERSION} exactly; the
 * parser reports a distinct `version-mismatch` issue before schema
 * validation so version skew is always distinguishable from malformed
 * payloads. {@link EVIDENCE_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export) as a whole.
 */

/** Version of the published evidence contract surface (schemas/ + types). */
export const EVIDENCE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized evidence record. */
export const EVIDENCE_RECORD_VERSION = 1 as const;

/**
 * Evidence kind vocabulary — deliberately identical to the W002 world-model
 * `EvidenceKind` (contracts/world/src/provenance.ts) so a world-model
 * `EvidenceRef` can mirror an evidence record's kind without loss. Evidence
 * semantics and formats are owned here (W006); the world model only holds
 * opaque references.
 */
export const EVIDENCE_KINDS = [
  'document',
  'measurement',
  'observation',
  'computation',
  'assertion',
  'external',
  'other',
] as const;

/**
 * How a confidence figure was obtained — identical to the W002 world-model
 * `ConfidenceMethod` vocabulary (contracts/world/src/confidence.ts).
 */
export const CONFIDENCE_METHODS = [
  'stated',
  'measured',
  'estimated',
  'derived',
  'imported',
] as const;

/** Directional bias admitted for interval estimates (W002-aligned). */
export const INTERVAL_BIASES = ['none', 'low', 'high'] as const;
