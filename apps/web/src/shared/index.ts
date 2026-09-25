/**
 * @epoch/web shared primitives (W014) — public API.
 *
 * Provider-neutral, feature-agnostic building blocks consumed by the shell
 * (`src/shell`) and, later, by feature libraries: typed design tokens,
 * typed view-model (presentation-state) helpers, and small presentational
 * components. Nothing here knows about tenants, sessions, routes, features,
 * or any domain — the shared layer is presentation data only.
 */
export {
  SHELL_COLORS,
  SHELL_LAYOUT,
  SHELL_RADII,
  SHELL_SPACING,
  SHELL_TOKENS,
  SHELL_TYPOGRAPHY,
} from './tokens';

export {
  PRESENTATION_STATUSES,
  presentEmpty,
  presentLoading,
  presentResult,
  presentationSummary,
  readyValue,
} from './view-models';
export type {
  PresentationState,
  PresentationStatus,
  PresentableError,
  ResultLike,
} from './view-models';

export { Badge, EmptySlot, Panel, PanelTitle, StateView } from './components';
export type { BadgeProps, EmptySlotProps, PanelProps, StateViewProps } from './components';
