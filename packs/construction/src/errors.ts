/**
 * The typed construction-pack error taxonomy (W026). The pack REUSES the
 * W036 solution-delivery error union wherever the semantics overlap (a pack
 * projection folding W036 state surfaces W036-shaped errors — never a
 * second authority taxonomy), and adds exactly the two pack-specific codes
 * the DP1.0 BOQ/ledger discipline requires:
 *
 * - `boq-direct-write-rejected` — a record attempting to store or directly
 *   write BOQ state through the pack (the BOQ is a synchronized projection
 *   recomputed from sealed state on every call);
 * - `parallel-ledger-rejected` — a record attempting to keep a second
 *   quantity/cost/delivery ledger beside the W036 sealed state.
 *
 * Every entry point is total — errors are values, never exceptions.
 */
import type { DeliveryError } from '@epoch/solution-delivery';

/** One typed construction-pack error. */
export type PackError =
  | DeliveryError
  | {
      readonly code: 'boq-direct-write-rejected';
      readonly message: string;
      readonly field: string;
    }
  | {
      readonly code: 'parallel-ledger-rejected';
      readonly message: string;
      readonly field: string;
    };

/** The pack-specific error codes (the W036 codes are reused as-is). */
export type PackSpecificErrorCode = 'boq-direct-write-rejected' | 'parallel-ledger-rejected';

/** Result of a construction-pack operation: a value or a typed error. */
export type PackResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PackError };
