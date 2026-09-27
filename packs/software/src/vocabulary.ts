/**
 * The software vocabulary bundle: the single sealed record carrying the
 * pack's vocabulary families — entity bindings, work items, measurement
 * methods, cost classifications, verification methods, constraint
 * descriptors, outcome types and deployment environments —
 * content-addressed with its SHA-256 digest (the W036 sealed-envelope
 * discipline).
 *
 * The bundle is DATA: it stores nothing, authorizes nothing, and writes
 * nothing. Admission surfaces run the pack write-intent pre-classifier
 * first (`parallel-tracker-rejected` / `gateway-bypass-rejected`) and the
 * W036 authority classifier is the profile-admission gate — a vocabulary
 * record carrying authority-claim fields never enters through the profile
 * path.
 */
import { z } from 'zod';
import { Sha256HexSchema } from '@epoch/solution-delivery';
import {
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
  VOCABULARY_BUNDLE_SCHEMA_NAME,
} from './version';
import { classifyPackRecord, digestOf, parsePackRecord, refineSortedUnique } from './util';
import type { PackError, PackResult } from './errors';
import { SOFTWARE_COST_CLASSIFICATIONS, CostClassificationSchema } from './cost';
import { SOFTWARE_ENTITY_BINDINGS, EntityBindingSchema } from './entities';
import { SOFTWARE_CONSTRAINT_DESCRIPTORS, SoftwareConstraintDescriptorSchema } from './constraints';
import { SOFTWARE_OUTCOME_TYPES, SoftwareOutcomeTypeSchema } from './outcomes';
import {
  SOFTWARE_MEASUREMENT_METHODS,
  MeasurementMethodSchema,
} from './measurement';
import {
  SOFTWARE_VERIFICATION_METHODS,
  SoftwareVerificationMethodSchema,
} from './verification';
import { SOFTWARE_WORK_ITEMS, WorkItemDescriptorSchema } from './workitem';
import {
  SOFTWARE_DEPLOYMENT_ENVIRONMENTS,
  DeploymentEnvironmentSchema,
} from './deployment';

// --------------------------------------------------------------------------------
// The bundle record.
// --------------------------------------------------------------------------------

/** The immutable content of the software vocabulary bundle. */
const VOCABULARY_BUNDLE_BASE = z.strictObject({
  schema: z.literal(VOCABULARY_BUNDLE_SCHEMA_NAME),
  schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
  packId: z.literal(SOFTWARE_PACK_ID),
  packVersion: z.literal(SOFTWARE_PACK_VERSION),
  entityBindings: z.array(EntityBindingSchema).max(64),
  workItems: z.array(WorkItemDescriptorSchema).max(64),
  measurementMethods: z.array(MeasurementMethodSchema).max(64),
  costClassifications: z.array(CostClassificationSchema).max(64),
  verificationMethods: z.array(SoftwareVerificationMethodSchema).max(64),
  constraintDescriptors: z.array(SoftwareConstraintDescriptorSchema).max(128),
  outcomeTypes: z.array(SoftwareOutcomeTypeSchema).max(64),
  deploymentEnvironments: z.array(DeploymentEnvironmentSchema).max(64),
});

/** The immutable content of the software vocabulary bundle (validated). */
export const VocabularyBundleContentSchema = VOCABULARY_BUNDLE_BASE.readonly().superRefine(
  (bundle, ctx) => {
    refineSortedUnique(bundle.entityBindings, ctx, 'entityBindings', 'bindingId');
    refineSortedUnique(bundle.workItems, ctx, 'workItems', 'workItemId');
    refineSortedUnique(bundle.measurementMethods, ctx, 'measurementMethods', 'methodId');
    refineSortedUnique(bundle.costClassifications, ctx, 'costClassifications', 'classId');
    refineSortedUnique(bundle.verificationMethods, ctx, 'verificationMethods', 'methodId');
    refineSortedUnique(bundle.constraintDescriptors, ctx, 'constraintDescriptors', 'descriptorId');
    refineSortedUnique(bundle.outcomeTypes, ctx, 'outcomeTypes', 'outcomeTypeId');
    refineSortedUnique(bundle.deploymentEnvironments, ctx, 'deploymentEnvironments', 'environmentId');
  },
)
  .meta({
    id: 'VocabularyBundleContent',
    title: 'VocabularyBundleContent',
    description:
      'The immutable content of the software vocabulary bundle: the pack identity plus the canonically ordered entity-binding, work-item, measurement-method, cost-classification, verification-method, constraint-descriptor, outcome-type and deployment-environment vocabularies.',
  });

/** One vocabulary-bundle content. */
export type VocabularyBundleContent = z.infer<typeof VocabularyBundleContentSchema>;

/** The SEALED software vocabulary bundle: content plus its SHA-256 digest. */
export const SealedVocabularyBundleSchema = z
  .strictObject({ ...VOCABULARY_BUNDLE_BASE.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedVocabularyBundle',
    title: 'SealedVocabularyBundle',
    description:
      'The sealed software vocabulary bundle: canonically ordered immutable vocabulary content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed vocabulary bundle. */
export type SealedVocabularyBundle = z.infer<typeof SealedVocabularyBundleSchema>;

/**
 * Seal a software vocabulary bundle: write-intent pre-classification,
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
 * Verify a sealed software vocabulary bundle: write-intent
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
 * The default software vocabulary bundle: every pack-owned vocabulary
 * family, canonically ordered and sealed. Deterministic — the same
 * vocabulary content yields the same digest on every call.
 */
export function softwareVocabularyBundle(): SealedVocabularyBundle {
  const sealed = sealVocabularyBundle({
    schema: 'epoch.pack-software.vocabulary-bundle',
    schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
    packId: SOFTWARE_PACK_ID,
    packVersion: SOFTWARE_PACK_VERSION,
    entityBindings: [...SOFTWARE_ENTITY_BINDINGS].sort((a, b) =>
      a.bindingId < b.bindingId ? -1 : 1,
    ),
    workItems: [...SOFTWARE_WORK_ITEMS].sort((a, b) => (a.workItemId < b.workItemId ? -1 : 1)),
    measurementMethods: [...SOFTWARE_MEASUREMENT_METHODS].sort((a, b) =>
      a.methodId < b.methodId ? -1 : 1,
    ),
    costClassifications: [...SOFTWARE_COST_CLASSIFICATIONS].sort((a, b) =>
      a.classId < b.classId ? -1 : 1,
    ),
    verificationMethods: [...SOFTWARE_VERIFICATION_METHODS].sort((a, b) =>
      a.methodId < b.methodId ? -1 : 1,
    ),
    constraintDescriptors: [...SOFTWARE_CONSTRAINT_DESCRIPTORS].sort((a, b) =>
      a.descriptorId < b.descriptorId ? -1 : 1,
    ),
    outcomeTypes: [...SOFTWARE_OUTCOME_TYPES].sort((a, b) =>
      a.outcomeTypeId < b.outcomeTypeId ? -1 : 1,
    ),
    deploymentEnvironments: [...SOFTWARE_DEPLOYMENT_ENVIRONMENTS].sort((a, b) =>
      a.environmentId < b.environmentId ? -1 : 1,
    ),
  });
  if (!sealed.ok) {
    throw new Error('software vocabulary bundle failed to seal (pack data invariant broken)');
  }
  return sealed.value;
}
