import { Panel } from '../src/shared/components';

/**
 * The shell's not-found boundary: an unknown App Router path is presented
 * as the typed unknown-route surface (registry paths and router paths stay
 * in lockstep; anything else is a projection miss, never an authority
 * question) with a way back to the home route.
 */
export default function NotFoundBoundary() {
  return (
    <div data-shell-boundary="not-found">
      <Panel title="Unknown route">
        <p style={{ marginTop: 0 }}>
          This path is not a declared shell route — the route registry and the App Router wiring
          are in lockstep, so an undeclared path is a projection miss, not a hidden surface.
        </p>
        <p style={{ marginBottom: 0 }}>
          <a href="/">Return to the Epoch Solution Navigator</a>
        </p>
      </Panel>
    </div>
  );
}
