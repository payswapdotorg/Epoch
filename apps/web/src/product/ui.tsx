'use client';
/**
 * @epoch/web — the product UI kit (W047).
 *
 * Presentational primitives of the product surfaces, styled exclusively
 * through the W014 shared tokens (no styling framework in the catalog).
 * Every interactive element is keyboard-operable with visible focus
 * (globals.css), >= 44px touch targets, and semantically labeled.
 */
import type { CSSProperties, ReactNode } from 'react';
import { SHELL_COLORS, SHELL_RADII, SHELL_SPACING, SHELL_TYPOGRAPHY } from '../shared/tokens';
import type { UiGatewayError } from './types';

/** Button variants. */
export type ButtonTone = 'primary' | 'secondary' | 'danger';

const BUTTON_TONES: Readonly<Record<ButtonTone, CSSProperties>> = {
  primary: {
    background: SHELL_COLORS.accent,
    color: SHELL_COLORS.accentForeground,
    border: `1px solid ${SHELL_COLORS.accent}`,
  },
  secondary: {
    background: SHELL_COLORS.surface,
    color: SHELL_COLORS.textPrimary,
    border: `1px solid ${SHELL_COLORS.border}`,
  },
  danger: {
    background: SHELL_COLORS.surface,
    color: SHELL_COLORS.dangerText,
    border: `1px solid ${SHELL_COLORS.danger}`,
  },
};

/** A product button (>= 44px target, keyboard operable, visible focus). */
export function Button({
  children,
  onClick,
  tone = 'primary',
  disabled,
  type = 'button',
  ariaLabel,
  testId,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly tone?: ButtonTone;
  readonly disabled?: boolean;
  readonly type?: 'button' | 'submit';
  readonly ariaLabel?: string;
  readonly testId?: string;
}): ReactNode {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      style={{
        ...BUTTON_TONES[tone],
        minHeight: '44px',
        minWidth: '44px',
        padding: `${SHELL_SPACING.sm}px ${SHELL_SPACING.lg}px`,
        borderRadius: `${SHELL_RADII.sm}px`,
        fontFamily: SHELL_TYPOGRAPHY.fontFamily,
        fontSize: SHELL_TYPOGRAPHY.sizeMd,
        fontWeight: SHELL_TYPOGRAPHY.weightMedium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** A labeled input field. */
export function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly hint?: string;
  readonly htmlFor?: string;
}): ReactNode {
  return (
    <div style={{ display: 'grid', gap: `${SHELL_SPACING.xs}px` }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: SHELL_TYPOGRAPHY.sizeSm,
          color: SHELL_COLORS.textSecondary,
          fontWeight: SHELL_TYPOGRAPHY.weightMedium,
        }}
      >
        {label}
      </label>
      {children}
      {hint === undefined ? null : (
        <span style={{ fontSize: SHELL_TYPOGRAPHY.sizeXs, color: SHELL_COLORS.textMuted }}>{hint}</span>
      )}
    </div>
  );
}

const INPUT_STYLE: CSSProperties = {
  minHeight: '40px',
  padding: `${SHELL_SPACING.sm}px ${SHELL_SPACING.md}px`,
  borderRadius: `${SHELL_RADII.sm}px`,
  border: `1px solid ${SHELL_COLORS.border}`,
  background: SHELL_COLORS.surface,
  color: SHELL_COLORS.textPrimary,
  fontFamily: SHELL_TYPOGRAPHY.fontFamily,
  fontSize: SHELL_TYPOGRAPHY.sizeMd,
  width: '100%',
  boxSizing: 'border-box',
};

/** A text input. */
export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  testId,
  type = 'text',
}: {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly testId?: string;
  readonly type?: 'text' | 'password';
}): ReactNode {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
      style={INPUT_STYLE}
    />
  );
}

/** A select input. */
export function SelectInput({
  id,
  value,
  onChange,
  options,
  testId,
}: {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly testId?: string;
}): ReactNode {
  return (
    <select
      id={id}
      value={value}
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
      style={INPUT_STYLE}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Status pill tones. */
export type PillTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

const PILL_TONES: Readonly<Record<PillTone, CSSProperties>> = {
  neutral: { background: '#edecea', color: '#57534e' },
  positive: { background: '#e7f0e4', color: '#31572c' },
  warning: { background: '#f7ecd9', color: '#7a5b13' },
  negative: { background: '#f8e3e3', color: '#7f1d1d' },
  accent: { background: '#e4e2dd', color: '#1c1917' },
};

/** A status pill. */
export function Pill({ children, tone = 'neutral', testId }: {
  readonly children: ReactNode;
  readonly tone?: PillTone;
  readonly testId?: string;
}): ReactNode {
  return (
    <span
      data-testid={testId}
      style={{
        ...PILL_TONES[tone],
        display: 'inline-block',
        padding: `2px ${SHELL_SPACING.sm}px`,
        borderRadius: `${SHELL_RADII.sm}px`,
        fontSize: SHELL_TYPOGRAPHY.sizeXs,
        fontWeight: SHELL_TYPOGRAPHY.weightSemibold,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}

/** A two-column key/value summary row set. */
export function KeyValueGrid({
  rows,
  testId,
}: {
  readonly rows: readonly { readonly key: string; readonly value: ReactNode }[];
  readonly testId?: string;
}): ReactNode {
  return (
    <dl
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, auto) 1fr',
        gap: `${SHELL_SPACING.xs}px ${SHELL_SPACING.lg}px`,
        margin: 0,
      }}
    >
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'contents' }}>
          <dt style={{ color: SHELL_COLORS.textSecondary, fontSize: SHELL_TYPOGRAPHY.sizeSm }}>{row.key}</dt>
          <dd style={{ margin: 0, fontSize: SHELL_TYPOGRAPHY.sizeSm, wordBreak: 'break-all' }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A data table (semantic, scrollable on long lists). */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyLabel = 'No rows.',
  testId,
  maxHeight = 420,
}: {
  readonly caption: string;
  readonly columns: readonly { readonly header: string; readonly cell: (row: T) => ReactNode }[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly emptyLabel?: string;
  readonly testId?: string;
  readonly maxHeight?: number;
}): ReactNode {
  return (
    <div
      data-testid={testId}
      tabIndex={rows.length > 8 ? 0 : undefined}
      role="region"
      aria-label={caption}
      style={{ overflowX: 'auto', maxHeight: `${maxHeight}px`, overflowY: 'auto', borderRadius: `${SHELL_RADII.sm}px`, border: `1px solid ${SHELL_COLORS.border}` }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: SHELL_TYPOGRAPHY.fontFamily, fontSize: SHELL_TYPOGRAPHY.sizeSm, background: SHELL_COLORS.surface }}>
        <caption className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                style={{ textAlign: 'left', padding: `${SHELL_SPACING.sm}px ${SHELL_SPACING.md}px`, borderBottom: `1px solid ${SHELL_COLORS.border}`, background: '#f4f2ee', color: SHELL_COLORS.textSecondary, fontWeight: SHELL_TYPOGRAPHY.weightSemibold, whiteSpace: 'nowrap' }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: `${SHELL_SPACING.md}px`, color: SHELL_COLORS.textMuted }}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} style={{ padding: `${SHELL_SPACING.sm}px ${SHELL_SPACING.md}px`, borderBottom: `1px solid ${SHELL_COLORS.border}`, verticalAlign: 'top', wordBreak: 'break-word' }}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The typed gateway error banner (recovery states, J11). */
export function ErrorBanner({
  error,
  onRetry,
  onReauthenticate,
  testId,
}: {
  readonly error: UiGatewayError;
  readonly onRetry?: () => void;
  readonly onReauthenticate?: () => void;
  readonly testId?: string;
}): ReactNode {
  const recovery =
    error.class === 'auth-session-expired'
      ? 'Recovery: re-authenticate.'
      : error.class === 'transient'
        ? 'Recovery: retry with backoff (or the offline queue holds the intent).'
        : error.class === 'authority-rejected'
          ? 'Recovery: the authority rejected the request — surface verbatim.'
          : 'Recovery: fix the highlighted input.';
  return (
    <div
      data-testid={testId ?? 'error-banner'}
      role="alert"
      style={{
        border: `1px solid ${SHELL_COLORS.danger}`,
        background: '#fdf4f4',
        color: SHELL_COLORS.dangerText,
        borderRadius: `${SHELL_RADII.sm}px`,
        padding: `${SHELL_SPACING.md}px ${SHELL_SPACING.lg}px`,
        display: 'grid',
        gap: `${SHELL_SPACING.xs}px`,
      }}
    >
      <strong style={{ fontSize: SHELL_TYPOGRAPHY.sizeMd }}>
        {error.class === 'authority-rejected' ? 'Authority rejected the request' : error.class === 'auth-session-expired' ? 'Session expired' : error.class === 'transient' ? 'Network unavailable' : 'Request failed'}
      </strong>
      <span style={{ fontSize: SHELL_TYPOGRAPHY.sizeSm }}>{error.message}</span>
      <span data-testid="error-recovery" style={{ fontSize: SHELL_TYPOGRAPHY.sizeXs, color: SHELL_COLORS.textSecondary }}>
        {recovery} <code>({error.code})</code>
      </span>
      {(onRetry !== undefined || onReauthenticate !== undefined) && (
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, flexWrap: 'wrap' }}>
          {onReauthenticate !== undefined && (
            <Button tone="primary" onClick={onReauthenticate} testId="reauth-button">
              Re-authenticate
            </Button>
          )}
          {onRetry !== undefined && (
            <Button tone="secondary" onClick={onRetry} testId="retry-button">
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** A digest chip (content address display). */
export function Digest({ value, label }: { readonly value: string; readonly label?: string }): ReactNode {
  return (
    <span data-testid="digest" title={`${label ?? 'content digest'}: ${value}`} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: SHELL_TYPOGRAPHY.sizeXs, color: SHELL_COLORS.textSecondary, background: '#f4f2ee', padding: `1px ${SHELL_SPACING.xs}px`, borderRadius: '3px', wordBreak: 'break-all' }}>
      {value.slice(0, 16)}…{value.slice(-8)}
    </span>
  );
}

/** A loading placeholder. */
export function Loading({ label = 'Loading…' }: { readonly label?: string }): ReactNode {
  return (
    <div data-testid="loading" role="status" aria-live="polite" style={{ color: SHELL_COLORS.textSecondary, fontSize: SHELL_TYPOGRAPHY.sizeSm, padding: `${SHELL_SPACING.md}px 0` }}>
      {label}
    </div>
  );
}

/** A success note. */
export function SuccessNote({ children, testId }: { readonly children: ReactNode; readonly testId?: string }): ReactNode {
  return (
    <div
      data-testid={testId ?? 'success-note'}
      role="status"
      style={{
        border: '1px solid #cfe0c9',
        background: '#eef4ec',
        color: '#31572c',
        borderRadius: `${SHELL_RADII.sm}px`,
        padding: `${SHELL_SPACING.md}px ${SHELL_SPACING.lg}px`,
        fontSize: SHELL_TYPOGRAPHY.sizeSm,
      }}
    >
      {children}
    </div>
  );
}
