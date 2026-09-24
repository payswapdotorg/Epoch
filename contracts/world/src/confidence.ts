/**
 * Confidence — first-class uncertainty on assertions.
 *
 * Confidence values are bounded to [0, 1]. Three distribution shapes are
 * supported: a point estimate, a bounded interval, and a weighted set of
 * possibilities. The distribution shape is data, not behavior: the world
 * model records and reconciles confidence; it never invents it.
 */

/** How a confidence figure was obtained. */
export type ConfidenceMethod =
  | 'stated'
  | 'measured'
  | 'estimated'
  | 'derived'
  | 'imported';

/** Directional bias admitted for interval estimates. */
export type IntervalBias = 'none' | 'low' | 'high';

/**
 * Bounded probability distribution describing the uncertainty of an
 * assertion. All numbers are within [0, 1]; interval bounds satisfy
 * `lower <= upper`; `weights` (when present) align with `values`.
 */
export type ConfidenceDistribution =
  | {
      readonly kind: 'point';
      readonly value: number;
    }
  | {
      readonly kind: 'interval';
      readonly lower: number;
      readonly upper: number;
      readonly bias?: IntervalBias | undefined;
    }
  | {
      readonly kind: 'set';
      readonly values: readonly number[];
      readonly weights?: readonly number[] | undefined;
    };

/**
 * The confidence attached to an assertion. Always present on assertions —
 * `method: 'stated'` with a point distribution is the explicit "author is
 * sure, no measurement" case.
 */
export interface Confidence {
  readonly distribution: ConfidenceDistribution;
  readonly method?: ConfidenceMethod | undefined;
  readonly rationale?: string | undefined;
}
