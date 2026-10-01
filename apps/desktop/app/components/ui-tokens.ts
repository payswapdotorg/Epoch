/**
 * Epoch Desktop UI tokens (W048).
 *
 * The design system of the desktop product surface: the dark slate
 * background family, off-white text and the amber accent of the app icon
 * (the amber "E" mark on dark slate). No CSS framework, no stylesheets —
 * every component styles through inline `style` objects composed from
 * these tokens (the repo convention; see apps/web/src/shell/frame.tsx).
 */

/** The desktop palette (dark slate + amber; no indigo/blue). */
export const COLORS = {
  /** The deepest backdrop (window chrome gutters). */
  bg: '#15181d',
  /** The dark slate surface of the product. */
  surface: '#1e2228',
  /** Raised cards and inputs on the surface. */
  surfaceRaised: '#252a31',
  /** Sunken wells (code blocks, table headers). */
  surfaceSunken: '#171a1f',
  /** The navigation rail surface. */
  rail: '#191d22',
  border: '#323943',
  borderStrong: '#465061',
  /** Off-white primary text. */
  text: '#ececec',
  textSecondary: '#b9c0c8',
  textMuted: '#8a929c',
  /** The amber accent (the app icon mark). */
  accent: '#f0b240',
  accentDim: 'rgba(240, 178, 64, 0.13)',
  accentBorder: 'rgba(240, 178, 64, 0.55)',
  /** Ink rendered ON amber. */
  accentInk: '#241b05',
  success: '#8ac48a',
  successDim: 'rgba(138, 196, 138, 0.12)',
  danger: '#e2836f',
  dangerDim: 'rgba(226, 131, 111, 0.10)',
  warning: '#e5c26f',
  code: '#d9dfe7',
} as const;

/** Font stacks (system UI + monospace identifiers). */
export const FONTS = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

/** The spacing scale (px). */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii (px). */
export const RADII = { sm: 4, md: 6, lg: 10 } as const;

/** The type scale. */
export const TYPE = {
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '13.5px',
  sizeLg: '16px',
  sizeXl: '20px',
} as const;
