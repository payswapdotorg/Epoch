/**
 * @epoch/web shared view-model helpers (W014).
 *
 * Typed presentation states for projecting RESULT-SHAPED data (the
 * `{ ok: true; value } | { ok: false; error }` discipline every Epoch
 * contract package uses) into the small closed vocabulary the shell's
 * presentational components render.
 *
 * - Structural, not nominal: `presentResult` accepts ANY result-like value
 *   (tenancy results, authorization results, shell results) — the shell
 *   never depends on a specific contract package to present outcomes.
 * - Errors are VALUES (the Epoch total-entry-point discipline): nothing in
 *   this module throws; failure becomes a typed `failed` presentation.
 * - Determinism: pure functions, no clocks, no randomness.
 */

/** The closed presentation-status vocabulary. */
export const PRESENTATION_STATUSES = ['loading', 'ready', 'empty', 'failed'] as const;

/** One presentation status. */
export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number];

/** A minimal error shape any presented error must satisfy (structural). */
export interface PresentableError {
  readonly message: string;
  readonly code?: string | undefined;
}

/** A minimal result shape any presented result must satisfy (structural). */
export type ResultLike<T, E extends PresentableError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** The typed presentation state consumed by shared presentational components. */
export type PresentationState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'empty'; readonly subject: string }
  | {
      readonly status: 'failed';
      readonly code: string;
      readonly message: string;
    };

/** The `loading` presentation (pending data). */
export function presentLoading<T>(): PresentationState<T> {
  return { status: 'loading' };
}

/** The `empty` presentation (no data, with what is empty). */
export function presentEmpty<T>(subject: string): PresentationState<T> {
  return { status: 'empty', subject };
}

/**
 * Project any result-like value into a presentation state.
 *
 * `ok: true` maps to `ready` (or `empty` when the caller supplies an
 * emptiness predicate and it holds); `ok: false` maps to `failed` with the
 * error's message and its typed code when available. Never throws.
 */
export function presentResult<T, E extends PresentableError>(
  result: ResultLike<T, E>,
  options?: {
    readonly isEmpty?: (value: T) => boolean;
    readonly emptySubject?: string;
  },
): PresentationState<T> {
  if (!result.ok) {
    return {
      status: 'failed',
      code: result.error.code ?? 'unknown',
      message: result.error.message,
    };
  }
  if (options?.isEmpty?.(result.value) === true) {
    return { status: 'empty', subject: options.emptySubject ?? 'content' };
  }
  return { status: 'ready', value: result.value };
}

/** Narrow a presentation state to its `ready` value, or undefined. */
export function readyValue<T>(state: PresentationState<T>): T | undefined {
  return state.status === 'ready' ? state.value : undefined;
}

/** The human-facing summary line of a presentation state (deterministic). */
export function presentationSummary(state: PresentationState<unknown>): string {
  switch (state.status) {
    case 'loading':
      return 'Loading…';
    case 'ready':
      return 'Ready';
    case 'empty':
      return `No ${state.subject} yet`;
    case 'failed':
      return `${state.message} (code: ${state.code})`;
  }
}
