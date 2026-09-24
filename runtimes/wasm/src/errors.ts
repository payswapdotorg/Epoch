/**
 * Typed error taxonomy of the wasm-layout machinery (the shared W008
 * taxonomy subset relevant to layout validation: `validation` and
 * `digest-mismatch`). Total results — errors are values, never thrown
 * exceptions. Issue paths are dotted strings with precise element
 * indices (the W006/W007 issue style).
 */
import type { WasmLayoutErrorCode } from './version';

/** One flattened validation issue (dotted path + message). */
export interface WasmLayoutIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy. */
export type WasmLayoutError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly WasmLayoutIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: string;
      readonly encountered: string;
    };

/** Result of a layout operation: a value or a typed error. */
export type WasmLayoutResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WasmLayoutError };

/** Thrown when a value cannot be represented in canonical JSON. */
export class CanonicalizationError extends Error {
  constructor(reason: string) {
    super(`Cannot canonicalize value: ${reason}`);
    this.name = 'CanonicalizationError';
  }
}

/** Error code string union re-export (type-level convenience). */
export type { WasmLayoutErrorCode };

/** Build the typed `validation` error for a list of issues. */
export function validationError(issues: readonly WasmLayoutIssue[]): WasmLayoutError {
  return {
    code: 'validation',
    message: `Wasm component layout failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build the typed `digest-mismatch` error (tamper detection). */
export function digestMismatch(options: {
  readonly message: string;
  readonly path: readonly (string | number)[];
  readonly expected: string;
  readonly encountered: string;
}): WasmLayoutError {
  return { code: 'digest-mismatch', ...options };
}

/** Result helpers (total-style, no exceptions). */
export function ok<T>(value: T): WasmLayoutResult<T> {
  return { ok: true, value };
}

export function fail<T>(error: WasmLayoutError): WasmLayoutResult<T> {
  return { ok: false, error };
}
