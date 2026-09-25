import { loadingBoundary } from '../src/shell/boundaries';
import { EmptySlot } from '../src/shared/components';

/**
 * The shell-level loading boundary (App Router convention): the typed
 * `loading` boundary state, projected through shared primitives.
 */
export default function LoadingBoundary() {
  const boundary = loadingBoundary('route content');
  return (
    <div data-shell-boundary="loading">
      <EmptySlot label={`Loading ${boundary.subject}…`} />
    </div>
  );
}
