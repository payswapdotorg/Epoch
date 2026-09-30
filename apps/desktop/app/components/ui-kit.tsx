'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { UiActionError } from './use-product-action';
import { COLORS, FONTS, RADII, SPACE, TYPE } from './ui-tokens';

/**
 * The Epoch Desktop UI kit (W048).
 *
 * Presentational primitives styled EXCLUSIVELY with inline style objects
 * composed from the desktop tokens (the repo convention — no CSS
 * framework, no stylesheets). Semantic elements, aria labels, loading
 * states, typed error cards and empty states come from here so every
 * journey section renders the same grammar.
 */

// ---------------------------------------------------------------------------
// Panels and badges.
// ---------------------------------------------------------------------------

/** One raised panel (the card grammar of the main pane). */
export function Panel({
  title,
  hint,
  children,
  id,
}: {
  readonly title?: string;
  readonly hint?: string;
  readonly children: ReactNode;
  readonly id?: string;
}): ReactNode {
  return (
    <section
      id={id}
      style={{
        background: COLORS.surfaceRaised,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADII.md,
        padding: SPACE.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
      }}
    >
      {title !== undefined ? (
        <header style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.sizeMd,
              fontWeight: 600,
              color: COLORS.text,
              letterSpacing: '0.01em',
            }}
          >
            {title}
          </h3>
          {hint !== undefined ? (
            <p style={{ margin: 0, fontSize: TYPE.sizeSm, color: COLORS.textMuted }}>{hint}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'mono';

const BADGE_TONES: Readonly<Record<BadgeTone, { background: string; color: string; border: string }>> = {
  neutral: { background: COLORS.surfaceSunken, color: COLORS.textSecondary, border: COLORS.border },
  accent: { background: COLORS.accentDim, color: COLORS.accent, border: COLORS.accentBorder },
  success: { background: COLORS.successDim, color: COLORS.success, border: 'rgba(138, 196, 138, 0.45)' },
  danger: { background: COLORS.dangerDim, color: COLORS.danger, border: 'rgba(226, 131, 111, 0.45)' },
  warning: { background: 'rgba(229, 194, 111, 0.12)', color: COLORS.warning, border: 'rgba(229, 194, 111, 0.4)' },
  mono: { background: COLORS.surfaceSunken, color: COLORS.textMuted, border: COLORS.border },
};

/** One badge (status/mode/protocol chips). */
export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  readonly title?: string;
}): ReactNode {
  const palette = BADGE_TONES[tone];
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.xs,
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontSize: TYPE.sizeXs,
        fontWeight: 600,
        fontFamily: tone === 'mono' ? FONTS.mono : FONTS.sans,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons.
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: Readonly<
  Record<ButtonVariant, { background: string; color: string; border: string; hover: string }>
> = {
  primary: {
    background: COLORS.accent,
    color: COLORS.accentInk,
    border: COLORS.accent,
    hover: '#f7c05a',
  },
  secondary: {
    background: COLORS.surfaceRaised,
    color: COLORS.text,
    border: COLORS.borderStrong,
    hover: '#2d333c',
  },
  ghost: {
    background: 'transparent',
    color: COLORS.textSecondary,
    border: 'transparent',
    hover: COLORS.surfaceSunken,
  },
};

/** One action button with hover/focus feedback and a disabled state. */
export function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = 'secondary',
  ariaLabel,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly variant?: ButtonVariant;
  readonly ariaLabel?: string;
}): ReactNode {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const palette = BUTTON_VARIANTS[variant];
  const interactive = !disabled;
  const background = !interactive
    ? COLORS.surfaceSunken
    : hovered
      ? palette.hover
      : palette.background;
  const color = !interactive ? COLORS.textMuted : palette.color;
  const borderColor = !interactive
    ? COLORS.border
    : focused
      ? COLORS.accentBorder
      : palette.border;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        minHeight: '36px',
        padding: `6px ${SPACE.lg}px`,
        borderRadius: RADII.sm,
        border: `1px solid ${borderColor}`,
        background,
        color,
        fontSize: TYPE.sizeSm,
        fontWeight: 600,
        fontFamily: FONTS.sans,
        letterSpacing: '0.01em',
        cursor: interactive ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.sm,
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

/** The small toggle pair (segmented control) used by the domain switch. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
}): ReactNode {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        padding: 2,
        gap: 2,
        borderRadius: RADII.sm,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surfaceSunken,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            style={{
              minHeight: '28px',
              padding: `3px ${SPACE.md}px`,
              borderRadius: 3,
              border: '1px solid transparent',
              background: selected ? COLORS.accentDim : 'transparent',
              color: selected ? COLORS.accent : COLORS.textMuted,
              borderColor: selected ? COLORS.accentBorder : 'transparent',
              fontSize: TYPE.sizeXs,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading, errors, guidance.
// ---------------------------------------------------------------------------

/** The zero-CSS spinner (SVG SMIL rotation — webview-safe). */
export function Spinner({ size = 14 }: { readonly size?: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <circle
        cx="7"
        cy="7"
        r="5"
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="2"
        strokeDasharray="7 22"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 7 7"
          to="360 7 7"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

/** The busy announcement rendered beside driving buttons. */
export function BusyIndicator({ label }: { readonly label: string }): ReactNode {
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.sm,
        fontSize: TYPE.sizeSm,
        color: COLORS.textMuted,
      }}
    >
      <Spinner />
      {label}
    </span>
  );
}

/** The typed error card: class / code / message / recovery action. */
export function ErrorCard({ error }: { readonly error: UiActionError }): ReactNode {
  return (
    <aside
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.xs,
        padding: SPACE.md,
        borderRadius: RADII.md,
        border: `1px solid rgba(226, 131, 111, 0.45)`,
        background: COLORS.dangerDim,
      }}
    >
      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone="danger">{error.errorClass}</Badge>
        <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.sizeXs, color: COLORS.danger }}>
          {error.code}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: TYPE.sizeSm, color: COLORS.text }}>{error.message}</p>
      <p style={{ margin: 0, fontSize: TYPE.sizeXs, color: COLORS.textMuted }}>
        recovery action: <span style={{ fontFamily: FONTS.mono }}>{error.recoveryAction}</span>
      </p>
    </aside>
  );
}

/** The muted guidance card (empty states and preconditions). */
export function GuidanceCard({
  title,
  children,
}: {
  readonly title?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.xs,
        padding: SPACE.md,
        borderRadius: RADII.md,
        border: `1px dashed ${COLORS.border}`,
        background: COLORS.surfaceSunken,
        color: COLORS.textMuted,
        fontSize: TYPE.sizeSm,
      }}
    >
      {title !== undefined ? (
        <span style={{ fontWeight: 600, color: COLORS.textSecondary, letterSpacing: '0.01em' }}>
          {title}
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>{children}</div>
    </aside>
  );
}

/** The result card wrapper (success grammar for view models). */
export function ResultCard({
  title,
  badge,
  children,
}: {
  readonly title: string;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        padding: SPACE.lg,
        borderRadius: RADII.md,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: TYPE.sizeMd, fontWeight: 600, color: COLORS.text }}>
          {title}
        </h4>
        {badge}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Data presentation.
// ---------------------------------------------------------------------------

/** One key/value row (identifiers render in the mono face). */
export function KeyValue({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly mono?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, max-content) 1fr',
        gap: SPACE.md,
        alignItems: 'baseline',
      }}
    >
      <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: TYPE.sizeSm,
          color: COLORS.text,
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** A scrollable pretty-JSON block (long values stay in the scroll area). */
export function JsonBlock({
  value,
  maxHeight = 260,
  label,
}: {
  readonly value: unknown;
  readonly maxHeight?: number;
  readonly label?: string;
}): ReactNode {
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      {label !== undefined ? (
        <figcaption
          style={{
            fontSize: TYPE.sizeXs,
            color: COLORS.textMuted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </figcaption>
      ) : null}
      <pre
        aria-label={label ?? 'JSON record'}
        style={{
          margin: 0,
          padding: SPACE.md,
          maxHeight: `${maxHeight}px`,
          overflow: 'auto',
          borderRadius: RADII.sm,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceSunken,
          color: COLORS.code,
          fontFamily: FONTS.mono,
          fontSize: TYPE.sizeXs,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </figure>
  );
}

/** One generic data table (rows are static view-model snapshots). */
export interface TableColumn<R> {
  readonly header: string;
  readonly cell: (row: R) => ReactNode;
  readonly width?: string;
}

export function DataTable<R>({
  columns,
  rows,
  emptyLabel,
  caption,
}: {
  readonly columns: readonly TableColumn<R>[];
  readonly rows: readonly R[];
  readonly emptyLabel?: string;
  readonly caption?: string;
}): ReactNode {
  if (rows.length === 0 && emptyLabel !== undefined) {
    return <GuidanceCard>{emptyLabel}</GuidanceCard>;
  }
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: TYPE.sizeSm,
        captionSide: 'top',
      }}
    >
      {caption !== undefined ? (
        <caption
          style={{
            captionSide: 'top',
            textAlign: 'left',
            paddingBottom: SPACE.xs,
            fontSize: TYPE.sizeXs,
            color: COLORS.textMuted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {caption}
        </caption>
      ) : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.header}
              scope="col"
              style={{
                textAlign: 'left',
                padding: `6px ${SPACE.sm}px`,
                borderBottom: `1px solid ${COLORS.borderStrong}`,
                color: COLORS.textMuted,
                fontWeight: 600,
                fontSize: TYPE.sizeXs,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                ...(column.width !== undefined ? { width: column.width } : {}),
              }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td
                key={column.header}
                style={{
                  padding: `6px ${SPACE.sm}px`,
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  verticalAlign: 'top',
                  wordBreak: 'break-word',
                }}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Form fields (paste-based journey inputs).
// ---------------------------------------------------------------------------

const FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontSize: TYPE.sizeXs,
  color: COLORS.textMuted,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: SPACE.xs,
  fontWeight: 600,
};

export function FieldLabel({ children }: { readonly children: ReactNode }): ReactNode {
  return <label style={FIELD_LABEL_STYLE}>{children}</label>;
}

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: `7px ${SPACE.sm}px`,
  borderRadius: RADII.sm,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surfaceSunken,
  color: COLORS.text,
  fontFamily: FONTS.mono,
  fontSize: TYPE.sizeSm,
  outline: 'none',
};

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly id?: string;
}): ReactNode {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      style={INPUT_STYLE}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 8,
  id,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly rows?: number;
  readonly id?: string;
}): ReactNode {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      style={{
        ...INPUT_STYLE,
        resize: 'vertical',
        minHeight: '120px',
        lineHeight: 1.55,
        fontFamily: FONTS.mono,
      }}
    />
  );
}

/** A mono one-liner used for identifiers and digests. */
export function Mono({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.sizeSm, wordBreak: 'break-all' }}>
      {children}
    </span>
  );
}
