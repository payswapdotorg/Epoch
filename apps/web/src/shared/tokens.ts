/**
 * @epoch/web shared design tokens (W014).
 *
 * Typed theme constants for the web app shell — provider-neutral,
 * framework-free presentation data. There is NO styling-system dependency
 * here (the frozen dependency catalog has none): tokens are frozen readonly
 * records consumed as inline style values by the shell's presentational
 * components.
 *
 * - Neutrality (lock rule 13): no vendor, engine, or framework vocabulary.
 * - Determinism: every record is deep-frozen; iteration order is the
 *   declared literal order and never depends on runtime insertion.
 * - The token set is deliberately minimal: a single light neutral surface
 *   palette, a spacing scale, a type scale, and corner radii. Theming
 *   (light/dark/device adaptation) is a later wave's concern and will be a
 *   versioned change to this contract.
 */

/** Neutral surface palette (single light theme, v1). */
export const SHELL_COLORS = {
  /** Page background. */
  background: '#f8f7f4',
  /** Raised panel background. */
  surface: '#ffffff',
  /** Hairline borders and separators. */
  border: '#e2e0da',
  /** Primary text. */
  textPrimary: '#1c1917',
  /** Secondary/de-emphasized text. */
  textSecondary: '#57534e',
  /** Muted status text (empty placeholders). */
  textMuted: '#a8a29e',
  /** Accent fill (active emphasis) — warm neutral, not a vendor hue. */
  accent: '#44403c',
  /** Accent contrast text. */
  accentForeground: '#fafaf9',
  /** Failure-state border. */
  danger: '#b91c1c',
  /** Failure-state text. */
  dangerText: '#7f1d1d',
} as const;

/** Spacing scale (px). */
export const SHELL_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Typography scale. */
export const SHELL_TYPOGRAPHY = {
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '14px',
  sizeLg: '17px',
  sizeXl: '22px',
  weightRegular: 400,
  weightMedium: 500,
  weightSemibold: 600,
} as const;

/** Corner radii (px). */
export const SHELL_RADII = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

/** Layout constants of the shell frame. */
export const SHELL_LAYOUT = {
  /** Maximum content width of the frame (px). */
  frameMaxWidth: 1180,
  /** Header height (px). */
  headerHeight: 56,
} as const;

/** All token groups, deep-frozen at module load (deterministic by construction). */
export const SHELL_TOKENS = {
  colors: SHELL_COLORS,
  spacing: SHELL_SPACING,
  typography: SHELL_TYPOGRAPHY,
  radii: SHELL_RADII,
  layout: SHELL_LAYOUT,
} as const;

/** Deep-freeze every token record (called once at module load). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

deepFreeze(SHELL_TOKENS);
