/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/
 * W036/W037/W038/W039).
 *
 * This file pins structural compatibility between the
 * learning-calibration shapes and the sibling kernel vocabularies
 * WITHOUT adding runtime dependencies (the W040 runtime-dependency
 * policy: @epoch/agent-protocol, @epoch/solution-delivery,
 * @epoch/tenancy, and zod only):
 *
 * - `LearningEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (learning lifecycle events are append-only typed
 *   events over the W010 event shapes — the `learning:*` payload
 *   namespace);
 * - `SealedComparisonFactInput` is TYPE-EQUAL to @epoch/actualization's
 *   `SealedComparisonFact` (the W039 comparison-fact grammar this kernel
 *   folds as OPAQUE INPUT — the mirror is member-identical);
 * - the W039 validation-state, forecast-bias-direction and variance
 *   vocabularies (classes, directions, magnitude bands, the class
 *   polarity table, the attribution cause kinds) are TYPE-EQUAL to
 *   @epoch/actualization's / @epoch/variance's grammars (mirrors);
 * - `LearningBandThresholds` is TYPE-EQUAL to @epoch/variance's
 *   `BandThresholds` (the W039 band-threshold grammar, mirrored);
 * - `LearningCauseRef` is TYPE-EQUAL to @epoch/variance's `CauseRef`
 *   (the W039 root-cause grammar, mirrored);
 * - the W036 measure/subject/outcome grammars are composed at RUNTIME
 *   (genuine dependencies — no parity needed, they are the same
 *   objects).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { LearningEventContent } from './events';
import type {
  LearningCauseRef,
  SealedComparisonFactInput,
} from './references';
import type { LearningBandThresholds } from './features';
import type { EventContent } from '@epoch/event-log';
import type {
  ForecastBiasDirection,
  SealedComparisonFact,
  ValidationState,
} from '@epoch/actualization';
import type {
  BandThresholds,
  CauseRef,
  VarianceClass,
  VarianceDirection,
  VarianceMagnitudeBand,
} from '@epoch/variance';
import type {
  LearningForecastBiasDirection,
  LearningValidationState,
  LearningVarianceClass,
  LearningVarianceDirection,
  LearningVarianceMagnitudeBand,
} from './version';

/** Learning events are W010 event shapes, structurally (W010 parity). */
export type LearningEventParity = Expect<Equals<LearningEventContent, EventContent>>;

/** The mirrored comparison-fact input IS the W039 sealed comparison fact, structurally. */
export type ComparisonFactMirrorParity = Expect<
  Equals<SealedComparisonFactInput, SealedComparisonFact>
>;

/** The mirrored W039 validation states are the actualization grammar. */
export type ValidationStateMirrorParity = Expect<
  Equals<LearningValidationState, ValidationState>
>;

/** The mirrored W039 forecast-bias directions are the actualization grammar. */
export type ForecastBiasDirectionMirrorParity = Expect<
  Equals<LearningForecastBiasDirection, ForecastBiasDirection>
>;

/** The mirrored W039 variance classes are the variance grammar. */
export type VarianceClassMirrorParity = Expect<Equals<LearningVarianceClass, VarianceClass>>;

/** The mirrored W039 variance directions are the variance grammar. */
export type VarianceDirectionMirrorParity = Expect<
  Equals<LearningVarianceDirection, VarianceDirection>
>;

/** The mirrored W039 magnitude bands are the variance grammar. */
export type VarianceMagnitudeBandMirrorParity = Expect<
  Equals<LearningVarianceMagnitudeBand, VarianceMagnitudeBand>
>;

/** The mirrored band thresholds are the variance grammar. */
export type BandThresholdsMirrorParity = Expect<
  Equals<LearningBandThresholds, BandThresholds>
>;

/** The mirrored root-cause grammar is the variance grammar. */
export type CauseRefMirrorParity = Expect<Equals<LearningCauseRef, CauseRef>>;
