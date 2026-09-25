/**
 * @epoch/web shared presentational components (W014).
 *
 * Small, feature-agnostic React components consumed by the shell frame and
 * by later feature waves. NO feature knowledge, NO hooks, NO client state:
 * every component here is a pure server-compatible function of its props
 * (Next.js App Router conventions), styled exclusively through the shared
 * design tokens (`src/shared/tokens.ts`) — never a styling framework.
 */
import type { CSSProperties, ReactNode } from 'react';
import { presentationSummary, type PresentationState } from './view-models';
import { SHELL_COLORS, SHELL_RADII, SHELL_SPACING, SHELL_TYPOGRAPHY } from './tokens';

/** Panel props: a titled raised surface. */
export interface PanelProps {
  readonly title?: string | undefined;
  readonly children: ReactNode;
  readonly tone?: 'default' | 'danger' | undefined;
}

/** A raised surface panel — the base container of the shell's regions. */
export function Panel({ title, children, tone = 'default' }: PanelProps): ReactNode {
  const style: CSSProperties = {
    background: SHELL_COLORS.surface,
    border: `1px solid ${tone === 'danger' ? SHELL_COLORS.danger : SHELL_COLORS.border}`,
    borderRadius: `${SHELL_RADII.md}px`,
    padding: `${SHELL_SPACING.lg}px`,
    boxSizing: 'border-box',
  };
  return (
    <section style={style} data-panel={tone === 'danger' ? 'danger' : 'default'}>
      {title === undefined ? null : <PanelTitle>{title}</PanelTitle>}
      {children}
    </section>
  );
}

/** The panel title line. */
export function PanelTitle({ children }: { readonly children: ReactNode }): ReactNode {
  const style: CSSProperties = {
    color: SHELL_COLORS.textSecondary,
    fontFamily: SHELL_TYPOGRAPHY.fontFamily,
    fontSize: SHELL_TYPOGRAPHY.sizeXs,
    fontWeight: SHELL_TYPOGRAPHY.weightSemibold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: 0,
    marginBottom: `${SHELL_SPACING.md}px`,
  };
  return <h2 style={style}>{children}</h2>;
}

/** Badge props: a small neutral label chip. */
export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: 'default' | 'accent' | undefined;
}

/** A small label chip (tenant/session/mount badges). */
export function Badge({ children, tone = 'default' }: BadgeProps): ReactNode {
  const style: CSSProperties = {
    display: 'inline-block',
    background: tone === 'accent' ? SHELL_COLORS.accent : SHELL_COLORS.background,
    color: tone === 'accent' ? SHELL_COLORS.accentForeground : SHELL_COLORS.textSecondary,
    border: `1px solid ${SHELL_COLORS.border}`,
    borderRadius: `${SHELL_RADII.sm}px`,
    fontFamily: SHELL_TYPOGRAPHY.fontFamily,
    fontSize: SHELL_TYPOGRAPHY.sizeXs,
    fontWeight: SHELL_TYPOGRAPHY.weightMedium,
    padding: `${SHELL_SPACING.xs}px ${SHELL_SPACING.sm}px`,
    whiteSpace: 'nowrap',
  };
  return <span style={style} data-badge={tone}>{children}</span>;
}

/** EmptySlot props: a labeled placeholder for an unfilled mounting point. */
export interface EmptySlotProps {
  /** What the slot is (e.g. "Scene surface"). */
  readonly label: string;
  /** Why it is empty / who fills it (e.g. "awaiting renderer wiring"). */
  readonly hint?: string | undefined;
}

/** A dashed placeholder marking an unfilled mount (deterministic, static). */
export function EmptySlot({ label, hint }: EmptySlotProps): ReactNode {
  const style: CSSProperties = {
    background: SHELL_COLORS.background,
    border: `1px dashed ${SHELL_COLORS.border}`,
    borderRadius: `${SHELL_RADII.md}px`,
    color: SHELL_COLORS.textMuted,
    fontFamily: SHELL_TYPOGRAPHY.fontFamily,
    fontSize: SHELL_TYPOGRAPHY.sizeSm,
    padding: `${SHELL_SPACING.xl}px ${SHELL_SPACING.lg}px`,
    textAlign: 'center',
  };
  return (
    <div style={style} data-empty-slot="">
      <div style={{ fontWeight: SHELL_TYPOGRAPHY.weightMedium }}>{label}</div>
      {hint === undefined ? null : <div style={{ marginTop: `${SHELL_SPACING.xs}px` }}>{hint}</div>}
    </div>
  );
}

/** StateView props: render any typed presentation state. */
export interface StateViewProps<T> {
  readonly state: PresentationState<T>;
  /** Renders a ready value (the caller owns the value -> view mapping). */
  readonly renderReady: (value: T) => ReactNode;
}

/** Render a typed presentation state (loading/empty/failed/ready). */
export function StateView<T>({ state, renderReady }: StateViewProps<T>): ReactNode {
  const summary = presentationSummary(state);
  switch (state.status) {
    case 'ready':
      return renderReady(state.value);
    case 'loading':
      return <EmptySlot label={summary} />;
    case 'empty':
      return <EmptySlot label={summary} />;
    case 'failed':
      return (
        <Panel tone="danger">
          <PanelTitle>Unavailable</PanelTitle>
          <p
            style={{
              color: SHELL_COLORS.dangerText,
              fontFamily: SHELL_TYPOGRAPHY.fontFamily,
              fontSize: SHELL_TYPOGRAPHY.sizeMd,
              margin: 0,
            }}
          >
            {summary}
          </p>
        </Panel>
      );
  }
}
