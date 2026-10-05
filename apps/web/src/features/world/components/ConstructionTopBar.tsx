'use client';
/**
 * W072 — the CONSTRUCTION SOLUTION TOP BAR (ACR-012): the compact
 * solution/context bar above the world-dominant workspace row — solution
 * name, the Epoch-owned renderer selector (health + the last switch
 * evidence), the 3D / plan / section view modes, the session context
 * (tenant + scene + world digest), and the active solution variant chip.
 *
 * The renderer selector is Epoch-owned chrome (the W061 doctrine): every
 * switch goes through the driver's `selectRenderer` — the REAL fabric
 * switching invariant with its declared fallback; the reference renderer
 * stays the fallback-only entry of the chain.
 */
import type { ReactNode } from 'react';
import type { SolutionVariantId, SolutionViewMode } from '../construction-solution';
import { variantOf } from '../construction-solution';
import { CS, CS_TYPE, FONTS } from '../construction-tokens';
import type { RendererSurfaceViewModelInput } from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';

/** Shorten a digest for display. */
export function shortDigest(digest: string): string {
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

/** The top bar props. */
export interface ConstructionTopBarProps {
  readonly sceneName: string;
  readonly tenantId: string;
  readonly sceneId: string;
  readonly worldDigest: string;
  readonly renderers: RendererSurfaceViewModelInput;
  readonly handlers: WorkspaceHandlers;
  readonly viewMode: SolutionViewMode;
  readonly onViewModeChange: (mode: SolutionViewMode) => void;
  readonly variantId: SolutionVariantId;
}

/** The compact solution/context bar of the construction solution workspace. */
export function ConstructionTopBar(props: ConstructionTopBarProps): ReactNode {
  const { renderers, handlers } = props;
  const variant = variantOf(props.variantId);
  return (
    <header
      data-testid="cs-solution-bar"
      data-active-renderer={renderers.activeRendererId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'nowrap',
        padding: '4px 10px',
        background: CS.surface,
        borderBottom: `1px solid ${CS.border}`,
        minHeight: 30,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      <span
        style={{
          fontSize: CS_TYPE.sizeMd,
          fontWeight: 700,
          color: CS.text,
          whiteSpace: 'nowrap',
        }}
      >
        {props.sceneName}
      </span>
      {/* The session context: tenant + scene + the canonical world digest. */}
      <span
        data-testid="cs-session-context"
        style={{ fontFamily: FONTS.mono, fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, whiteSpace: 'nowrap' }}
        title={`scene ${props.sceneId} · world ${props.worldDigest}`}
      >
        {props.tenantId} · world {shortDigest(props.worldDigest)}
      </span>

      {/* The view modes (3D orbit / true top-down plan / section cutaway). */}
      <div
        role="group"
        aria-label="View mode"
        data-testid="cs-view-modes"
        style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceSunken }}
      >
        {(['3d', 'plan', 'section'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`cs-mode-${mode}`}
            data-mode-active={props.viewMode === mode ? 'true' : 'false'}
            aria-pressed={props.viewMode === mode}
            onClick={() => props.onViewModeChange(mode)}
            style={{
              padding: '1px 9px',
              borderRadius: 3,
              border: `1px solid ${props.viewMode === mode ? CS.accentBorder : 'transparent'}`,
              background: props.viewMode === mode ? CS.accentDim : 'transparent',
              color: props.viewMode === mode ? CS.accent : CS.textSecondary,
              fontSize: CS_TYPE.sizeXxs,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* The active solution variant chip (the comparison lives in the
          right rail; the chip names the world being presented). */}
      <span
        data-testid="cs-variant-chip"
        data-variant-id={props.variantId}
        style={{
          fontFamily: FONTS.mono,
          fontSize: CS_TYPE.sizeXxs,
          padding: '1px 8px',
          borderRadius: 999,
          border: `1px solid ${CS.accentBorder}`,
          background: CS.accentDim,
          color: CS.accent,
          whiteSpace: 'nowrap',
        }}
      >
        {variant?.label ?? props.variantId}
      </span>

      {/* The EPOCH-OWNED renderer selector (health + switch evidence). */}
      <div
        role="group"
        aria-label="Renderer selector"
        data-testid="cs-renderer-selector"
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 2,
          borderRadius: 4,
          border: `1px solid ${CS.border}`,
          background: CS.surfaceSunken,
        }}
      >
        {renderers.choices.map((choice) => (
          <button
            key={choice.rendererId}
            type="button"
            data-renderer-choice={choice.rendererId}
            data-renderer-active={choice.active ? 'true' : 'false'}
            title={choice.summary}
            onClick={() => handlers.onRendererSelect(choice.rendererId)}
            style={{
              padding: '1px 8px',
              borderRadius: 3,
              border: `1px solid ${choice.active ? CS.accentBorder : 'transparent'}`,
              background: choice.active ? CS.accentDim : 'transparent',
              color: choice.active ? CS.accent : CS.textSecondary,
              fontSize: CS_TYPE.sizeXxs,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {choice.displayName.replace(' (reference)', '')}
          </button>
        ))}
      </div>
      <span
        data-testid="renderer-health"
        data-health-state={renderers.health.state}
        data-session-state={renderers.sessionState}
        style={{ fontSize: CS_TYPE.sizeXxs, color: renderers.health.state === 'healthy' ? CS.success : CS.warn, fontFamily: FONTS.mono, whiteSpace: 'nowrap' }}
      >
        ● {renderers.health.state}
        {renderers.fallbackApplied ? ' · FALLBACK' : ''}
      </span>
      <span
        data-testid="renderer-switch-evidence"
        style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono, whiteSpace: 'nowrap' }}
      >
        {renderers.lastSwitchDigest === null
          ? 'No switch yet — the canonical world digest carries across every switch.'
          : `Last switch receipt ${shortDigest(renderers.lastSwitchDigest)} · restored: ${renderers.restoredViewFields.join(', ') || '—'}`}
      </span>
    </header>
  );
}
