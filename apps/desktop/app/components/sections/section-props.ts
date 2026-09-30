import type { DesktopProduct, EmbeddedGatewayBinding, FixtureBundle } from '../../../src/native/web';
import type { UiScenario } from '../ui-scenarios';

/**
 * The shared workspace context every journey section renders against.
 *
 * The sections drive the SAME `DesktopProduct` instance the session bar
 * and the journey runner drive — one product, one bridge, one code path.
 */
export interface WorkspaceContext {
  readonly product: DesktopProduct;
  readonly binding: EmbeddedGatewayBinding;
  readonly bundle: FixtureBundle;
  readonly scenario: UiScenario;
  /** Whether a session is bound (the session bar state). */
  readonly authenticated: boolean;
  /** Re-read the session bar (sections that re-bind sessions call it). */
  readonly refreshSession: () => void;
}

/** The props every journey section receives. */
export interface SectionProps {
  readonly ctx: WorkspaceContext;
}
