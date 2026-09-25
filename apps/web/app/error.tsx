'use client';

/**
 * The shell-level error boundary (App Router convention): a rendered error
 * becomes a TYPED boundary state (`failed` with a code and message) and is
 * projected through the shared presentational components — boundary
 * behavior is typed data, not a bare exception (the W014 pin).
 */
import { failedBoundary } from '../src/shell/boundaries';
import { StateView } from '../src/shared/components';
import type { PresentationState } from '../src/shared/view-models';

export default function ErrorBoundary({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string | undefined };
  readonly reset: () => void;
}) {
  const boundary = failedBoundary(
    'route-render-failed',
    error.digest === undefined
      ? 'This surface failed to render.'
      : `This surface failed to render (digest: ${error.digest}).`,
  );
  const state: PresentationState<null> = {
    status: 'failed',
    code: boundary.code,
    message: boundary.message,
  };
  return (
    <div data-shell-boundary="failed">
      <StateView state={state} renderReady={() => null} />
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
