/**
 * @epoch/ops-kit — typed errors + the total-result shape (mirrors the
 * deploy-model convention: errors are VALUES, never exceptions).
 */
import type { OpsErrorCode } from './version';

/** A typed ops-kit failure (codes: OPS_ERROR_CODES). */
export interface OpsError {
  readonly code: OpsErrorCode;
  readonly message: string;
}

/** The total result shape every public ops-kit function returns. */
export type OpsResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: OpsError };

/** Build a typed failure value. */
export function opsFail<T = never>(code: OpsErrorCode, message: string): OpsResult<T> {
  return { ok: false, error: { code, message } };
}

/** Unwrap or throw (test-helper convenience). */
export function opsUnwrap<T>(result: OpsResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(`ops-kit: ${result.error.code}: ${result.error.message}`);
}
