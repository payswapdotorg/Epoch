import type { Instant } from './primitives';

/**
 * Validity — the temporal interval during which an assertion holds.
 *
 * `from` is inclusive and `to` is exclusive; either bound may be omitted
 * (open interval). When both are present, `to` must be strictly after
 * `from`. Validity is independent of the append-only event history: an
 * assertion whose validity has expired remains in history and continues to
 * answer point-in-time queries for instants it covered.
 */
export interface Validity {
  readonly from?: Instant | undefined;
  readonly to?: Instant | undefined;
}
