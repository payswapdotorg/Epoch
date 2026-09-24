// COMPILE-TIME W002 PARITY (type-level, verified by `tsc --noEmit`).
//
// The evidence Confidence/ConfidenceDistribution types must be IDENTICAL to
// the W002 world-model confidence types (re-exported by @epoch/world-model
// from @epoch/world-contracts) under the strictest TypeScript type-equality
// check. If W002 ever evolves its confidence model incompatibly, THIS file
// fails typecheck and the drift surfaces immediately.
import type { z } from 'zod';
import type {
  Confidence as WorldConfidence,
  ConfidenceDistribution as WorldConfidenceDistribution,
  ConfidenceMethod as WorldConfidenceMethod,
  EvidenceKind as WorldEvidenceKind,
  IntervalBias as WorldIntervalBias,
} from '@epoch/world-model';
import type { Equals, Expect } from '../src/type-utils';
import type {
  Confidence,
  ConfidenceDistribution,
  ConfidenceMethod,
  EvidenceKind,
  IntervalBias,
} from '../src/index';
import type { ConfidenceSchema, ConfidenceDistributionSchema } from '../src/schema';

export type W002ConfidenceParity = Expect<Equals<Confidence, WorldConfidence>>;
export type W002ConfidenceDistributionParity = Expect<
  Equals<ConfidenceDistribution, WorldConfidenceDistribution>
>;
export type W002ConfidenceMethodParity = Expect<Equals<ConfidenceMethod, WorldConfidenceMethod>>;
export type W002IntervalBiasParity = Expect<Equals<IntervalBias, WorldIntervalBias>>;
export type W002EvidenceKindParity = Expect<Equals<EvidenceKind, WorldEvidenceKind>>;

export type W002SchemaInferenceParity = [
  Expect<Equals<z.infer<typeof ConfidenceSchema>, WorldConfidence>>,
  Expect<Equals<z.infer<typeof ConfidenceDistributionSchema>, WorldConfidenceDistribution>>,
];
