'use client';

import { useCallback, useState } from 'react';
import { HostCommandError } from '../../src/native/web';
import type { ProductResult } from '../../src/native/web';

/**
 * The UI-side action outcome (W048).
 *
 * Product methods never throw — they answer `ProductResult<T>` — but the
 * host seam (dialogs, file IO) and local input validation DO throw. The
 * UI folds every failure into the SAME typed error card shape:
 * class / code / message / recoveryAction.
 */
export interface UiActionError {
  readonly errorClass: string;
  readonly code: string;
  readonly message: string;
  readonly recoveryAction: string;
}

/** One UI action outcome: a value or a typed error card. */
export type UiOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: UiActionError };

/** Fold a ProductResult failure into the error-card shape. */
export function productErrorOf(
  error: { readonly class: string; readonly code: string; readonly message: string },
  recoveryAction: string,
): UiActionError {
  return {
    errorClass: error.class,
    code: error.code,
    message: error.message,
    recoveryAction,
  };
}

/** Fold a thrown host/input failure into the error-card shape. */
export function thrownToUiError(cause: unknown): UiActionError {
  if (cause instanceof HostCommandError) {
    return {
      errorClass: 'host-command',
      code: cause.code,
      message: cause.message,
      recoveryAction: 'retry-with-backoff',
    };
  }
  return {
    errorClass: 'exception',
    code: cause instanceof Error ? cause.name : 'unexpected-failure',
    message: cause instanceof Error ? cause.message : String(cause),
    recoveryAction: 'surface-failure',
  };
}

/** One driven product action: busy flag + outcome slot + helpers. */
export interface ProductAction<T> {
  readonly busy: boolean;
  readonly outcome: UiOutcome<T> | null;
  /** Drive one ProductResult-returning product call. */
  readonly run: (call: () => Promise<ProductResult<T>>) => Promise<void>;
  /** Surface a local (input) failure through the same typed card. */
  readonly fail: (error: UiActionError) => void;
  readonly reset: () => void;
}

/**
 * The async product-action hook: loading state, typed error cards and
 * result cards for every button the desktop UI drives.
 */
export function useProductAction<T>(): ProductAction<T> {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<UiOutcome<T> | null>(null);

  const run = useCallback(async (call: () => Promise<ProductResult<T>>): Promise<void> => {
    setBusy(true);
    try {
      const result = await call();
      if (result.ok) {
        setOutcome({ ok: true, value: result.value });
      } else {
        setOutcome({ ok: false, error: productErrorOf(result.error, result.recoveryAction) });
      }
    } catch (cause) {
      setOutcome({ ok: false, error: thrownToUiError(cause) });
    } finally {
      setBusy(false);
    }
  }, []);

  const fail = useCallback((error: UiActionError): void => {
    setOutcome({ ok: false, error });
  }, []);

  const reset = useCallback((): void => {
    setOutcome(null);
    setBusy(false);
  }, []);

  return { busy, outcome, run, fail, reset };
}

/** Parse pasted JSON input; failures fold into the surface-input card. */
export function parseJsonInput(label: string, text: string): { ok: true; value: unknown } | { ok: false; error: UiActionError } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (cause) {
    return {
      ok: false,
      error: {
        errorClass: 'validation',
        code: 'request-validation',
        message: `${label} is not valid JSON (${cause instanceof Error ? cause.message : String(cause)})`,
        recoveryAction: 'surface-input',
      },
    };
  }
}
