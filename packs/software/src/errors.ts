/**
 * The typed software-pack error taxonomy (W027). The pack REUSES the
 * W036 solution-delivery error union wherever the semantics overlap (a pack
 * projection folding W036 state surfaces W036-shaped errors — never a
 * second authority taxonomy), and adds exactly the two pack-specific codes
 * the DP1.0 tracker/gateway discipline requires:
 *
 * - `parallel-tracker-rejected` — a record attempting to store issue/
 *   backlog/roadmap/deployment tracker state or keep a parallel ledger
 *   beside the W036 sealed state (the issue-tracker view is a projection
 *   recomputed on every call);
 * - `gateway-bypass-rejected` — a record attempting a direct deployment
 *   execution path outside the W003 action-proposal / W022 authority seam
 *   (deployment actions are typed proposals; the pack NEVER executes).
 *
 * Every entry point is total — errors are values, never exceptions.
 */
import type { DeliveryError } from '@epoch/solution-delivery';

/** One typed software-pack error. */
export type PackError =
  | DeliveryError
  | {
      readonly code: 'parallel-tracker-rejected';
      readonly message: string;
      readonly field: string;
    }
  | {
      readonly code: 'gateway-bypass-rejected';
      readonly message: string;
      readonly field: string;
    }
  | {
      /** Pack-vocabulary dangling references (the W036 union is closed
       * over W036 concepts; environment ids are pack vocabulary). */
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: 'environment' | 'deploy-proposal-template';
      readonly referenceId: string;
    };

/** The pack-specific error codes (the W036 codes are reused as-is). */
export type PackSpecificErrorCode = 'parallel-tracker-rejected' | 'gateway-bypass-rejected';

/** Result of a software-pack operation: a value or a typed error. */
export type PackResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PackError };
