/**
 * Provider-neutral zod primitives of the learning-calibration kernel.
 * Every schema here is a JSON-representable data shape; no field
 * encodes a vendor, brand, marketplace, ERP, PM tool, or API surface
 * (architecture lock rule 13).
 *
 * Composition policy (the W036/W037/W038/W039 runtime-composition
 * precedent): digest machinery, timestamps and the JSON value space are
 * REUSED from @epoch/agent-protocol; tenant ids are REUSED from
 * @epoch/tenancy; the W036 distinction grammars (record ids, subjects,
 * measures, uncertainty states, distinction records, pack ids,
 * realization variants, outcome kinds) are REUSED from
 * @epoch/solution-delivery (genuine runtime composition — this kernel
 * folds W036 records, never mirrors them). The principal and
 * event-stream grammars are MIRRORED from @epoch/event-log and pinned
 * by runtime parity tests (the kernel-to-kernel devDependency
 * precedent).
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  QualifiedNameSchema,
  UnitLabelSchema,
  CurrencyCodeSchema,
} from '@epoch/solution-delivery';
import {
  LEARNING_CANDIDATE_ID_PATTERN,
  LEARNING_DATASET_ID_PATTERN,
  LEARNING_EXCLUSION_ID_PATTERN,
  LEARNING_METRIC_ID_PATTERN,
  LEARNING_MODEL_ID_PATTERN,
  LEARNING_PROPOSAL_ID_PATTERN,
  LEARNING_REVISION_ID_PATTERN,
  LEARNING_ROW_ID_PATTERN,
} from './version';

// Re-exported for the package surface: the composed W036/agent-protocol
// grammars the learning-calibration records are built from.
export {
  CurrencyCodeSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
};
export type {
  CurrencyCode,
  NonNegativeDecimal,
  PrincipalId,
  QualifiedName,
  SemverCore,
  Sha256Hex,
  SolutionId,
  Timestamp,
  UnitLabel,
} from '@epoch/solution-delivery';
export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';

/** Outcome-learning candidate record identity: `candidate:<slug>`. */
export const LearningCandidateIdSchema = z
  .string()
  .regex(LEARNING_CANDIDATE_ID_PATTERN, 'must be a candidate id of the form "candidate:<slug>"')
  .meta({
    id: 'LearningCandidateId',
    title: 'LearningCandidateId',
    description:
      'Opaque outcome-learning candidate record identity: "candidate:" followed by a lowercase slug.',
  });

/** One candidate record id. */
export type LearningCandidateId = z.infer<typeof LearningCandidateIdSchema>;

/** Learning-dataset record identity: `dataset:<slug>`. */
export const LearningDatasetIdSchema = z
  .string()
  .regex(LEARNING_DATASET_ID_PATTERN, 'must be a dataset id of the form "dataset:<slug>"')
  .meta({
    id: 'LearningDatasetId',
    title: 'LearningDatasetId',
    description:
      'Opaque learning-dataset record identity: "dataset:" followed by a lowercase slug.',
  });

/** One dataset record id. */
export type LearningDatasetId = z.infer<typeof LearningDatasetIdSchema>;

/** Dataset-row record identity: `row:<slug>`. */
export const LearningRowIdSchema = z
  .string()
  .regex(LEARNING_ROW_ID_PATTERN, 'must be a row id of the form "row:<slug>"')
  .meta({
    id: 'LearningRowId',
    title: 'LearningRowId',
    description: 'Opaque dataset-row record identity: "row:" followed by a lowercase slug.',
  });

/** One row record id. */
export type LearningRowId = z.infer<typeof LearningRowIdSchema>;

/** Exclusion-record identity: `exclusion:<slug>`. */
export const LearningExclusionIdSchema = z
  .string()
  .regex(LEARNING_EXCLUSION_ID_PATTERN, 'must be an exclusion id of the form "exclusion:<slug>"')
  .meta({
    id: 'LearningExclusionId',
    title: 'LearningExclusionId',
    description:
      'Opaque typed exclusion-record identity: "exclusion:" followed by a lowercase slug.',
  });

/** One exclusion record id. */
export type LearningExclusionId = z.infer<typeof LearningExclusionIdSchema>;

/** Calibration-metric-set record identity: `metrics:<slug>`. */
export const LearningMetricIdSchema = z
  .string()
  .regex(LEARNING_METRIC_ID_PATTERN, 'must be a metric-set id of the form "metrics:<slug>"')
  .meta({
    id: 'LearningMetricId',
    title: 'LearningMetricId',
    description:
      'Opaque calibration-metric-set record identity: "metrics:" followed by a lowercase slug.',
  });

/** One metric-set record id. */
export type LearningMetricId = z.infer<typeof LearningMetricIdSchema>;

/** Model registry identity: `model:<slug>`. */
export const LearningModelIdSchema = z
  .string()
  .regex(LEARNING_MODEL_ID_PATTERN, 'must be a model id of the form "model:<slug>"')
  .meta({
    id: 'LearningModelId',
    title: 'LearningModelId',
    description: 'Opaque model identity: "model:" followed by a lowercase slug.',
  });

/** One model id. */
export type LearningModelId = z.infer<typeof LearningModelIdSchema>;

/** Model-revision record identity: `model-revision:<slug>`. */
export const LearningRevisionIdSchema = z
  .string()
  .regex(LEARNING_REVISION_ID_PATTERN, 'must be a revision id of the form "model-revision:<slug>"')
  .meta({
    id: 'LearningRevisionId',
    title: 'LearningRevisionId',
    description:
      'Opaque model-revision record identity: "model-revision:" followed by a lowercase slug.',
  });

/** One revision record id. */
export type LearningRevisionId = z.infer<typeof LearningRevisionIdSchema>;

/** Model-revision-proposal record identity: `proposal:<slug>`. */
export const LearningProposalIdSchema = z
  .string()
  .regex(LEARNING_PROPOSAL_ID_PATTERN, 'must be a proposal id of the form "proposal:<slug>"')
  .meta({
    id: 'LearningProposalId',
    title: 'LearningProposalId',
    description:
      'Opaque model-revision-proposal record identity: "proposal:" followed by a lowercase slug.',
  });

/** One proposal record id. */
export type LearningProposalId = z.infer<typeof LearningProposalIdSchema>;
