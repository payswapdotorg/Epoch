/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W006 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 * If either side drifts, `tsc --noEmit` fails with "Type 'false' does not
 * satisfy the constraint 'true'" pointing at the drifted pair. The W002
 * cross-package parity (Confidence vs the world-model confidence model) is
 * proven in test/w002-parity.types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  Confidence,
  ConfidenceDistribution,
  ConfidenceMethod,
  EvidenceKind,
  EvidencePayload,
  EvidenceProduction,
  EvidenceRecord,
  ExactRevisionRef,
  IntervalBias,
} from './types';
import type {
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

export type EvidenceSchemaSync = [
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, string>>,
  Expect<Equals<z.infer<typeof EvidenceVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof EvidenceKindSchema>, EvidenceKind>>,
  Expect<Equals<z.infer<typeof ConfidenceMethodSchema>, ConfidenceMethod>>,
  Expect<Equals<z.infer<typeof IntervalBiasSchema>, IntervalBias>>,
  Expect<Equals<z.infer<typeof ConfidenceDistributionSchema>, ConfidenceDistribution>>,
  Expect<Equals<z.infer<typeof ConfidenceSchema>, Confidence>>,
  Expect<Equals<z.infer<typeof ExactRevisionRefSchema>, ExactRevisionRef>>,
  Expect<Equals<z.infer<typeof EvidenceProductionSchema>, EvidenceProduction>>,
  Expect<Equals<z.infer<typeof EvidencePayloadSchema>, EvidencePayload>>,
  Expect<Equals<z.infer<typeof EvidenceRecordSchema>, EvidenceRecord>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type EvidenceLiteralSync = [
  Expect<
    Equals<
      EvidenceKind,
      'document' | 'measurement' | 'observation' | 'computation' | 'assertion' | 'external' | 'other'
    >
  >,
  Expect<Equals<ConfidenceMethod, 'stated' | 'measured' | 'estimated' | 'derived' | 'imported'>>,
  Expect<Equals<IntervalBias, 'none' | 'low' | 'high'>>,
];
