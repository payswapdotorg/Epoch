/**
 * The evidence schema surface registry: every data type published at the
 * `@epoch/evidence` ownership boundary, paired with its zod schema.
 *
 * W006 owns no top-level `contracts/` directory, so the versioned contract
 * surface is published INSIDE the package: this ordered surface plus the
 * emitted JSON Schema files under `schemas/` (see src/contract-emission.ts)
 * plus the typed index export. Invariants enforced by
 * test/contract-drift.test.ts: every committed schema file is byte-identical
 * to the deterministic emission of its surface entry.
 */
import type { ZodType } from 'zod';
import {
  ConfidenceDistributionSchema,
  ConfidenceMethodSchema,
  ConfidenceSchema,
  EvidenceKindSchema,
  EvidencePayloadSchema,
  EvidenceProductionSchema,
  EvidenceRecordSchema,
  EvidenceVersionSchema,
  ExactRevisionRefSchema,
  IntervalBiasSchema,
  Sha256DigestSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the evidence contract v1. */
export const EVIDENCE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Confidence', schema: ConfidenceSchema },
  { type: 'ConfidenceDistribution', schema: ConfidenceDistributionSchema },
  { type: 'ConfidenceMethod', schema: ConfidenceMethodSchema },
  { type: 'EvidenceKind', schema: EvidenceKindSchema },
  { type: 'EvidencePayload', schema: EvidencePayloadSchema },
  { type: 'EvidenceProduction', schema: EvidenceProductionSchema },
  { type: 'EvidenceRecord', schema: EvidenceRecordSchema },
  { type: 'EvidenceRecordVersion', schema: EvidenceVersionSchema },
  { type: 'ExactRevisionRef', schema: ExactRevisionRefSchema },
  { type: 'IntervalBias', schema: IntervalBiasSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
];
