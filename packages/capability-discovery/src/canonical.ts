/**
 * Deterministic helpers for the discovery plane (the W036 digest
 * discipline): canonical ordering, timestamp math and content addressing.
 *
 * ZERO wall-clock reads and ZERO randomness anywhere in this package:
 * every instant is caller-supplied data; every derived identity is a pure
 * SHA-256 fold over canonically-ordered content, so identical semantic
 * inputs always produce identical records (acceptance 8).
 */
import { canonicalJsonStringify, sha256Hex } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { OperationRef, Timestamp } from './types';

/** Deterministically order strings (plain lexicographic). */
export function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

/** Deterministic union of string arrays (sorted, duplicate-free). */
export function canonicalStringUnion(...arrays: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  for (const array of arrays) {
    for (const value of array) seen.add(value);
  }
  return [...seen].sort();
}

/** Canonical key of an operation reference. */
export function operationKey(operation: OperationRef): string {
  return `${operation.id}@${operation.versionConstraint}`;
}

/** Deterministic order + dedupe of operation references. */
export function canonicalOperations(
  operations: readonly OperationRef[],
): OperationRef[] {
  const seen = new Set<string>();
  const out: OperationRef[] = [];
  for (const operation of [...operations].sort((a, b) =>
    operationKey(a) < operationKey(b) ? -1 : operationKey(a) > operationKey(b) ? 1 : 0,
  )) {
    const key = operationKey(operation);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(operation);
  }
  return out;
}

/** Content digest of a JSON value (canonical form + SHA-256). */
export function contentDigest(value: unknown): Sha256Hex {
  return sha256Hex(canonicalJsonStringify(value as JsonValue));
}

/** Short derived id suffix (first 16 hex chars of a digest). */
export function digestSuffix16(digest: Sha256Hex): string {
  return digest.slice(0, 16);
}

// ---------------------------------------------------------------------------
// Pure timestamp math (no wall-clock — both operands are caller-supplied).
// ---------------------------------------------------------------------------

/** Parse a canonical timestamp into epoch milliseconds (deterministic). */
export function timestampToEpochMs(timestamp: Timestamp): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(timestamp);
  if (match === null) {
    throw new Error(`not a canonical timestamp: ${JSON.stringify(timestamp)}`);
  }
  const [, y, mo, d, h, mi, s, ms] = match;
  return (
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms)) /
    1
  );
}

/** Render epoch milliseconds as a canonical timestamp (deterministic). */
export function epochMsToTimestamp(epochMs: number): Timestamp {
  if (!Number.isFinite(epochMs) || epochMs < 0 || !Number.isInteger(epochMs)) {
    throw new Error(`not a non-negative integer epoch-ms value: ${epochMs}`);
  }
  const date = new Date(epochMs);
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return (
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}` +
    `-${pad(date.getUTCDate(), 2)}T${pad(date.getUTCHours(), 2)}` +
    `:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `.${pad(date.getUTCMilliseconds(), 3)}Z`
  );
}

/** Whole-day floor of an epoch-ms instant (UTC day boundary). */
export function epochDayFloor(epochMs: number): number {
  return epochMs - (epochMs % 86_400_000);
}

// ---------------------------------------------------------------------------
// Deterministic min/max folds over optional numeric budgets (order-free).
// ---------------------------------------------------------------------------

/** Min over defined values; undefined when none defined. */
export function minOfDefined(values: readonly (number | undefined)[]): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.min(...defined);
}

/** Deterministic numeric string sum (decimal, no float drift on cents). */
export function sumDecimalAmounts(amounts: readonly string[]): string {
  // Integer-cents arithmetic over canonical decimal strings.
  const cents = amounts.map((amount) => {
    const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(amount);
    if (match === null) return 0n;
    const fraction = (match[2] ?? '').padEnd(2, '0').slice(0, 2);
    return BigInt(match[1]!) * 100n + BigInt(fraction || '0');
  });
  const totalCents = cents.reduce((acc, value) => acc + value, 0n);
  const whole = totalCents / 100n;
  const rest = totalCents % 100n;
  if (rest === 0n) return whole.toString();
  return `${whole}.${rest.toString().padStart(2, '0').replace(/0+$/, '')}`;
}
