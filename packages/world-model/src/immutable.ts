/**
 * Deep clone/freeze utilities for immutable value objects.
 *
 * All world-model state handed to callers is deep-cloned on the way in and
 * deep-frozen on the way out: readers can never mutate durable world state
 * (architecture-lock rule 1 — the world model is the sole semantic
 * authority; agents and views are read-only participants).
 */

/** Recursively freeze a plain-JSON value in place. Returns the same value. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    if (!Object.isFrozen(value)) Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** Recursively clone a plain-JSON value (arrays and objects only). */
export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child !== undefined) out[key] = deepClone(child);
    }
    return out as unknown as T;
  }
  return value;
}
