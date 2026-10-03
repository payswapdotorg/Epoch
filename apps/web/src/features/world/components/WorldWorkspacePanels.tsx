/**
 * The workspace SECONDARY panels (W057): the tool rail, layer panel,
 * inspect panel, timeline bar, presence panel, renderer bar, controls
 * panel (branch/simulation + annotation composer), and the intent
 * journal. Pure presentational components over the workspace view
 * models; the lifecycle/project tables become THESE context surfaces —
 * the viewport stays the primary workspace.
 */
import type { ReactNode } from 'react';
import type {
  EffectEntryInput,
  InspectViewModelInput,
  RendererSurfaceViewModelInput,
  SemanticLayerInput,
  TimelineViewModelInput,
  ViewportAgentInput,
  WorkspaceViewModelInput,
} from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';

const PANEL_STYLE = {
  background: '#ffffff',
  border: '1px solid #e2e0da',
  borderRadius: 10,
  padding: '12px 14px',
  boxSizing: 'border-box',
} as const;

const TITLE_STYLE = {
  margin: 0,
  marginBottom: 10,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#57534e',
} as const;

const LIST_STYLE = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 12,
  lineHeight: 1.7,
} as const;

const BUTTON_STYLE = {
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #d6d3d1',
  background: '#ffffff',
  cursor: 'pointer',
} as const;

const ACTIVE_BUTTON_STYLE = {
  ...BUTTON_STYLE,
  background: '#44403c',
  color: '#fafaf9',
  borderColor: '#44403c',
} as const;

/** Shorten a digest for display. */
function shortDigest(digest: string | null): string {
  if (digest === null) {
    return '—';
  }
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// The tool rail (which typed intent a pick normalizes toward).
// ---------------------------------------------------------------------------

/** The tool ids in rail order (the closed vocabulary). */
const TOOL_RAIL: readonly { readonly id: 'select' | 'inspect' | 'isolate' | 'measure' | 'annotate' | 'hide'; readonly label: string; readonly intent: string }[] = [
  { id: 'select', label: 'Select', intent: 'epoch.world.interaction.select' },
  { id: 'inspect', label: 'Inspect', intent: 'epoch.world.interaction.inspect' },
  { id: 'isolate', label: 'Isolate', intent: 'epoch.world.interaction.isolate' },
  { id: 'measure', label: 'Measure', intent: 'epoch.world.interaction.measure' },
  { id: 'annotate', label: 'Annotate', intent: 'epoch.world.interaction.annotate' },
  { id: 'hide', label: 'Hide', intent: 'epoch.world.interaction.hide' },
];

/** The tool rail: the active tool + the intent each pick will issue. */
export function WorldToolRail({
  activeTool,
  handlers,
}: {
  readonly activeTool: string;
  readonly handlers: WorkspaceHandlers;
}): ReactNode {
  return (
    <div data-panel="tools" style={PANEL_STYLE} role="toolbar" aria-label="World tools">
      <h3 style={TITLE_STYLE}>Tools</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TOOL_RAIL.map((tool) => (
          <button
            key={tool.id}
            type="button"
            data-tool={tool.id}
            data-tool-active={activeTool === tool.id ? 'true' : 'false'}
            title={`Issues ${tool.intent}`}
            style={activeTool === tool.id ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE}
            onClick={() => handlers.onToolSelect(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#a8a29e' }}>
        Picks go through the renderer fabric seam and issue typed epoch.world.interaction intents.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The layer panel (isolation/reveal over derived semantic layers).
// ---------------------------------------------------------------------------

/** The layer panel: derived semantic layers with toggle/isolate/reveal. */
export function WorldLayerPanel({
  layers,
  handlers,
}: {
  readonly layers: readonly SemanticLayerInput[];
  readonly handlers: WorkspaceHandlers;
}): ReactNode {
  return (
    <div data-panel="layers" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Layers</h3>
      {layers.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>No layers in this scene.</p>
      ) : (
        <ul style={LIST_STYLE}>
          {layers.map((layer) => (
            <li key={layer.layerId} data-layer={layer.layerId} data-layer-visible={layer.visible ? 'true' : 'false'} data-layer-mixed={layer.mixed ? 'true' : 'false'}>
              <strong>{layer.label}</strong> <small>({layer.entityIds.length})</small>
              {' '}
              <button
                type="button"
                data-testid={`layer-toggle-${layer.layerId}`}
                style={BUTTON_STYLE}
                onClick={() => handlers.onLayerToggle(layer.layerId)}
              >
                {layer.visible ? (layer.mixed ? 'Reveal (mixed)' : 'Hide') : 'Reveal'}
              </button>{' '}
              <button
                type="button"
                data-testid={`layer-isolate-${layer.layerId}`}
                style={BUTTON_STYLE}
                onClick={() => handlers.onLayerIsolate(layer.layerId)}
              >
                Isolate
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '10px 0 0' }}>
        <button type="button" data-testid="layers-reveal-all" style={BUTTON_STYLE} onClick={() => handlers.onLayersRevealAll()}>
          Reveal all
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The inspect panel (canonical entity data of the selection).
// ---------------------------------------------------------------------------

/** The inspect panel: the CANONICAL data of the picked/focused entity. */
export function WorldInspectPanel({
  inspect,
}: {
  readonly inspect: InspectViewModelInput;
}): ReactNode {
  return (
    <div data-panel="inspect" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Inspect</h3>
      {inspect.entityId === null ? (
        <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>
          Pick an entity in the world to inspect its canonical record.
        </p>
      ) : (
        <dl style={{ margin: 0, fontSize: 12, lineHeight: 1.8, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12 }}>
          <dt style={{ color: '#57534e' }}>Entity</dt>
          <dd data-inspect="entityId" style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>{inspect.entityId}</dd>
          <dt style={{ color: '#57534e' }}>Label</dt>
          <dd data-inspect="label" style={{ margin: 0 }}>{inspect.label ?? '—'}</dd>
          <dt style={{ color: '#57534e' }}>Type</dt>
          <dd data-inspect="entityType" style={{ margin: 0 }}>{inspect.entityType ?? '—'}</dd>
          <dt style={{ color: '#57534e' }}>Content</dt>
          <dd data-inspect="contentDigest" style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>{shortDigest(inspect.contentDigest)}</dd>
          <dt style={{ color: '#57534e' }}>Position</dt>
          <dd data-inspect="position" style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
            {inspect.position === null ? '—' : `(${inspect.position.map((v) => v.toFixed(1)).join(', ')})`}
          </dd>
          <dt style={{ color: '#57534e' }}>View state</dt>
          <dd data-inspect="viewState" style={{ margin: 0 }}>
            {inspect.visible ? 'visible' : 'hidden'}
            {inspect.isolated ? ' · isolated' : ''}
          </dd>
          <dt style={{ color: '#57534e' }}>Representation</dt>
          <dd data-inspect="representationRecordId" style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>{inspect.representationRecordId ?? '—'}</dd>
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The timeline bar (replay scrubbing over the canonical timeline).
// ---------------------------------------------------------------------------

/** The timeline bar: markers, position, presentation clock, transport. */
export function WorldTimelineBar({
  timeline,
  handlers,
}: {
  readonly timeline: TimelineViewModelInput;
  readonly handlers: WorkspaceHandlers;
}): ReactNode {
  const span = Math.max(1, timeline.trackEndMs - timeline.trackStartMs);
  const positionPercent = Math.min(
    100,
    Math.max(0, ((timeline.positionAtMs - timeline.trackStartMs) / span) * 100),
  );
  const presentationPercent = Math.min(
    100,
    Math.max(0, ((timeline.presentationAtMs - timeline.trackStartMs) / span) * 100),
  );
  return (
    <div data-panel="timeline" style={PANEL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <h3 style={{ ...TITLE_STYLE, marginBottom: 0 }}>Timeline</h3>
        <span style={{ fontSize: 12, color: '#57534e' }}>{timeline.trackLabel}</span>
        <span data-testid="timeline-position" style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
          {formatMs(timeline.positionAtMs)} / {formatMs(timeline.trackEndMs)}
        </span>
        {timeline.paused ? (
          <span data-testid="timeline-paused" style={{ fontSize: 11, color: '#b45309' }}>paused</span>
        ) : (
          <span data-testid="timeline-playing" style={{ fontSize: 11, color: '#15803d' }}>playing</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {timeline.paused ? (
            <button type="button" data-testid="timeline-resume" style={BUTTON_STYLE} onClick={() => handlers.onTimelineResume()}>
              Resume
            </button>
          ) : (
            <button type="button" data-testid="timeline-pause" style={BUTTON_STYLE} onClick={() => handlers.onTimelinePause()}>
              Pause
            </button>
          )}
        </span>
      </div>
      <div
        data-testid="timeline-track"
        role="slider"
        aria-label="Replay position"
        aria-valuenow={timeline.positionAtMs}
        aria-valuemin={timeline.trackStartMs}
        aria-valuemax={timeline.trackEndMs}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const step = span / 50;
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            handlers.onTimelineScrub(timeline.positionAtMs + direction * step);
          }
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
          handlers.onTimelineScrub(timeline.trackStartMs + fraction * span);
        }}
        style={{ position: 'relative', height: 34, background: '#f5f5f4', border: '1px solid #e2e0da', borderRadius: 8, cursor: 'pointer' }}
      >
        {timeline.markers.map((marker) => {
          const left = ((marker.atMs - timeline.trackStartMs) / span) * 100;
          return (
            <span
              key={marker.markerId}
              data-marker={marker.markerId}
              data-marker-kind={marker.markerKind}
              title={`${marker.label ?? marker.markerId} @ ${formatMs(marker.atMs)}`}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: marker.markerKind === 'branch-point' ? 2 : 20,
                width: 8,
                height: 8,
                borderRadius: 4,
                background: marker.markerKind === 'branch-point' ? '#1d4ed8' : '#a8a29e',
              }}
            />
          );
        })}
        <span
          data-testid="timeline-presentation-head"
          style={{ position: 'absolute', left: `${presentationPercent}%`, top: 0, bottom: 0, width: 2, background: '#d6d3d1' }}
        />
        <span
          data-testid="timeline-cursor"
          style={{ position: 'absolute', left: `${positionPercent}%`, top: 0, bottom: 0, width: 3, background: '#b45309' }}
        />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#a8a29e' }}>
        Scrubbing issues the typed replay intent (epoch.world.interaction.replay); markers: event · branch-point (blue).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The presence panel (visible agents + follow).
// ---------------------------------------------------------------------------

/** The presence panel: the scene's projected agents + follow commands. */
export function WorldPresencePanel({
  agents,
  followedAgentId,
  handlers,
}: {
  readonly agents: readonly ViewportAgentInput[];
  readonly followedAgentId: string | null;
  readonly handlers: WorkspaceHandlers;
}): ReactNode {
  return (
    <div data-panel="presence" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Agents</h3>
      {agents.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>No agents present in this scene.</p>
      ) : (
        <ul style={LIST_STYLE}>
          {agents.map((agent) => (
            <li key={agent.agentId} data-presence-agent={agent.agentId} data-agent-followed={followedAgentId === agent.agentId ? 'true' : 'false'}>
              {agent.agentId}{' '}
              <button
                type="button"
                data-testid={`follow-${agent.agentId}`}
                style={followedAgentId === agent.agentId ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE}
                onClick={() => handlers.onAgentFollow(agent.agentId)}
              >
                {followedAgentId === agent.agentId ? 'Following' : 'Follow'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#a8a29e' }}>
        Following issues the typed follow-agent intent (the camera record switches to the agent).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The renderer bar (Epoch-owned selector + health/fallback surface).
// ---------------------------------------------------------------------------

/** The renderer bar: the selector + health + the last switch evidence. */
export function WorldRendererBar({
  renderers,
  handlers,
}: {
  readonly renderers: RendererSurfaceViewModelInput;
  readonly handlers: WorkspaceHandlers;
}): ReactNode {
  return (
    <div data-panel="renderers" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Renderer</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {renderers.choices.map((choice) => (
          <button
            key={choice.rendererId}
            type="button"
            data-renderer-choice={choice.rendererId}
            data-renderer-active={choice.active ? 'true' : 'false'}
            title={choice.summary}
            style={choice.active ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE}
            onClick={() => handlers.onRendererSelect(choice.rendererId)}
          >
            {choice.displayName}
          </button>
        ))}
      </div>
      <p data-testid="renderer-health" data-health-state={renderers.health.state} data-session-state={renderers.sessionState} style={{ margin: 0, fontSize: 12, color: '#57534e' }}>
        health <strong>{renderers.health.state}</strong> · session {renderers.sessionState}
        {renderers.fallbackApplied ? ' · FALLBACK APPLIED' : ''}
      </p>
      <p data-testid="renderer-switch-evidence" style={{ margin: '4px 0 0', fontSize: 11, color: '#a8a29e' }}>
        {renderers.lastSwitchDigest === null
          ? 'No switch yet — the canonical world digest carries across every switch.'
          : `Last switch receipt ${shortDigest(renderers.lastSwitchDigest)} · restored: ${renderers.restoredViewFields.join(', ') || '—'}`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The controls panel (branch/simulation entry + annotation composer).
// ---------------------------------------------------------------------------

/** The controls panel props (the composer state is host-owned). */
export interface WorldControlsPanelProps {
  readonly controls: readonly {
    readonly controlId: string;
    readonly label?: string | undefined;
  }[];
  readonly handlers: WorkspaceHandlers;
  readonly annotationDraft: string;
  readonly onAnnotationDraftChange: (text: string) => void;
}

/** The controls panel: scene controls (branch/simulate) + the annotation composer. */
export function WorldControlsPanel({
  controls,
  handlers,
  annotationDraft,
  onAnnotationDraftChange,
}: WorldControlsPanelProps): ReactNode {
  return (
    <div data-panel="controls" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Branch · simulate · annotate</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {controls.map((control) => (
          <button
            key={control.controlId}
            type="button"
            data-scene-control={control.controlId}
            style={BUTTON_STYLE}
            onClick={() => handlers.onControlInvoke(control.controlId)}
          >
            {control.label ?? control.controlId}
          </button>
        ))}
      </div>
      <form
        data-annotation-composer=""
        onSubmit={(event) => {
          event.preventDefault();
          handlers.onAnnotationSubmit(annotationDraft);
        }}
        style={{ display: 'flex', gap: 6 }}
      >
        <input
          data-testid="annotation-input"
          type="text"
          value={annotationDraft}
          placeholder="Annotate the focused entity…"
          onChange={(event) => onAnnotationDraftChange(event.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #d6d3d1' }}
        />
        <button type="submit" data-testid="annotation-submit" style={BUTTON_STYLE}>
          Annotate
        </button>
      </form>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#a8a29e' }}>
        Branch/simulate issue typed intents and surface request effects for the authorities — never direct mutation.
      </p>
    </div>
  );
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
}: WorldFoundationPanelProps): ReactNode {
  return (
    <div data-panel="foundation" style={PANEL_STYLE}>
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
          style={{ fontSize: 11, maxWidth: 240 }}
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
        <span style={{ fontSize: 11, color: '#a8a29e' }}>
          glTF/GLB → validate → content-address → typed bind intent
        </span>
      </form>
      {sessionAssets.imported.length === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a8a29e' }}>
          No foundation assets imported yet.
        </p>
      ) : (
        <ul style={{ ...LIST_STYLE, marginTop: 8 }}>
          {sessionAssets.imported.map((asset) => (
            <li
              key={asset.assetDigest}
              data-imported-asset={asset.assetDigest}
              data-asset-kind={asset.assetKind}
            >
              <code style={{ fontSize: 11 }}>{shortDigest(asset.assetDigest)}</code>{' '}
              <small>
                {asset.label ?? 'imported asset'} · {asset.assetKind} · {asset.byteSize} bytes
                {asset.vertexCount !== null && asset.triangleCount !== null
                  ? ` · ${asset.vertexCount} vertices · ${asset.triangleCount} triangles`
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
      <h3 style={{ ...TITLE_STYLE, marginTop: 12 }}>Bound-asset ledger</h3>
      {sessionAssets.ledger.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>
          No bindings applied yet — the ledger is digest-addressed experience state, never semantic authority.
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
              <strong>{entry.outcome}</strong>{' '}
              <code style={{ fontSize: 11 }}>{shortDigest(entry.assetDigest)}</code>{' '}
              <small>
                {entry.assetKind} on {entry.rendererId}
                {entry.reason !== null ? ` (${entry.reason})` : ''} · binding{' '}
                <code style={{ fontSize: 11 }}>{shortDigest(entry.bindingDigest)}</code> · receipt{' '}
                <code style={{ fontSize: 11 }}>{shortDigest(entry.receiptDigest)}</code>
              </small>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#a8a29e' }}>
        Only sealed, content-addressed, tenant-scoped bindings are bindable — the trust gate stays in the interchange bridge.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The intent journal (typed-intent evidence + surfaced effects).
// ---------------------------------------------------------------------------

/** The intent journal: every interaction's typed intent + the effect queue. */
export function WorldIntentJournal({
  viewModel,
}: {
  readonly viewModel: WorkspaceViewModelInput;
}): ReactNode {
  const entries = [...viewModel.journal].reverse().slice(0, 12);
  return (
    <div data-panel="journal" style={PANEL_STYLE}>
      <h3 style={TITLE_STYLE}>Intent journal</h3>
      <ul style={{ ...LIST_STYLE, maxHeight: 180, overflow: 'hidden' }}>
        {entries.map((entry, index) => (
          <li key={`${entry.atMs}-${index}`} data-journal-entry={entry.intentKind} data-journal-outcome={entry.outcome}>
            <code style={{ fontSize: 11 }}>{entry.controlIntentId}</code>{' '}
            <small>
              {entry.outcome}
              {entry.hitEntityId !== undefined ? ` · ${entry.hitEntityId}` : ''}
              {entry.detail !== undefined ? ` — ${entry.detail}` : ''}
            </small>
          </li>
        ))}
      </ul>
      <h3 style={{ ...TITLE_STYLE, marginTop: 12 }}>Effects awaiting authority</h3>
      <ul style={LIST_STYLE}>
        {viewModel.effects.slice(-6).reverse().map((entry, index) => (
          <li key={`${entry.atMs}-${index}`} data-effect={entry.effect.effect}>
            {describeEffect(entry.effect)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Describe one surfaced effect in neutral terms (no authority claims). */
function describeEffect(effect: EffectEntryInput['effect']): string {
  switch (effect.effect) {
    case 'inspect-requested':
      return `inspect ${effect.entityId} (host routes to the world model)`;
    case 'measure-requested':
      return `measure ${effect.fromEntityId} → ${effect.toEntityId}`;
    case 'compare-requested':
      return `compare ${effect.leftEntityId} ↔ ${effect.rightEntityId}`;
    case 'simulate-requested':
      return `simulate ${effect.scenarioRef} (simulation fabric)`;
    case 'query-requested':
      return `query "${effect.text.slice(0, 32)}"`;
    case 'change-requested':
      return `change ${effect.entityId}.${effect.propertyPath} (Action Gateway)`;
    case 'connect-requested':
      return `connect ${effect.fromEntityId} → ${effect.toEntityId}`;
    case 'disconnect-requested':
      return `disconnect ${effect.fromEntityId} → ${effect.toEntityId}`;
    case 'branch-requested':
      return `branch at ${(effect.atMs / 1000).toFixed(1)}s (branch authority)`;
    case 'binding-requested':
      return `bind asset binding ${effect.bindingDigest.slice(0, 12)}… (tenant ${effect.tenantId}) — presentation binding through the fabric`;
  }
}
