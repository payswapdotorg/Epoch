import type { Instant } from '@epoch/world-contracts';
import { WorldModelError } from './errors';

/**
 * Time utilities. Instants are RFC 3339 UTC strings; comparisons go
 * through epoch milliseconds because lexicographic comparison of ISO
 * strings is unreliable across varying fractional-second precision.
 *
 * Sub-millisecond differences compare as equal (Date precision) — a
 * documented limitation; the monotonic sequence counter is the strict
 * ordering authority inside a world.
 */
export function epochMs(instant: Instant): number {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) {
    throw new WorldModelError('WM_TEMPORAL', `invalid instant '${instant}'`);
  }
  return ms;
}

/** Chronological comparison: negative when a < b. */
export function compareInstants(a: Instant, b: Instant): number {
  return epochMs(a) - epochMs(b);
}
