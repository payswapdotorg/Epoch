'use client';
/**
 * W072 — the CONSTRUCTION NAVIGATOR (ACR-012): the LEFT rail of the
 * construction solution workspace (the design-language "left library"
 * adapted to construction systems — narrow, restrained, scrollable).
 *
 * Sections:
 * - TOOLS — the viewport tools (which typed intent a pick normalizes
 *   toward: select / inspect / isolate / measure / annotate / hide);
 * - CONSTRUCTION LAYERS — the six construction layers (site, foundation,
 *   structure, envelope, MEP, finishes) with per-layer toggle / isolation
 *   and the reveal-all affordance, all through the EXISTING typed Epoch
 *   interaction path (hide / show / filter intents over the driver);
 * - AGENTS — the spatial agents present in the scene (select, inspect the
 *   task, follow the agent, jump to the current-work element);
 * - INTENT JOURNAL — the typed-intent evidence (every interaction's typed
 *   receipt + the effects awaiting their authorities).
 */
import type { ReactNode } from 'react';
import type {
  PresentedConstructionEntity,
  SolutionVariantId,
} from '../construction-solution';
import {
  SOLUTION_AGENTS,
  SOLUTION_LAYERS,
  isolatedLayerIdOf,
} from '../construction-solution';
import { CS, CS_TYPE, FONTS, layerColorOf } from '../construction-tokens';
import type {
  ViewportAgentInput,
  WorkspaceViewModelInput,
  WorldToolInput,
} from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';
import { WorldIntentJournal } from './WorldWorkspacePanels';

/** The viewport tools (which typed intent a pick normalizes toward). */
const TOOLS: readonly { readonly tool: WorldToolInput; readonly label: string; readonly hint: string }[] = [
  { tool: 'select', label: 'Select', hint: 'epoch.world.interaction.select' },
  { tool: 'inspect', label: 'Inspect', hint: 'epoch.world.interaction.inspect' },
  { tool: 'isolate', label: 'Isolate', hint: 'epoch.world.interaction.isolate' },
  { tool: 'measure', label: 'Measure', hint: 'epoch.world.interaction.measure' },
  { tool: 'annotate', label: 'Annotate', hint: 'epoch.world.interaction.annotate' },
  { tool: 'hide', label: 'Hide', hint: 'epoch.world.interaction.hide' },
];

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

/** The construction agents entry (fixture agent + runtime presence). */
export interface NavigatorAgent {
  readonly agentId: string;
  readonly label: string;
  readonly role: string;
  readonly task: string;
  readonly currentWorkEntityId: string;
  readonly followed: boolean;
  readonly inspected: boolean;
}

/** The navigator props. */
export interface ConstructionNavigatorProps {
  readonly view: WorkspaceViewModelInput;
  readonly handlers: WorkspaceHandlers;
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  readonly selectedEntityId: string | null;
  /** Select one entity from a host surface (navigator rows, agent work links). */
  readonly onSelectEntity: (entityId: string) => void;
  readonly agents: readonly NavigatorAgent[];
  /** Inspect one agent's task (swap the inspector to the agent card). */
  readonly onInspectAgent: (agentId: string) => void;
  readonly compactJournal: boolean;
}

/** The construction layers navigator (the left rail). */
export function ConstructionNavigator(props: ConstructionNavigatorProps): ReactNode {
  const { view, handlers } = props;
  const activeTool = view.viewport.activeTool;
  // The layer currently ISOLATED in the world (its entities all visible,
  // every other layer hidden — the typed filter intent's state), so the
  // isolation affordance can present WHICH layer owns the world.
  const isolatedLayerId = isolatedLayerIdOf(view.layers);

  return (
    <nav
      aria-label="Construction navigator"
      data-testid="cs-navigator"
      data-panel="navigator"
      data-workspace-secondary=""
      style={{
        // A viewport-PROPORTIONAL rail (never a fixed strip): the navigator
        // holds ~11% of the workspace row and the inspector ~15%, so the
        // WORLD keeps a constant, dominant share of the main surface at
        // every window width; the min clamps keep the rail readable on the
        // smallest canonical canvas (the 1280x720 battery viewport) and the
        // rails widen with the window on larger displays. boxSizing
        // border-box keeps the basis honest (padding + border included).
        flex: '0 0 11%',
        minWidth: 170,
        boxSizing: 'border-box',
        background: CS.surface,
        border: `1px solid ${CS.border}`,
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* ---- Tools ------------------------------------------------------ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NavHeader title="Tools" hint="The typed pick intent of the active tool." />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TOOLS.map((entry) => (
            <button
              key={entry.tool}
              type="button"
              data-tool={entry.tool}
              data-tool-active={activeTool === entry.tool ? 'true' : 'false'}
              title={entry.hint}
              onClick={() => handlers.onToolSelect(entry.tool)}
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                border: `1px solid ${activeTool === entry.tool ? CS.accentBorder : CS.border}`,
                background: activeTool === entry.tool ? CS.accentDim : CS.surfaceRaised,
                color: activeTool === entry.tool ? CS.accent : CS.textSecondary,
                fontSize: CS_TYPE.sizeXxs,
                fontWeight: 600,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Construction layers ---------------------------------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NavHeader title="Construction layers" hint="Typed hide / show / filter intents." />
        {SOLUTION_LAYERS.map((record) => {
          const layer = view.layers.find((candidate) => candidate.layerId === record.layerId);
          if (layer === undefined) {
            return null; // The canonical scene carries no entity of this layer.
          }
          const color = layerColorOf(layer.layerId);
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
                gap: 4,
                padding: 5,
                borderRadius: 4,
                border: `1px solid ${isolated ? CS.accentBorder : CS.border}`,
                background: isolated ? CS.accentDim : CS.surfaceRaised,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: color.fill,
                    border: `1.5px solid ${color.stroke}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: CS_TYPE.sizeSm,
                    fontWeight: 600,
                    color: layer.visible || layer.mixed ? CS.text : CS.textMuted,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${record.label} — ${record.description}`}
                >
                  {record.label}
                </span>
                <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                  {layer.entityIds.length}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  data-testid={`layer-toggle-${layer.layerId}`}
                  onClick={() => handlers.onLayerToggle(layer.layerId)}
                  style={{
                    flex: 1,
                    padding: '1px 0',
                    borderRadius: 3,
                    border: `1px solid ${CS.border}`,
                    background: layer.visible ? CS.surfaceRaised : CS.surfaceSunken,
                    color: layer.visible ? CS.textSecondary : CS.textMuted,
                    fontSize: CS_TYPE.sizeXxs,
                    fontFamily: FONTS.sans,
                    cursor: 'pointer',
                  }}
                >
                  {layer.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  data-testid={`layer-isolate-${layer.layerId}`}
                  onClick={() => handlers.onLayerIsolate(layer.layerId)}
                  style={{
                    flex: 1,
                    padding: '1px 0',
                    borderRadius: 3,
                    border: `1px solid ${isolated ? CS.accentBorder : CS.border}`,
                    background: isolated ? CS.accentDim : CS.surfaceRaised,
                    color: isolated ? CS.accent : CS.textSecondary,
                    fontSize: CS_TYPE.sizeXxs,
                    fontFamily: FONTS.sans,
                    cursor: 'pointer',
                  }}
                >
                  {isolated ? 'Isolated' : 'Isolate'}
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          data-testid="layers-reveal-all"
          onClick={() => handlers.onLayersRevealAll()}
          style={{
            padding: '2px 0',
            borderRadius: 4,
            border: `1px solid ${CS.border}`,
            background: CS.surfaceRaised,
            color: CS.textSecondary,
            fontSize: CS_TYPE.sizeXxs,
            fontWeight: 600,
            fontFamily: FONTS.sans,
            cursor: 'pointer',
          }}
        >
          Reveal all layers
        </button>
      </div>

      {/* ---- Agents ------------------------------------------------------ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NavHeader title="Agents in the world" hint="Follow issues the typed follow-agent intent." />
        {props.agents.length === 0 ? (
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>No agents present.</span>
        ) : (
          <ul
            data-panel="presence"
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            {props.agents.map((agent) => (
              <li
                key={agent.agentId}
                data-presence-agent={agent.agentId}
                data-agent-followed={agent.followed ? 'true' : 'false'}
                data-agent-inspected={agent.inspected ? 'true' : 'false'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: 5,
                  borderRadius: 4,
                  border: `1px solid ${agent.inspected ? CS.accentBorder : CS.border}`,
                  background: agent.followed ? CS.accentDim : CS.surfaceRaised,
                }}
              >
                <span style={{ fontSize: CS_TYPE.sizeXs, fontWeight: 600, color: CS.text }}>{agent.label}</span>
                <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.4 }}>{agent.role}</span>
                <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.4 }}>{agent.task}</span>
                <button
                  type="button"
                  data-testid={`agent-work-${agent.agentId}`}
                  title={`Inspect ${agent.currentWorkEntityId} (the element this agent is working on)`}
                  onClick={() => props.onSelectEntity(agent.currentWorkEntityId)}
                  style={{
                    textAlign: 'left',
                    padding: '1px 5px',
                    borderRadius: 3,
                    border: `1px dashed ${CS.borderStrong}`,
                    background: 'transparent',
                    color: CS.accent,
                    fontSize: CS_TYPE.sizeXxs,
                    fontFamily: FONTS.mono,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⌖ {agent.currentWorkEntityId}
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    data-testid={`follow-${agent.agentId}`}
                    onClick={() => handlers.onAgentFollow(agent.agentId)}
                    style={{
                      flex: 1,
                      padding: '1px 0',
                      borderRadius: 3,
                      border: `1px solid ${agent.followed ? CS.accentBorder : CS.border}`,
                      background: agent.followed ? CS.accentDim : CS.surfaceRaised,
                      color: agent.followed ? CS.accent : CS.textSecondary,
                      fontSize: CS_TYPE.sizeXxs,
                      fontFamily: FONTS.sans,
                      cursor: 'pointer',
                    }}
                  >
                    {agent.followed ? 'Following' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    data-testid={`agent-inspect-${agent.agentId}`}
                    onClick={() => props.onInspectAgent(agent.agentId)}
                    style={{
                      flex: 1,
                      padding: '1px 0',
                      borderRadius: 3,
                      border: `1px solid ${agent.inspected ? CS.accentBorder : CS.border}`,
                      background: CS.surfaceRaised,
                      color: agent.inspected ? CS.accent : CS.textSecondary,
                      fontSize: CS_TYPE.sizeXxs,
                      fontFamily: FONTS.sans,
                      cursor: 'pointer',
                    }}
                  >
                    {agent.inspected ? 'Inspecting' : 'Inspect'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- The intent journal (typed-intent evidence) -------------------- */}
      <WorldIntentJournal viewModel={view} compact={props.compactJournal} />
    </nav>
  );
}

/** Map the runtime viewport agents + the fixture agents to navigator entries. */
export function navigatorAgentsOf(
  viewportAgents: readonly ViewportAgentInput[],
  followedAgentId: string | null,
  inspectedAgentId: string | null,
): readonly NavigatorAgent[] {
  return viewportAgents.map((present) => {
    const fixture = SOLUTION_AGENTS.find((agent) => agent.agentId === present.agentId);
    return {
      agentId: present.agentId,
      label: fixture?.label ?? present.agentId,
      role: fixture?.role ?? 'agent',
      task: fixture?.task ?? 'present in the world',
      currentWorkEntityId: fixture?.currentWorkEntityId ?? '',
      followed: followedAgentId === present.agentId,
      inspected: inspectedAgentId === present.agentId,
    };
  });
}
