// W034 — shared test helpers for the evidence suite (the kernel-test
// pattern: loud unwraps for positive paths, typed casts for negative
// paths — TS cannot narrow the error union's per-code fields).
/** Unwrap a total result or fail loudly. */
export function ok<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`performance evidence: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error (negative-path helper; extra fields accessible as strings). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
  label = 'result',
): { readonly code: string; readonly message: string } & Record<string, unknown> {
  if (result.ok) {
    throw new Error(`expected a typed rejection from ${label}, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string } & Record<string, unknown>;
}
