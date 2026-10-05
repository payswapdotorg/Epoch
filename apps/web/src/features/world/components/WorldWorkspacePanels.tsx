/**
 * The world workspace SECONDARY panels (W057 → W072): the typed-intent
 * JOURNAL and the FOUNDATION-ASSET surface — the two long-lived evidence
 * panels of the world workspace, now composed into the construction
 * solution rails (the W061 tool rail / layer panel / inspect panel /
 * presence panel / renderer bar / timeline bar / controls panel evolved
 * into the construction navigator, top bar, viewport HUDs and engineering
 * inspector — see ConstructionNavigator / ConstructionTopBar /
 * ConstructionViewport / ConstructionInspector).
 *
 * Pure presentational components over the workspace view models; the
 * viewport stays the primary workspace.
 */
import type { ReactNode } from 'react';
import type { WorkspaceViewModelInput } from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';
import { CS, CS_TYPE, FONTS } from '../construction-tokens';

/** The panel surface style (the restrained floating card). */
const PANEL_STYLE = {
  background: CS.surfaceRaised,
  border: `1px solid ${CS.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  boxSizing: 'border-box',
} as const;

/** The compact (in-rail) surface style — flat, no card chrome. */
const COMPACT_STYLE = {
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  padding: 0,
  boxSizing: 'border-box',
} as const;

const TITLE_STYLE = {
  margin: 0,
  marginBottom: 6,
  fontSize: CS_TYPE.sizeXxs,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: CS.text,
} as const;

const LIST_STYLE = {
  margin: 0,
  paddingLeft: 16,
  fontSize: CS_TYPE.sizeXxs,
  lineHeight: 1.6,
} as const;

const MONO_CODE_STYLE = { fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.mono } as const;

const BUTTON_STYLE = {
  fontSize: CS_TYPE.sizeXxs,
  padding: '2px 8px',
  borderRadius: 4,
  border: `1px solid ${CS.borderStrong}`,
  background: CS.surfaceRaised,
  color: CS.textSecondary,
  cursor: 'pointer',
  fontFamily: FONTS.sans,
} as const;

/** Shorten a digest for display. */
function shortDigest(digest: string): string {
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

// ---------------------------------------------------------------------------
// The foundation-asset panel (W067: the in-page import affordance — no
// vendor UI; the interchange bridge's trust gate, the typed bind intent,
// and the digest-addressed bound-asset ledger).
// ---------------------------------------------------------------------------

/** The foundation panel props. */
export interface WorldFoundationPanelProps {
  readonly sessionAssets: WorkspaceViewModelInput['sessionAssets'];
  readonly handlers: WorkspaceHandlers;
  /** Render flat inside a rail (no card chrome) — the construction layout. */
  readonly compact?: boolean | undefined;
}

/**
 * The foundation-asset panel: the Epoch-owned import affordance (a plain
 * file input → the interchange bridge validate/normalize/content-address →
 * the typed bind intent) + the digest-addressed bound-asset ledger. No
 * vendor UI: the bridge is composed behind the runtime's neutral seam.
 */
export function WorldFoundationPanel({
  sessionAssets,
  handlers,
  compact = false,
}: WorldFoundationPanelProps): ReactNode {
  return (
    <div data-panel="foundation" style={compact ? COMPACT_STYLE : PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Foundation assets — import &amp; bind</h3>
      <form
        data-foundation-import=""
        style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <input
          data-testid="foundation-import-input"
          type="file"
          accept=".gltf,.glb,model/gltf-binary,model/gltf+json"
          aria-label="Import a glTF/GLB foundation asset"
          style={{ fontSize: CS_TYPE.sizeXxs, maxWidth: 200, color: CS.textSecondary }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined || file === null) return;
            // The trust gate runs IN PAGE (the runtime's interchange
            // bridge): the raw bytes cross no other boundary.
            void file.arrayBuffer().then((buffer) => {
              handlers.onFoundationImport({
                bytes: new Uint8Array(buffer),
                fileName: file.name,
              });
            });
            // Allow re-importing the same file (the change event must
            // re-fire for identical selections).
            event.target.value = '';
          }}
        />
      </form>
      <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.4 }}>
        glTF/GLB → validate → content-address → typed bind intent
      </span>
      {sessionAssets.imported.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>
          No foundation assets imported yet.
        </p>
      ) : (
        <ul style={{ ...LIST_STYLE, marginTop: 6 }}>
          {sessionAssets.imported.map((asset) => (
            <li
              key={asset.assetDigest}
              data-imported-asset={asset.assetDigest}
              data-asset-kind={asset.assetKind}
            >
              <code style={MONO_CODE_STYLE}>{shortDigest(asset.assetDigest)}</code>{' '}
              <small style={{ color: CS.textSecondary }}>
                {asset.label ?? 'imported asset'} · {asset.assetKind} · {asset.byteSize} bytes
                {asset.vertexCount !== null && asset.triangleCount !== null
                  ? ` · ${asset.vertexCount}v · ${asset.triangleCount}t`
                  : ''}
              </small>{' '}
              <button
                type="button"
                data-testid={`foundation-bind-${asset.assetDigest.slice(0, 12)}`}
                style={BUTTON_STYLE}
                onClick={() => handlers.onFoundationBind(asset.assetDigest)}
              >
                Bind
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 style={{ ...TITLE_STYLE, marginTop: 8 }}>Bound-asset ledger</h3>
      {sessionAssets.ledger.length === 0 ? (
        <p style={{ margin: 0, fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>
          No bindings applied yet — the ledger is digest-addressed experience state, never
          semantic authority.
        </p>
      ) : (
        <ul style={LIST_STYLE}>
          {sessionAssets.ledger.map((entry, index) => (
            <li
              key={`${entry.receiptDigest}-${index}`}
              data-bound-asset={entry.assetDigest}
              data-outcome={entry.outcome}
              data-binding-digest={entry.bindingDigest}
              data-receipt-digest={entry.receiptDigest}
              data-binding-id={entry.bindingId}
              data-renderer-id={entry.rendererId}
            >
              <strong style={{ color: CS.text }}>{entry.outcome}</strong>{' '}
              <code style={MONO_CODE_STYLE}>{shortDigest(entry.assetDigest)}</code>{' '}
              <small style={{ color: CS.textSecondary }}>
                {entry.assetKind} on {entry.rendererId}
                {entry.reason !== null ? ` (${entry.reason})` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The intent journal (typed-intent evidence + surfaced effects).
// ---------------------------------------------------------------------------

/** The intent journal: every interaction's typed intent + the effect queue. */
export function WorldIntentJournal({
  viewModel,
  compact = false,
}: {
  readonly viewModel: WorkspaceViewModelInput;
  readonly compact?: boolean | undefined;
}): ReactNode {
  const entries = [...viewModel.journal].reverse().slice(0, 12);
  return (
    <div data-panel="journal" style={compact ? COMPACT_STYLE : PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Intent journal</h3>
      <ul style={{ ...LIST_STYLE, maxHeight: 170, overflowY: 'auto', color: CS.textSecondary }}>
        {entries.map((entry, index) => (
          <li key={`${entry.atMs}-${index}`} data-journal-entry={entry.intentKind} data-journal-outcome={entry.outcome}>
            <code style={MONO_CODE_STYLE}>{entry.controlIntentId}</code>{' '}
            <small>
              {entry.outcome}
              {entry.hitEntityId !== undefined ? ` · ${entry.hitEntityId}` : ''}
              {entry.detail !== undefined ? ` — ${entry.detail}` : ''}
            </small>
          </li>
        ))}
      </ul>
      <h3 style={{ ...TITLE_STYLE, marginTop: 8 }}>Effects awaiting authority</h3>
      <ul style={{ ...LIST_STYLE, maxHeight: 120, overflowY: 'auto', color: CS.textSecondary }}>
        {[...viewModel.effects].reverse().slice(0, 8).map((entry, index) => (
          <li
            key={`${entry.atMs}-${index}`}
            data-effect={entry.effect.effect}
          >
            <code style={MONO_CODE_STYLE}>{entry.effect.effect}</code>{' '}
            <small>
              {entry.effect.effect === 'inspect-requested'
                ? entry.effect.entityId
                : entry.effect.effect === 'measure-requested'
                  ? `${entry.effect.fromEntityId} → ${entry.effect.toEntityId}`
                  : entry.effect.effect === 'compare-requested'
                    ? `${entry.effect.leftEntityId} ↔ ${entry.effect.rightEntityId}`
                    : entry.effect.effect === 'simulate-requested'
                      ? entry.effect.scenarioRef
                      : entry.effect.effect === 'branch-requested'
                        ? `@${entry.effect.atMs}ms`
                        : entry.effect.effect === 'query-requested'
                          ? entry.effect.text
                          : 'requested'}
            </small>
          </li>
        ))}
      </ul>
      <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.4 }}>
        Typed receipts of every interaction; effects await their authorities.
      </span>
    </div>
  );
}
