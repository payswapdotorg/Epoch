/**
 * @epoch/web shell boundary states (W014).
 *
 * Shell-level error/loading boundaries as TYPED STATES (the W014 pin): the
 * boundary vocabulary is closed data, and the App Router boundary files
 * (`app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`) PROJECT these
 * states through the shared presentational components — boundary behavior
 * is testable as data, not just as markup.
 */

/** The `loading` boundary variant (App Router loading.tsx). */
export interface ShellLoadingBoundary {
  readonly state: 'loading';
  readonly subject: string;
}

/** The `empty` boundary variant (a mounted surface with no content yet). */
export interface ShellEmptyBoundary {
  readonly state: 'empty';
  readonly subject: string;
}

/** The `failed` boundary variant (App Router error.tsx). */
export interface ShellFailedBoundary {
  readonly state: 'failed';
  readonly code: string;
  readonly message: string;
}

/** The `degraded` boundary variant (partial data; the Navigator stays useful). */
export interface ShellDegradedBoundary {
  readonly state: 'degraded';
  readonly reason: string;
}

/** The typed boundary state rendered by the shell's boundary surfaces. */
export type ShellBoundaryState =
  | ShellLoadingBoundary
  | ShellEmptyBoundary
  | ShellFailedBoundary
  | ShellDegradedBoundary;

/** The `loading` boundary (App Router loading.tsx). */
export function loadingBoundary(subject: string): ShellLoadingBoundary {
  return { state: 'loading', subject };
}

/** The `empty` boundary (a mounted surface with no content yet). */
export function emptyBoundary(subject: string): ShellEmptyBoundary {
  return { state: 'empty', subject };
}

/**
 * The `failed` boundary (App Router error.tsx): a rendered error becomes a
 * typed state carrying a code and a message — never a bare exception.
 */
export function failedBoundary(code: string, message: string): ShellFailedBoundary {
  return { state: 'failed', code, message };
}

/** The `degraded` boundary (partial data; the Navigator stays useful). */
export function degradedBoundary(reason: string): ShellDegradedBoundary {
  return { state: 'degraded', reason };
}

/** The human summary of a boundary state (deterministic). */
export function boundarySummary(state: ShellBoundaryState): string {
  switch (state.state) {
    case 'loading':
      return `Loading ${state.subject}…`;
    case 'empty':
      return `No ${state.subject} yet`;
    case 'failed':
      return `${state.message} (code: ${state.code})`;
    case 'degraded':
      return `Partial view — ${state.reason}`;
  }
}
