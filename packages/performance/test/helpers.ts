// W034 — shared test helpers (the W036/W038/W039 kernel-test pattern).
/** Unwrap a total result or fail loudly (positive-path helper). */
export function ok<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`performance test: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper; extra fields accessible as strings). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
  label = 'result',
): { readonly code: string; readonly message: string } & Record<string, unknown> {
  if (result.ok) {
    throw new Error(`expected a typed rejection from ${label}, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string } & Record<string, unknown>;
}
