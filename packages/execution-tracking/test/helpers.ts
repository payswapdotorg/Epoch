// Tiny shared helpers for the kernel tests (loose over the W036 result
// and the execution result shapes alike).
/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper; loose over W036 results too). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}
