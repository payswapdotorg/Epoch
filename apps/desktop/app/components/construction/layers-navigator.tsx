'use client';

/**
 * W073 — the CONSTRUCTION LAYERS NAVIGATOR (the left panel of the desktop
 * construction solution workspace; the Atelier "left library" adapted to
 * construction systems).
 *
 * The six construction layers (SITE / FOUNDATION / STRUCTURE / ENVELOPE /
 * MEP / FINISHES) are the runtime's DERIVED semantic layers (`lyr-`
 * namespaces of the canonical entity types) enriched with the frozen
 * fixture's layer records (labels, descriptions, membership). Every toggle
 * / isolation goes through the EXISTING typed Epoch interaction path
 * (`runtime.toggleLayer` / `isolateLayer` / `revealAllLayers` — the hide /
 * show / filter intents); nothing here is a second layer authority.
 */
import type { ReactNode } from 'react';
import type { WorldTool, WorldWorkspaceRuntime, WorkspaceViewModel } from '@epoch/world-runtime';
import {
  SOLUTION_LAYERS,
  agentsWorkingOn,
  isolatedLayerIdOf,
  type PresentedConstructionEntity,
  type SolutionVariantId,
} from './construction-projection';
import type { PresentedAgent } from './world-viewport';
import { CS, CS_TYPE, layerColorOf } from './construction-tokens';
import { FONTS, RADII, SPACE } from '../ui-tokens';

/** The viewport tools (which typed intent a pick normalizes toward). */
const TOOLS: readonly { readonly tool: WorldTool; readonly label: string; readonly hint: string }[] = [
  { tool: 'select', label: 'Select', hint: 'epoch.world.interaction.select' },
  { tool: 'inspect', label: 'Inspect', hint: 'epoch.world.interaction.inspect' },
  { tool: 'isolate', label: 'Isolate', hint: 'epoch.world.interaction.isolate' },
  { tool: 'measure', label: 'Measure', hint: 'epoch.world.interaction.measure' },
  { tool: 'annotate', label: 'Annotate', hint: 'epoch.world.interaction.annotate' },
  { tool: 'hide', label: 'Hide', hint: 'epoch.world.interaction.hide' },
];

export interface LayersNavigatorProps {
  readonly view: WorkspaceViewModel;
  readonly runtime: WorldWorkspaceRuntime;
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  readonly selectedEntityId: string | null;
  readonly onSelectEntity: (entityId: string) => void;
  readonly agents: readonly PresentedAgent[];
  readonly activeAgentId: string | null;
  readonly onFollowAgent: (agentId: string) => void;
  readonly onInspectAgent: (agentId: string) => void;
  readonly compact: boolean;
}

/** One navigator section header. */
function NavHeader({ title, hint }: { readonly title: string; readonly hint?: string }): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span
        style={{
          fontSize: CS_TYPE.sizeXs,
          fontWeight: 700,
          color: CS.text,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {hint !== undefined ? (
        <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.4 }}>{hint}</span>
      ) : null}
    </div>
  );
}

/** The construction layers navigator (left panel). */
export function LayersNavigator(props: LayersNavigatorProps): ReactNode {
  const { view, runtime } = props;
  const activeTool = view.viewport.activeTool;
  const followedAgentId = view.viewport.followedAgentId;
  // The layer currently ISOLATED in the world (its entities all visible,
  // every other layer hidden — the typed filter intent's state), so the
  // isolation affordance can present WHICH layer owns the world.
  const isolatedLayerId = isolatedLayerIdOf(view.layers);

  return (
    <nav
      aria-label="Construction layers navigator"
      data-testid="cs-layers-navigator"
      style={{
        width: props.compact ? '100%' : 232,
        flexShrink: 0,
        background: CS.surface,
        border: `1px solid ${CS.border}`,
        borderRadius: RADII.md,
        padding: SPACE.md,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.lg,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* ---- Layers ---------------------------------------------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <NavHeader title="Construction layers" hint="Typed hide / show / filter intents." />
        {SOLUTION_LAYERS.map((record) => {
          const layer = view.layers.find((candidate) => candidate.layerId === record.layerId);
          if (layer === undefined) {
            return null; // The canonical scene carries no entity of this layer.
          }
          const color = layerColorOf(layer.layerId);
          const label = record.label;
          const isolated = isolatedLayerId === layer.layerId;
          return (
            <div
              key={layer.layerId}
              data-testid={`cs-layer-${layer.layerId}`}
              data-layer-state={layer.visible ? 'visible' : layer.mixed ? 'mixed' : 'hidden'}
              data-isolated={isolated ? 'true' : 'false'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xs,
                padding: SPACE.sm,
                borderRadius: RADII.sm,
                border: `1px solid ${isolated ? CS.accentBorder : CS.border}`,
                background: isolated ? CS.accentDim : CS.surfaceRaised,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: color.fill,
                    border: `1.5px solid ${color.stroke}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: CS_TYPE.sizeSm, fontWeight: 600, color: CS.text, flex: 1 }}>
                  {label}
                </span>
                <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                  {layer.entityIds.length}
                </span>
              </div>
              <div style={{ display: 'flex', gap: SPACE.xs }}>
                <NavButton
                  active={false}
                  onClick={() => void runtime.toggleLayer(layer.layerId)}
                  testId={`cs-layer-toggle-${layer.layerId}`}
                >
                  {layer.visible ? 'Hide' : layer.mixed ? 'Mixed' : 'Reveal'}
                </NavButton>
                <NavButton
                  active={isolated}
                  onClick={() => void runtime.isolateLayer(layer.layerId)}
                  testId={`cs-layer-isolate-${layer.layerId}`}
                >
                  {isolated ? 'Isolated' : 'Isolate'}
                </NavButton>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {layer.entityIds.slice(0, 24).map((entityId) => {
                  const presentedEntity = props.presented.find(
                    (candidate) => candidate.geometry.entityId === entityId,
                  );
                  const selected = props.selectedEntityId === entityId;
                  // The agent current-work hook: fixture agents working on
                  // this element mark it in the navigator (⌖ + the agent
                  // count) — the same highlight channel the world renders.
                  const workingAgents = agentsWorkingOn(entityId);
                  return (
                    <button
                      key={entityId}
                      type="button"
                      data-cs-layer-entity={entityId}
                      data-agent-work={workingAgents.length > 0 ? String(workingAgents.length) : '0'}
                      title={
                        workingAgents.length > 0
                          ? `${presentedEntity?.projection.label ?? entityId} — ${workingAgents
                              .map((agent) => agent.label)
                              .join(', ')} is working here — select`
                          : `${presentedEntity?.projection.label ?? entityId} — select`
                      }
                      onClick={() => props.onSelectEntity(entityId)}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: `1px solid ${selected ? CS.accentBorder : CS.border}`,
                        background: selected ? CS.accentDim : CS.surfaceSunken,
                        color: selected ? CS.accent : workingAgents.length > 0 ? CS.text : CS.textSecondary,
                        fontSize: CS_TYPE.sizeXxs,
                        fontFamily: FONTS.mono,
                        cursor: 'pointer',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {workingAgents.length > 0 ? '⌖ ' : ''}
                      {presentedEntity?.projection.label ?? entityId}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <NavButton
          active={isolatedLayerId !== null}
          onClick={() => void runtime.revealAllLayers()}
          testId="cs-reveal-all"
        >
          {isolatedLayerId !== null ? 'Clear isolation · reveal all layers' : 'Reveal all layers'}
        </NavButton>
      </div>

      {/* ---- Tools ------------------------------------------------------ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <NavHeader title="Tools" hint="Which typed intent a world pick normalizes toward." />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.xs }}>
          {TOOLS.map((tool) => (
            <NavButton
              key={tool.tool}
              active={activeTool === tool.tool}
              onClick={() => runtime.setTool(tool.tool)}
              testId={`cs-tool-${tool.tool}`}
            >
              {tool.label}
            </NavButton>
          ))}
        </div>
        <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
          epoch.world.interaction.{activeTool}
        </span>
      </div>

      {/* ---- Agents ------------------------------------------------------ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <NavHeader title="Agents on site" hint="Select to inspect the task · follow issues the typed follow-agent intent." />
        {props.agents.map(({ agent }) => {
          const followed = followedAgentId === agent.agentId;
          const inspected = props.activeAgentId === agent.agentId;
          const workEntity = props.presented.find(
            (candidate) => candidate.geometry.entityId === agent.currentWorkEntityId,
          );
          return (
            <div
              key={agent.agentId}
              data-testid={`cs-agent-${agent.agentId}`}
              data-followed={followed ? 'true' : 'false'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xs,
                padding: SPACE.sm,
                borderRadius: RADII.sm,
                border: `1px solid ${inspected ? CS.accentBorder : CS.border}`,
                background: inspected ? CS.accentDim : CS.surfaceRaised,
              }}
            >
              <span style={{ fontSize: CS_TYPE.sizeSm, fontWeight: 600, color: CS.text }}>
                {agent.label}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>{agent.role}</span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
                {agent.task}
              </span>
              <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                <NavButton active={false} onClick={() => props.onInspectAgent(agent.agentId)} testId={`cs-agent-inspect-${agent.agentId}`}>
                  Task
                </NavButton>
                {workEntity === undefined ? null : (
                  <NavButton
                    active={props.selectedEntityId === agent.currentWorkEntityId}
                    onClick={() => props.onSelectEntity(agent.currentWorkEntityId)}
                    testId={`cs-agent-work-${agent.agentId}`}
                  >
                    ⌖ {workEntity.projection.label.slice(0, 16)}
                  </NavButton>
                )}
                <NavButton
                  active={followed}
                  onClick={() => props.onFollowAgent(agent.agentId)}
                  testId={`cs-agent-follow-${agent.agentId}`}
                >
                  {followed ? 'Following' : 'Follow'}
                </NavButton>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** One compact navigator button. */
function NavButton({
  children,
  onClick,
  active,
  testId,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly active: boolean;
  readonly testId?: string;
}): ReactNode {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: RADII.sm,
        border: `1px solid ${active ? CS.accentBorder : CS.border}`,
        background: active ? CS.accentDim : CS.surface,
        color: active ? CS.accent : CS.textSecondary,
        fontSize: CS_TYPE.sizeXxs,
        fontWeight: 600,
        fontFamily: FONTS.sans,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
