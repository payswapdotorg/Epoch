/**
 * The typed performance error taxonomy (W034; the issue-code style of
 * W036/W037/W038/W039). Every entry point is total — errors are values,
 * never exceptions. The ONE deliberate exception is the regression-gate
 * helper `enforceBudgets`, whose job is to FAIL a test suite: it throws a
 * `PerformanceBudgetExceededError` carrying the typed over-budget
 * verdicts (see budgets.ts).
 *
 * Named codes:
 * - `performance-invalid`    — malformed record content (flattened
 *   dotted-path issues);
 * - `digest-mismatch`        — a claimed content digest that does not
 *   match the recomputed canonical SHA-256 (tamper detection);
 * - `cross-tenant-denied`    — tenant-isolation violation (R12);
 * - `workload-mismatch`      — measured counts that do not belong to the
 *   workload they are being evaluated against;
 * - `subject-mismatch`       — measured counts whose measurement subject
 *   differs from the budget's declared subject;
 * - `envelope-invalid`       — a budget envelope that is structurally
 *   unusable (zero denominator, negative parts, unknown operation class);
 * - `complexity-mismatch`    — measured count ratios outside the declared
 *   complexity class bounds (carried by the analysis record, not thrown);
 * - `version-conflict`       — the same workload identity admitted with
 *   different content (sealed records are immutable; changed content
 *   ships as a NEW identity);
 * - `serialization-invalid`  — a serialized performance record that does
 *   not parse back (round-trip gate).
 */
import type { ZodError } from 'zod';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface PerformanceIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete performance error-code vocabulary. */
export type PerformanceErrorCode =
  | 'performance-invalid'
  | 'digest-mismatch'
  | 'cross-tenant-denied'
  | 'workload-mismatch'
  | 'subject-mismatch'
  | 'envelope-invalid'
  | 'complexity-mismatch'
  | 'version-conflict'
  | 'serialization-invalid';

/** The typed performance error taxonomy (values, never thrown). */
export type PerformanceError =
  | {
      readonly code: 'performance-invalid';
      readonly message: string;
      readonly issues: readonly PerformanceIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'workload-mismatch';
      readonly message: string;
      readonly expectedWorkloadDigest: string;
      readonly encounteredWorkloadDigest: string;
    }
  | {
      readonly code: 'subject-mismatch';
      readonly message: string;
      readonly expectedSubject: string;
      readonly encounteredSubject: string;
    }
  | {
      readonly code: 'envelope-invalid';
      readonly message: string;
      readonly operationClass: string;
      readonly issues: readonly PerformanceIssue[];
    }
  | {
      readonly code: 'complexity-mismatch';
      readonly message: string;
      readonly subject: string;
      readonly declaredClass: string;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'serialization-invalid';
      readonly message: string;
    };

/** Result of a performance operation: a value or a typed error. */
export type PerformanceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PerformanceError };

/** Flatten a zod failure into the house issue shape. */
export function flattenIssues(error: ZodError): readonly PerformanceIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** Build the standard malformed-record error. */
export function validationError(message: string, error: ZodError): PerformanceError {
  return { code: 'performance-invalid', message, issues: flattenIssues(error) };
}
