import { worldMetadata } from '../../src/shell/world-mount';
import { WorldWorkspaceHost } from '../../src/features/world/host/world-host';

export const metadata = worldMetadata();

/**
 * The `/world` App Router page (W061 — the app-owner surface W057 deferred
 * to this closure): the interactive spatial world as the PRIMARY Epoch
 * problem-solving workspace.
 *
 * The page is a thin server segment per the repo convention (the (navigator)
 * stage pages): the shell owns the route (`route:world` -> `/world`,
 * bootstrap.ts) and the world feature mount; this page composes the REAL
 * world host — the `@epoch/world-runtime` workspace runtime over the REAL
 * renderer fabric with the REAL engine presenters of the fabric registry
 * (W058/W059; the contract-only reference presenter is the declared
 * fallback), mounting inside the shell's content region. The wall-clock
 * host loop, the engine surfaces and every interaction run client-side in
 * the host component.
 */
export default function WorldPage() {
  return <WorldWorkspaceHost />;
}
