/**
 * Pack-local helpers (deterministic, zero IO): the flattened-issue
 * classifiers (the W006/W007/W036 issue style — `@epoch/solution-delivery`
 * keeps its own copies internal, so the pack mirrors the PATTERN, pinned by
 * the devDep parity tests), the tracker/gateway write-intent
 * pre-classifier, and EXACT decimal-string arithmetic (multiplication and
 * comparison — the W036 kernel exports only exact addition).
 */
import type { RefinementCtx, ZodError, ZodType } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { DeliveryIssue } from '@epoch/solution-delivery';
import {
  FORBIDDEN_GATEWAY_BYPASS_FIELDS,
  FORBIDDEN_PARALLEL_TRACKER_FIELDS,
} from './version';
import type { PackError, PackResult } from './errors';

// --------------------------------------------------------------------------------
// Flattened-issue helpers (the W036 issue style, pack-local).
// --------------------------------------------------------------------------------

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): DeliveryIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): PackError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `software-pack record failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Whether a zod failure includes a strict-object `unrecognized_keys` rejection. */
export function hasUnrecognizedKeys(error: ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The path of the first `unrecognized_keys` issue (empty array if none). */
export function unrecognizedKeysPath(error: ZodError): (string | number)[] {
  const issue = error.issues.find((candidate) => candidate.code === 'unrecognized_keys');
  if (issue === undefined) return [];
  return issue.path.filter(
    (segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number',
  );
}

/** Build the typed `vendor-fields-rejected` error for a zod failure. */
export function vendorFieldsError(error: ZodError): PackError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'record carries unknown structural fields — provider/vendor fields cannot enter software-pack records ' +
      '(strict objects; a domain pack is provider-neutral data, never a provider surface)',
    issues,
    path: unrecognizedKeysPath(error),
  };
}

// --------------------------------------------------------------------------------
// The tracker/gateway write-intent pre-classifier (the DP1.0 forbidden-list
// pattern, specialized): runs BEFORE schema validation on every pack record
// admission surface, so stored-tracker and gateway-bypass attempts surface
// as the TYPED pack codes instead of generic strict-object rejections.
// --------------------------------------------------------------------------------

/**
 * Pre-classify pack-record write-intent violations:
 * - a DP1.0-forbidden parallel-tracker/parallel-ledger field
 *   (`parallel-tracker-rejected`);
 * - a gateway-bypass/execution-intent field (`gateway-bypass-rejected`).
 */
export function classifyPackRecord(value: unknown): PackError | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const field of FORBIDDEN_PARALLEL_TRACKER_FIELDS) {
    if (field in record) {
      return {
        code: 'parallel-tracker-rejected',
        message:
          `record declares "${field}" — the issue-tracker/roadmap/deployment views are synchronized projections ` +
          'recomputed from sealed solution-delivery state on every call; a domain pack exposes NO stored tracker ' +
          'and NO parallel ledger (DP1.0 forbidden list)',
        field,
      };
    }
  }
  for (const field of FORBIDDEN_GATEWAY_BYPASS_FIELDS) {
    if (field in record) {
      return {
        code: 'gateway-bypass-rejected',
        message:
          `record declares "${field}" — deployment actions are typed W003 action proposals routed through the ` +
          'W022 Action Gateway authority seam; a domain pack proposes, it NEVER executes (DP1.0 forbidden list)',
        field,
      };
    }
  }
  return null;
}

// --------------------------------------------------------------------------------
// Shared canonical-ordering refinement (sorted + duplicate-free string keys).
// --------------------------------------------------------------------------------

/** Refine an array of keyed records to sorted + duplicate-free by `key`. */
export function refineSortedUnique<T>(
  values: readonly T[],
  ctx: RefinementCtx,
  path: string,
  key: keyof T & string,
): void {
  for (let i = 1; i < values.length; i += 1) {
    const a = values[i]![key] as unknown as string;
    const b = values[i - 1]![key] as unknown as string;
    if (a < b) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted by ${key} ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (a === b) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free by ${key}`,
        path: [path],
      });
      break;
    }
  }
}

// --------------------------------------------------------------------------------
// Digest helper (the agent-protocol canonical SHA-256 — the exact-revision
// address form shared with the W036 sealed envelopes).
// --------------------------------------------------------------------------------

/** Canonical SHA-256 content digest of a JSON-representable pack value. */
export function digestOf(content: unknown): Sha256Hex {
  return canonicalDigest(content as JsonValue);
}

/** Parse a value through a pack schema (total; vendor fields classify). */
export function parsePackRecord<T>(schema: ZodType<T>, value: unknown): PackResult<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// EXACT decimal-string arithmetic (non-negative canonical decimals only):
// bigint-scaled, trailing-zero-trimming, canonical output — the W036 decimal
// discipline extended with multiplication and comparison for measurement
// derivations and rate/amount folds.
// --------------------------------------------------------------------------------

/** Split a canonical non-negative decimal into (scaled value, fraction digits). */
function splitDecimal(value: string): [bigint, number] {
  const separator = value.indexOf('.');
  if (separator === -1) {
    return [BigInt(value), 0];
  }
  const fraction = value.slice(separator + 1);
  return [BigInt(value.slice(0, separator) + fraction), fraction.length];
}

/** Render a scaled bigint at a fixed fraction length, trimming trailing zeros. */
function renderScaled(scaled: bigint, fraction: number): string {
  if (fraction === 0) {
    return scaled.toString();
  }
  const text = scaled.toString().padStart(fraction + 1, '0');
  const integerPart = text.slice(0, -fraction);
  let fractionPart = text.slice(-fraction);
  fractionPart = fractionPart.replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}

/** EXACT decimal-string multiplication: canonical output, no exponent form. */
export function multiplyNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const product = aScaled * bScaled;
  return renderScaled(product, aFraction + bFraction);
}

/** EXACT decimal-string comparison: negative when `a < b`, zero when equal, positive when `a > b`. */
export function compareNonNegativeDecimals(a: string, b: string): number {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  if (aAligned < bAligned) return -1;
  if (aAligned > bAligned) return 1;
  return 0;
}

/** The canonical SHA-256 digest helper (re-exported for parity docs). */
export type { Sha256Hex };
