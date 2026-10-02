/**
 * The WORKSPACE VIEW MODELS (W057): pure, presenter-agnostic projections
 * of the workspace runtime's state. Every app surface (the web feature's
 * React components, the desktop world host, the qa/world-experience
 * harness) renders THESE records — the runtime owns no UI framework, and
 * the view models contain NO semantic payload beyond opaque canonical
 * references (entity ids + digests) plus presentation-ready labels.
 *
 * The view models are derived on demand (never cached): each `viewModel()`
 * call re-projects the CURRENT canonical scene revision, the CURRENT
 * fabric session record, and the ephemeral navigation/presentation state.
 */
import type {
  PortableViewState,
  RendererHealth,
  RendererSession,
} from '@epoch/renderer-runtime';
import type {
  SceneEntity,
  WorldScene,
  WorldIntentEffect,
} from '@epoch/world-experience';
import { computeSceneUsage } from '@epoch/world-experience';
import type { NavigationState } from './navigation';
import type { SemanticLayer } from './layers';
import type { WorldTool } from './version';

// ---------------------------------------------------------------------------
// Viewport projection.
// ---------------------------------------------------------------------------

/** One presented entity glyph of the viewport (the reference presentation). */
export interface ViewportEntity {
  readonly entityId: string;
  readonly label: string;
  readonly entityType: string;
  readonly contentDigest: string;
  readonly position: readonly [number, number, number];
  /** Normalized device coordinates (x/y in [-1,1]); null when behind the eye. */
  readonly ndc: { readonly x: number; readonly y: number } | null;
  /** View-space depth (px ordering/hit proximity; null when behind the eye). */
  readonly depth: number | null;
  readonly visible: boolean;
  readonly isolated: boolean;
  readonly focused: boolean;
  /** Whether a semantic layer toggle currently hides the entity. */
  readonly layerHidden: boolean;
  readonly representationRecordId: string;
}

/** One presented agent marker of the viewport (visible presence). */
export interface ViewportAgent {
  readonly agentId: string;
  readonly contentDigest: string;
  readonly followed: boolean;
}

/** One presented overlay of the viewport (applied overlays in deterministic order). */
export interface ViewportOverlay {
  readonly overlayId: string;
  readonly overlayKind: 'highlight' | 'annotation' | 'measurement' | 'state';
  readonly entityId?: string | undefined;
  readonly fromEntityId?: string | undefined;
  readonly toEntityId?: string | undefined;
  readonly text?: string | undefined;
  readonly color?: string | undefined;
  readonly label?: string | undefined;
}

/** The viewport view model: the primary workspace surface. */
export interface ViewportViewModel {
  /** The canonical scene identity (digest = the exact presented revision). */
  readonly sceneId: string;
  readonly sceneName: string;
  readonly worldDigest: string;
  readonly tenantId: string;
  readonly entities: readonly ViewportEntity[];
  readonly agents: readonly ViewportAgent[];
  readonly overlays: readonly ViewportOverlay[];
  /** The active tool (which typed intent a pointer-down normalizes toward). */
  readonly activeTool: WorldTool;
  /** The ephemeral navigation state (presentation-only camera). */
  readonly navigation: NavigationState;
  /** The canonical camera record of the current scene revision. */
  readonly cameraMode: string;
  /** The followed agent id when the canonical camera follows an agent. */
  readonly followedAgentId: string | null;
}

// ---------------------------------------------------------------------------
// Secondary context surfaces (inspect / layers / timeline / presence /
// renderers / journal).
// ---------------------------------------------------------------------------

/** The inspect view model: canonical entity data of the selection. */
export interface InspectViewModel {
  readonly entityId: string | null;
  readonly label: string | null;
  readonly entityType: string | null;
  readonly contentDigest: string | null;
  readonly position: readonly [number, number, number] | null;
  readonly visible: boolean;
  readonly isolated: boolean;
  readonly representationRecordId: string | null;
  readonly focusedEntities: readonly string[];
}

/** The timeline view model: markers, bounds, and both position clocks. */
export interface TimelineViewModel {
  readonly trackLabel: string;
  readonly trackStartMs: number;
  readonly trackEndMs: number;
  readonly markers: readonly {
    readonly markerId: string;
    readonly atMs: number;
    readonly label?: string | undefined;
    readonly markerKind: string;
  }[];
  /** The canonical position (the scene revision's timeline position). */
  readonly positionAtMs: number;
  readonly frameIndex: number;
  readonly paused: boolean;
  /** The presentation clock (host-loop playback head, clamped to the track). */
  readonly presentationAtMs: number;
}

/** One renderer entry of the selector (Epoch-owned chrome, never vendor UI). */
export interface RendererChoice {
  readonly rendererId: string;
  readonly displayName: string;
  readonly capabilityId: string;
  readonly active: boolean;
  readonly summary: string;
}

/** The renderer-surface view model: selector + health + last switch evidence. */
export interface RendererSurfaceViewModel {
  readonly choices: readonly RendererChoice[];
  readonly activeRendererId: string;
  readonly health: RendererHealth;
  readonly sessionState: string;
  /** The typed failure surfaced to the user (health/fallback banner). */
  readonly lastFailure: { readonly code: string; readonly message: string } | null;
  /** The last switch receipt digest (continuity evidence). */
  readonly lastSwitchDigest: string | null;
  /** The portable view-state fields the current renderer restored. */
  readonly restoredViewFields: readonly string[];
  readonly fallbackApplied: boolean;
}

/** One intent journal entry (the evidence every interaction produced a typed intent). */
export interface JournalEntry {
  readonly atMs: number;
  readonly source: 'viewport-input' | 'workspace-command' | 'scene-control';
  readonly intentKind: string;
  readonly controlIntentId: string;
  readonly outcome: 'normalized' | 'no-target' | 'rejected' | 'applied';
  readonly hitEntityId?: string | undefined;
  readonly detail?: string | undefined;
}

/** One surfaced host-side effect (semantic intents await their authorities). */
export interface EffectEntry {
  readonly atMs: number;
  readonly effect: WorldIntentEffect;
}

/** One scene-control entry (branch/simulation entry points, R30). */
export interface WorkspaceControl {
  readonly controlId: string;
  readonly controlKind: string;
  readonly label: string;
  readonly intentId: string;
}

/** The full workspace view model. */
export interface WorkspaceViewModel {
  readonly viewport: ViewportViewModel;
  readonly inspect: InspectViewModel;
  readonly layers: readonly SemanticLayer[];
  readonly timeline: TimelineViewModel;
  readonly renderers: RendererSurfaceViewModel;
  readonly journal: readonly JournalEntry[];
  readonly effects: readonly EffectEntry[];
  readonly controls: readonly WorkspaceControl[];
  readonly sceneUsage: {
    readonly entityCount: number;
    readonly focusedCount: number;
    readonly agentCount: number;
    readonly markerCount: number;
    readonly controlCount: number;
  };
}

// ---------------------------------------------------------------------------
// Projections (pure).
// ---------------------------------------------------------------------------

/** Project the viewport view model from the canonical scene + runtime state. */
export function projectViewport(input: {
  readonly scene: WorldScene;
  readonly navigation: NavigationState;
  readonly activeTool: WorldTool;
  readonly projected: readonly (ProjectedImage | null)[];
  readonly followedAgentId: string | null;
}): ViewportViewModel {
  const { scene, navigation, activeTool } = input;
  const entities: ViewportEntity[] = scene.entities.map((entity, index) => {
    const image = input.projected[index] ?? null;
    return {
      entityId: entity.entityId,
      label: entity.label ?? entity.entityId,
      entityType: entity.entityType,
      contentDigest: entity.contentDigest,
      position: entity.position,
      ndc: image !== null && image.inFrustum ? { x: image.x, y: image.y } : null,
      depth: image !== null ? image.depth : null,
      visible: entity.visible,
      isolated: entity.isolated,
      focused: scene.focusedEntityIds.includes(entity.entityId),
      layerHidden: !entity.visible,
      representationRecordId: entity.representationRecordId,
    };
  });
  const agents: ViewportAgent[] = scene.agents.map((agent) => ({
    agentId: agent.agentId,
    contentDigest: agent.contentDigest,
    followed: input.followedAgentId === agent.agentId,
  }));
  const overlays: ViewportOverlay[] = [];
  for (const applied of scene.appliedOverlays.slice().sort((a, b) => a.orderIndex - b.orderIndex)) {
    const overlay = scene.overlays.find((o) => o.overlayId === applied.overlayId);
    if (overlay === undefined) {
      continue;
    }
    if (overlay.overlayKind === 'measurement') {
      overlays.push({
        overlayId: overlay.overlayId,
        overlayKind: overlay.overlayKind,
        fromEntityId: overlay.fromEntityId,
        toEntityId: overlay.toEntityId,
        label: overlay.label,
      });
      continue;
    }
    if (overlay.overlayKind === 'highlight' || overlay.overlayKind === 'state') {
      overlays.push({
        overlayId: overlay.overlayId,
        overlayKind: overlay.overlayKind,
        entityId: overlay.entityId,
        ...(overlay.overlayKind === 'highlight' ? { color: overlay.color } : {}),
      });
      continue;
    }
    overlays.push({
      overlayId: overlay.overlayId,
      overlayKind: overlay.overlayKind,
      entityId: overlay.entityId,
      text: overlay.text,
    });
  }
  return {
    sceneId: scene.sceneId,
    sceneName: scene.name,
    worldDigest: scene.digest,
    tenantId: scene.tenantScope.tenantId,
    entities,
    agents,
    overlays,
    activeTool,
    navigation,
    cameraMode: scene.camera.mode,
    followedAgentId: input.followedAgentId,
  };
}

/** The projected image of one entity (carried by the runtime, computed by navigation). */
export interface ProjectedImage {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly inFrustum: boolean;
}

/** Project the inspect view model from the canonical scene. */
export function projectInspect(
  scene: WorldScene,
  focusedEntityId: string | null,
): InspectViewModel {
  const entity: SceneEntity | undefined =
    focusedEntityId === null
      ? undefined
      : scene.entities.find((candidate) => candidate.entityId === focusedEntityId);
  return {
    entityId: entity?.entityId ?? focusedEntityId,
    label: entity?.label ?? null,
    entityType: entity?.entityType ?? null,
    contentDigest: entity?.contentDigest ?? null,
    position: entity?.position ?? null,
    visible: entity?.visible ?? false,
    isolated: entity?.isolated ?? false,
    representationRecordId: entity?.representationRecordId ?? null,
    focusedEntities: scene.focusedEntityIds,
  };
}

/** Project the timeline view model (canonical position + presentation clock). */
export function projectTimeline(
  scene: WorldScene,
  presentationAtMs: number,
): TimelineViewModel {
  const endMs = timelineEndOf(scene);
  return {
    trackLabel: scene.timeline.trackLabel,
    trackStartMs: scene.timeline.trackStartMs,
    trackEndMs: scene.timeline.trackEndMs,
    markers: scene.timeline.markers.map((marker) => ({
      markerId: marker.markerId,
      atMs: marker.atMs,
      label: marker.label,
      markerKind: marker.markerKind,
    })),
    positionAtMs: scene.timeline.position.atMs,
    frameIndex: scene.timeline.position.frameIndex,
    paused: scene.timeline.position.paused,
    presentationAtMs: Math.min(presentationAtMs, endMs),
  };
}

/** The deterministic playback bound (the W016 timeline-end rule). */
export function timelineEndOf(scene: WorldScene): number {
  const markers = scene.timeline.markers;
  const last = markers.length > 0 ? markers[markers.length - 1] : null;
  return last !== null ? Math.min(last.atMs, scene.timeline.trackEndMs) : scene.timeline.trackEndMs;
}

/** Project the renderer-surface view model. */
export function projectRenderers(input: {
  readonly choices: readonly {
    readonly rendererId: string;
    readonly displayName: string;
    readonly capabilityId: string;
    readonly summary: string;
  }[];
  readonly session: RendererSession | null;
  /** The session lifecycle state to report when no live record exists (e.g. after dispose). */
  readonly sessionState?: string | undefined;
  readonly health: RendererHealth | null;
  readonly lastFailure: { readonly code: string; readonly message: string } | null;
  readonly lastSwitchDigest: string | null;
  readonly restoredViewFields: readonly string[];
  readonly fallbackApplied: boolean;
}): RendererSurfaceViewModel {
  const activeRendererId = input.session?.rendererId ?? '';
  return {
    choices: input.choices.map((choice) => ({ ...choice, active: choice.rendererId === activeRendererId })),
    activeRendererId,
    health: input.health ?? {
      state: 'unavailable',
      degradation: 'none',
      lastFailureCode: 'unknown-session',
      detail: 'no renderer session is open',
      atMs: 0,
    },
    sessionState: input.session?.state ?? input.sessionState ?? 'closed',
    lastFailure: input.lastFailure,
    lastSwitchDigest: input.lastSwitchDigest,
    restoredViewFields: input.restoredViewFields,
    fallbackApplied: input.fallbackApplied,
  };
}

/**
 * The portable view state of the current workspace (switch continuity).
 *
 * Reconciliation rule (the W056 contract): the portable view state
 * requires focus and hidden to be DISJOINT presentation sets, while the
 * canonical W016 projection permits a focused entity to be hidden (a
 * layer toggle does not clear canonical focus). The portable projection
 * therefore carries the focus MINUS the hidden set (the presented focus)
 * — the canonical scene's focusedEntityIds is untouched (never a second
 * semantic store).
 */
export function portableViewStateOf(input: {
  readonly scene: WorldScene;
  readonly navigation: NavigationState;
  readonly presentationAtMs: number;
  readonly hiddenEntityIds: readonly string[];
}): PortableViewState {
  const hidden = new Set(input.hiddenEntityIds);
  const presentedFocus = input.scene.focusedEntityIds.filter(
    (entityId) => !hidden.has(entityId),
  );
  return {
    focusedEntityIds: [...presentedFocus].sort(),
    layerVisibility: input.scene.entities.reduce<{ layerId: string; visible: boolean }[]>(
      (entries, entity) => {
        const layerId = `lyr-${entity.entityType.slice(0, entity.entityType.indexOf(':'))}`;
        const existing = entries.find((entry) => entry.layerId === layerId);
        if (existing === undefined) {
          entries.push({ layerId, visible: entity.visible });
        } else {
          existing.visible = existing.visible && entity.visible;
        }
        return entries;
      },
      [],
    ).sort((a, b) => (a.layerId < b.layerId ? -1 : 1)),
    timelinePosition: {
      atMs: input.scene.timeline.position.atMs,
      frameIndex: input.scene.timeline.position.frameIndex,
      paused: input.scene.timeline.position.paused,
    },
    camera: {
      mode: 'orbit' as const,
      position: [
        input.navigation.target[0] +
          input.navigation.distance *
            Math.cos(input.navigation.elevationRad) *
            Math.cos(input.navigation.azimuthRad),
        input.navigation.target[1] +
          input.navigation.distance *
            Math.cos(input.navigation.elevationRad) *
            Math.sin(input.navigation.azimuthRad),
        input.navigation.target[2] + input.navigation.distance * Math.sin(input.navigation.elevationRad),
      ],
      target: input.navigation.target,
      fovRadians: input.navigation.fovRadians,
    },
    hiddenEntityIds: [...input.hiddenEntityIds].sort(),
  };
}

/** Project the scene controls (the candidate/action entries, R30). */
export function projectControls(scene: WorldScene): readonly WorkspaceControl[] {
  return scene.controls.map((control) => ({
    controlId: control.controlId,
    controlKind: control.controlKind,
    label: control.label ?? control.controlId,
    intentId: control.intent.id,
  }));
}

/** The scene usage summary of the view model. */
export function sceneUsageOf(scene: WorldScene): WorkspaceViewModel['sceneUsage'] {
  const usage = computeSceneUsage(scene);
  return {
    entityCount: usage.entityCount,
    focusedCount: usage.focusedCount,
    agentCount: usage.agentCount,
    markerCount: usage.markerCount,
    controlCount: usage.controlCount,
  };
}
