/**
 * The CONSTRUCTION SOLUTION WORKSPACE tokens (W073, ACR-012).
 *
 * The Atelier-adapted visual language of the desktop construction world:
 * a warm neutral paper background, compact professional typography,
 * restrained panels and clear selected-state highlighting — adapted to
 * professional engineering, never Atelier branding or the
 * commercial-space domain. The construction workspace is a LIGHT surface
 * inside the (dark) desktop window: the world viewport is the dominant
 * region (60–75% of the main screen) and every panel floats restrained
 * around it.
 *
 * No CSS framework, no stylesheets — inline style objects composed from
 * these tokens (the repo convention; see ui-tokens.ts).
 */

/** The warm-neutral construction palette (light; the Atelier adaptation). */
export const CS = {
  /** The warm paper background of the whole solution workspace. */
  page: '#f2efe9',
  /** Panel surfaces floating on the paper. */
  surface: '#faf8f4',
  /** Raised inputs/chips on panels. */
  surfaceRaised: '#ffffff',
  /** Sunken wells (code, metrics, scroll areas). */
  surfaceSunken: '#ece7de',
  /** The world viewport ground (slightly deeper than the page). */
  viewportGround: '#e9e4da',
  border: '#ddd6c9',
  borderStrong: '#c4bbaa',
  /** Ink on paper. */
  text: '#26221c',
  textSecondary: '#5b554b',
  textMuted: '#8d8678',
  /** The engineering accent (burnt sienna — selected state, tools). */
  accent: '#b45309',
  accentDim: 'rgba(180, 83, 9, 0.09)',
  accentBorder: 'rgba(180, 83, 9, 0.5)',
  accentInk: '#fffaf2',
  success: '#15803d',
  successDim: 'rgba(21, 128, 61, 0.10)',
  danger: '#b91c1c',
  dangerDim: 'rgba(185, 28, 28, 0.09)',
  warn: '#a16207',
  warnDim: 'rgba(161, 98, 7, 0.10)',
  /** The selected-entity highlight ring in the world. */
  selection: '#b45309',
  /** The BOQ cross-highlight tint. */
  boq: '#0f766e',
  boqDim: 'rgba(15, 118, 110, 0.12)',
} as const;

/**
 * The six construction layer colors (ACR-012 §3): restrained professional
 * hues, one per layer, used consistently by the navigator, the plan /
 * section presentations and the 3D overlay badges.
 */
export const LAYER_COLORS: Readonly<
  Record<string, { readonly fill: string; readonly stroke: string; readonly ink: string }>
> = {
  'lyr-site': { fill: '#d6cfc0', stroke: '#8d8678', ink: '#3f3a31' },
  'lyr-foundation': { fill: '#e3d3ab', stroke: '#a16207', ink: '#5b4408' },
  'lyr-structure': { fill: '#ecd3bb', stroke: '#b45309', ink: '#6b3405' },
  'lyr-envelope': { fill: '#e0d7cd', stroke: '#9a3412', ink: '#5e2009' },
  'lyr-mep': { fill: '#cfe3df', stroke: '#0f766e', ink: '#0b4f49' },
  'lyr-finishes': { fill: '#dedbd4', stroke: '#57534e', ink: '#33302b' },
};

/** The layer color of one layer id (neutral fallback). */
export function layerColorOf(layerId: string): {
  readonly fill: string;
  readonly stroke: string;
  readonly ink: string;
} {
  return LAYER_COLORS[layerId] ?? { fill: '#dedbd4', stroke: '#57534e', ink: '#33302b' };
}

/** The construction status colors (engineering projection states). */
export const STATUS_COLORS: Readonly<Record<string, string>> = {
  complete: CS.success,
  'in-progress': CS.accent,
  pending: CS.textMuted,
  blocked: CS.danger,
};

/** Compact professional type scale (slightly tighter than the app shell). */
export const CS_TYPE = {
  sizeXxs: '10px',
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '13px',
  sizeLg: '15px',
  sizeXl: '18px',
} as const;
