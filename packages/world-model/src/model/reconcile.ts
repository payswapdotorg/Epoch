import type { Assertion, Confidence, Instant } from '@epoch/world-contracts';
import { compareInstants } from '../time';
import type { WorldStore } from './store';

/**
 * The reconciliation engine — how stated truths become resolved state.
 *
 * Liveness of an assertion at instant T:
 *  1. `assertedAt <= T` (not yet effective assertions are invisible);
 *  2. not retracted at or before T (`retractedAt > T` or absent);
 *  3. not superseded by an assertion effective at or before T;
 *  4. validity window covers T (`from <= T < to`, bounds optional).
 *
 * Resolution for a reconciliation key at T: the NEWEST live assertion by
 * (assertedAt, sequence). History is never discarded — every assertion ever
 * applied remains addressable and is carried in snapshots.
 */

export function isLiveAt(store: WorldStore, assertion: Assertion, at: Instant): boolean {
  if (compareInstants(assertion.assertedAt, at) > 0) return false;
  if (assertion.retractedAt !== undefined && compareInstants(assertion.retractedAt, at) <= 0) {
    return false;
  }
  if (assertion.supersededBy !== undefined) {
    const superseder = store.assertions.get(assertion.supersededBy);
    if (superseder !== undefined && compareInstants(superseder.assertedAt, at) <= 0) {
      return false;
    }
  }
  if (assertion.validity !== undefined) {
    const { from, to } = assertion.validity;
    if (from !== undefined && compareInstants(at, from) < 0) return false;
    if (to !== undefined && compareInstants(at, to) >= 0) return false;
  }
  return true;
}

export function resolveKeyAt(store: WorldStore, key: string, at: Instant): Assertion | null {
  const ids = store.byKey.get(key);
  if (ids === undefined) return null;
  const candidates: Assertion[] = [];
  for (const id of ids) {
    const record = store.assertions.get(id);
    if (record !== undefined && compareInstants(record.assertedAt, at) <= 0) {
      candidates.push(record);
    }
  }
  candidates.sort((a, b) => {
    const byTime = compareInstants(b.assertedAt, a.assertedAt);
    if (byTime !== 0) return byTime;
    return b.sequence - a.sequence;
  });
  for (const candidate of candidates) {
    if (isLiveAt(store, candidate, at)) return candidate;
  }
  return null;
}

/**
 * Best-case confidence of an assertion — the decision-materiality bound
 * used by information-gap analysis: when even the best case stays below the
 * required floor, the decision could change.
 */
export function confidenceUpperBound(confidence: Confidence): number {
  const distribution = confidence.distribution;
  switch (distribution.kind) {
    case 'point':
      return distribution.value;
    case 'interval':
      return distribution.upper;
    case 'set': {
      let max = distribution.values[0] ?? 0;
      for (const value of distribution.values) {
        if (value > max) max = value;
      }
      return max;
    }
  }
}
