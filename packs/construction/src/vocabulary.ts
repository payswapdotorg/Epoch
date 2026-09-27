/**
 * The construction vocabulary bundle: the single sealed record carrying
 * the pack's vocabulary families — entity bindings, measurement methods,
 * cost classifications, verification methods, constraint descriptors and
 * outcome types — content-addressed with its SHA-256 digest (the W036
 * sealed-envelope discipline).
 *
 * The bundle is DATA: it stores nothing, authorizes nothing, and writes
 * nothing. Admission surfaces run the pack write-intent pre-classifier
 * first (`boq-direct-write-rejected` / `parallel-ledger-rejected`) and the
 * W036 authority classifier is the profile-admission gate — a vocabulary
 * record carrying authority-claim fields never enters through the profile
 * path.
 */
import { z } from 'zod';
import { Sha256HexSchema } from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
  VOCABULARY_BUNDLE_SCHEMA_NAME,
} from './version';
import { classifyPackRecord, digestOf, parsePackRecord, refineSortedUnique } from './util';
import type { PackError, PackResult } from './errors';
import {
  CONSTRUCTION_COST_CLASSIFICATIONS,
  CostClassificationSchema,
} from './cost';
import {
  CONSTRUCTION_ENTITY_BINDINGS,
  CONSTRUCTION_MEASUREMENT_METHODS,
  EntityBindingSchema,
  MeasurementMethodSchema,
} from './measurement';
import { CONSTRUCTION_CONSTRAINT_DESCRIPTORS, ConstructionConstraintDescriptorSchema } from './constraints';
import { CONSTRUCTION_OUTCOME_TYPES, ConstructionOutcomeTypeSchema } from './outcomes';
import {
  CONSTRUCTION_VERIFICATION_METHODS,
  ConstructionVerificationMethodSchema,
} from './verification';

// --------------------------------------------------------------------------------
// The bundle record.
// --------------------------------------------------------------------------------

/** The immutable content of the construction vocabulary bundle. */
const VOCABULARY_BUNDLE_BASE = z.strictObject({
  schema: z.literal(VOCABULARY_BUNDLE_SCHEMA_NAME),
  schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
  packId: z.literal(CONSTRUCTION_PACK_ID),
  packVersion: z.literal(CONSTRUCTION_PACK_VERSION),
  entityBindings: z.array(EntityBindingSchema).max(64),
  measurementMethods: z.array(MeasurementMethodSchema).max(64),
  costClassifications: z.array(CostClassificationSchema).max(64),
  verificationMethods: z.array(ConstructionVerificationMethodSchema).max(64),
  constraintDescriptors: z.array(ConstructionConstraintDescriptorSchema).max(128),
  outcomeTypes: z.array(ConstructionOutcomeTypeSchema).max(64),
});

/** The immutable content of the construction vocabulary bundle (validated). */
export const VocabularyBundleContentSchema = VOCABULARY_BUNDLE_BASE.readonly().superRefine(
  (bundle, ctx) => {
    refineSortedUnique(bundle.entityBindings, ctx, 'entityBindings', 'bindingId');
    refineSortedUnique(bundle.measurementMethods, ctx, 'measurementMethods', 'methodId');
    refineSortedUnique(bundle.costClassifications, ctx, 'costClassifications', 'classId');
    refineSortedUnique(bundle.verificationMethods, ctx, 'verificationMethods', 'methodId');
    refineSortedUnique(bundle.constraintDescriptors, ctx, 'constraintDescriptors', 'descriptorId');
    refineSortedUnique(bundle.outcomeTypes, ctx, 'outcomeTypes', 'outcomeTypeId');
  },
)
  .meta({
    id: 'VocabularyBundleContent',
    title: 'VocabularyBundleContent',
    description:
      'The immutable content of the construction vocabulary bundle: the pack identity plus the canonically ordered entity-binding, measurement-method, cost-classification, verification-method, constraint-descriptor and outcome-type vocabularies.',
  });

/** One vocabulary-bundle content. */
export type VocabularyBundleContent = z.infer<typeof VocabularyBundleContentSchema>;

/** The SEALED construction vocabulary bundle: content plus its SHA-256 digest. */
export const SealedVocabularyBundleSchema = z
  .strictObject({ ...VOCABULARY_BUNDLE_BASE.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedVocabularyBundle',
    title: 'SealedVocabularyBundle',
    description:
      'The sealed construction vocabulary bundle: canonically ordered immutable vocabulary content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed vocabulary bundle. */
export type SealedVocabularyBundle = z.infer<typeof SealedVocabularyBundleSchema>;

/**
 * Seal a construction vocabulary bundle: write-intent pre-classification,
 * schema validation, then the SHA-256 content digest. Total — errors are
 * values, never exceptions.
 */
export function sealVocabularyBundle(content: unknown): PackResult<SealedVocabularyBundle> {
  const writeIntent = classifyPackRecord(content);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(VocabularyBundleContentSchema, content);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, value: { ...parsed.value, contentDigest: digestOf(parsed.value) } };
}

/**
 * Verify a sealed construction vocabulary bundle: write-intent
 * pre-classification, schema validation, then digest recomputation
 * (`digest-mismatch` on tamper).
 */
export function verifyVocabularyBundle(sealed: unknown): PackResult<SealedVocabularyBundle> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(SealedVocabularyBundleSchema, sealed);
  if (!parsed.ok) {
    return parsed;
  }
  const { contentDigest, ...content } = parsed.value;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed vocabulary bundle digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      } satisfies PackError,
    };
  }
  return { ok: true, value: parsed.value };
}

// --------------------------------------------------------------------------------
// The default bundle (the pack vocabulary, sealed).
// --------------------------------------------------------------------------------

/**
 * The default construction vocabulary bundle: every pack-owned vocabulary
 * family, canonically ordered and sealed. Deterministic — the same
 * vocabulary content yields the same digest on every call.
 */
export function constructionVocabularyBundle(): SealedVocabularyBundle {
  const sealed = sealVocabularyBundle({
    schema: 'epoch.pack-construction.vocabulary-bundle',
    schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
    packId: CONSTRUCTION_PACK_ID,
    packVersion: CONSTRUCTION_PACK_VERSION,
    entityBindings: [...CONSTRUCTION_ENTITY_BINDINGS].sort((a, b) =>
      a.bindingId < b.bindingId ? -1 : 1,
    ),
    measurementMethods: [...CONSTRUCTION_MEASUREMENT_METHODS].sort((a, b) =>
      a.methodId < b.methodId ? -1 : 1,
    ),
    costClassifications: [...CONSTRUCTION_COST_CLASSIFICATIONS].sort((a, b) =>
      a.classId < b.classId ? -1 : 1,
    ),
    verificationMethods: [...CONSTRUCTION_VERIFICATION_METHODS].sort((a, b) =>
      a.methodId < b.methodId ? -1 : 1,
    ),
    constraintDescriptors: [...CONSTRUCTION_CONSTRAINT_DESCRIPTORS].sort((a, b) =>
      a.descriptorId < b.descriptorId ? -1 : 1,
    ),
    outcomeTypes: [...CONSTRUCTION_OUTCOME_TYPES].sort((a, b) =>
      a.outcomeTypeId < b.outcomeTypeId ? -1 : 1,
    ),
  });
  if (!sealed.ok) {
    throw new Error('construction vocabulary bundle failed to seal (pack data invariant broken)');
  }
  return sealed.value;
}
