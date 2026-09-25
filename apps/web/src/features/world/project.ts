/**
 * Pure projection functions: world-experience-shaped records in, view
 * models out.
 *
 * Deterministic (the house discipline): every output is a plain,
 * presentation-only record; ordering is derived from the input or
 * normalized here (sorted); no clocks, no randomness, no data fetching —
 * these are pure functions of their inputs.
 */
import type {
  AdvanceEnvelopeInput,
  CameraStatusViewModel,
  EnvelopeSummaryViewModel,
  FidelityLevelInput,
  FidelityProfileViewModel,
  FidelityReductionInput,
  InteractionCatalogEntryViewModel,
  InteractionKindInput,
  MountEnvelopeInput,
  MountSummaryViewModel,
  NarrativeFeedEntryViewModel,
  OverlayStackEntryViewModel,
  SceneEntityRowViewModel,
  SubmitIntentInput,
  TimelineStatusViewModel,
  WorldErrorInput,
  WorldErrorNoticeViewModel,
  WorldSceneInput,
  WorldSceneOverviewViewModel,
} from './contracts';

/** The 22 world-subset interaction kinds (sorted; the closed vocabulary). */
const INTERACTION_KINDS: readonly InteractionKindInput[] = [
  'annotate',
  'branch',
  'change',
  'compare',
  'connect',
  'disconnect',
  'filter',
  'follow-agent',
  'hide',
  'inspect',
  'isolate',
  'measure',
  'move',
  'pause',
  'query',
  'replay',
  'resume',
  'rotate',
  'select',
  'show',
  'simulate',
  'zoom',
];

/** Shorten a digest for display (first 12 hex chars). */
function shortDigest(digest: string): string {
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

/** Render a position triple as a display label. */
function positionLabel(position: readonly [number, number, number]): string {
  return `(${position[0]}, ${position[1]}, ${position[2]})`;
}

/** Project one sealed world scene into the overview view model. */
export function toSceneOverview(scene: WorldSceneInput): WorldSceneOverviewViewModel {
  const scopeParts = [scene.tenantScope.tenantId];
  if (scene.tenantScope.workspaceId !== undefined) {
    scopeParts.push(scene.tenantScope.workspaceId);
  }
  if (scene.tenantScope.projectId !== undefined) {
    scopeParts.push(scene.tenantScope.projectId);
  }
  return {
    sceneId: scene.sceneId,
    sceneName: scene.name,
    tenantId: scene.tenantScope.tenantId,
    scopeLabel: scopeParts.join(' / '),
    digestLabel: shortDigest(scene.digest),
    entityCount: scene.entities.length,
    focusedCount: scene.focusedEntityIds.length,
    appliedOverlayCount: scene.appliedOverlays.length,
    narrativeBlockCount: scene.narrativeBlocks.length,
    participantCount: scene.participants.length,
    agentCount: scene.agents.length,
    controlCount: scene.controls.length,
  };
}

/** Project the scene's entities into display rows (input order = canonical order). */
export function toEntityRows(scene: WorldSceneInput): readonly SceneEntityRowViewModel[] {
  const focused = new Set(scene.focusedEntityIds);
  return scene.entities.map((entity) => ({
    entityId: entity.entityId,
    label: entity.label ?? entity.entityId,
    entityType: entity.entityType,
    positionLabel: positionLabel(entity.position),
    focused: focused.has(entity.entityId),
    visible: entity.visible,
    isolated: entity.isolated,
  }));
}

/** Project the applied overlays into the overlay stack (application order). */
export function toOverlayStack(scene: WorldSceneInput): readonly OverlayStackEntryViewModel[] {
  const byId = new Map(scene.overlays.map((overlay) => [overlay.overlayId, overlay]));
  return [...scene.appliedOverlays]
    .sort((a, b) => (a.orderIndex === b.orderIndex ? (a.overlayId < b.overlayId ? -1 : 1) : a.orderIndex - b.orderIndex))
    .map((application) => {
      const overlay = byId.get(application.overlayId);
      const targetLabel =
        overlay === undefined
          ? application.overlayId
          : overlay.overlayKind === 'measurement'
            ? `${overlay.fromEntityId} → ${overlay.toEntityId}`
            : overlay.entityId;
      return {
        overlayId: application.overlayId,
        overlayKind: overlay?.overlayKind ?? 'unknown',
        orderIndex: application.orderIndex,
        targetLabel,
      };
    });
}

/** Project the scene's timeline into the status view model. */
export function toTimelineStatus(scene: WorldSceneInput): TimelineStatusViewModel {
  const timeline = scene.timeline;
  const markers = [...timeline.markers].sort((a, b) => a.atMs - b.atMs);
  const lastMarkerAt = markers.length > 0 ? markers[markers.length - 1]?.atMs ?? 0 : 0;
  const endMs = Math.min(lastMarkerAt, timeline.trackEndMs);
  const progress =
    endMs > 0 ? `${Math.round((timeline.position.atMs / endMs) * 100)}%` : '0%';
  return {
    trackLabel: timeline.trackLabel,
    positionLabel: `${timeline.position.atMs} ms`,
    frameLabel: `frame ${timeline.position.frameIndex}`,
    paused: timeline.position.paused,
    markerCount: timeline.markers.length,
    branchPointCount: timeline.markers.filter((marker) => marker.markerKind === 'branch-point').length,
    progressLabel: progress,
  };
}

/** Project the scene's camera into the status view model. */
export function toCameraStatus(scene: WorldSceneInput): CameraStatusViewModel {
  const camera = scene.camera;
  if (camera.mode === 'follow-agent') {
    const cursorLabel =
      camera.cursor?.position3d !== undefined
        ? `cursor ${positionLabel(camera.cursor.position3d)}`
        : camera.cursor?.position2d !== undefined
          ? `cursor (${camera.cursor.position2d.x}, ${camera.cursor.position2d.y})`
          : null;
    return {
      mode: camera.mode,
      detailLabel: `following ${camera.agentRef.agentId}${
        camera.followDistance !== undefined ? ` at ${camera.followDistance} m` : ''
      }`,
      followingAgentId: camera.agentRef.agentId,
      cursorLabel,
    };
  }
  if (camera.mode === 'orbit') {
    return {
      mode: camera.mode,
      detailLabel: `eye ${positionLabel(camera.position)}${
        camera.target !== undefined ? ` → ${positionLabel(camera.target)}` : ''
      }`,
      followingAgentId: null,
      cursorLabel: null,
    };
  }
  return {
    mode: camera.mode,
    detailLabel: `eye ${positionLabel(camera.position)}`,
    followingAgentId: null,
    cursorLabel: null,
  };
}

/** Project the narrative blocks into feed entries (canonical order). */
export function toNarrativeFeed(scene: WorldSceneInput): readonly NarrativeFeedEntryViewModel[] {
  return [...scene.narrativeBlocks]
    .sort((a, b) => (a.blockId < b.blockId ? -1 : 1))
    .map((block) => ({
      blockId: block.blockId,
      title: block.title,
      tone: block.tone ?? 'neutral',
      evidenceCount: block.evidenceDigests?.length ?? 0,
      hasBody: block.body !== undefined,
    }));
}

/** The interaction catalog: every world-subset kind with its ControlIntent bridge id. */
export function toInteractionCatalog(): readonly InteractionCatalogEntryViewModel[] {
  return INTERACTION_KINDS.map((kind) => ({
    kind,
    intentId: `epoch.world.interaction.${kind}`,
  }));
}

/** The canonical fidelity profile table (mirrored from the package's frozen data). */
const FIDELITY_PROFILES: Readonly<
  Record<FidelityLevelInput, {
    spatial: boolean;
    maxAppliedOverlays: number;
    maxAnimationInstructions: number;
    presenceDetail: string;
    narrativeDetail: string;
    remoteRendering: boolean;
  }>
> = {
  desktop: {
    spatial: true,
    maxAppliedOverlays: 64,
    maxAnimationInstructions: 128,
    presenceDetail: 'full',
    narrativeDetail: 'full',
    remoteRendering: false,
  },
  web: {
    spatial: true,
    maxAppliedOverlays: 16,
    maxAnimationInstructions: 32,
    presenceDetail: 'seats',
    narrativeDetail: 'full',
    remoteRendering: false,
  },
  mobile: {
    spatial: true,
    maxAppliedOverlays: 8,
    maxAnimationInstructions: 8,
    presenceDetail: 'seats',
    narrativeDetail: 'headlines',
    remoteRendering: false,
  },
  low: {
    spatial: false,
    maxAppliedOverlays: 4,
    maxAnimationInstructions: 0,
    presenceDetail: 'none',
    narrativeDetail: 'headlines',
    remoteRendering: false,
  },
  remote: {
    spatial: true,
    maxAppliedOverlays: 64,
    maxAnimationInstructions: 128,
    presenceDetail: 'full',
    narrativeDetail: 'full',
    remoteRendering: true,
  },
};

/** Project one fidelity level (+ its reductions) into the profile view model. */
export function toFidelityProfile(
  level: FidelityLevelInput,
  reductions: readonly FidelityReductionInput[] = [],
): FidelityProfileViewModel {
  const profile = FIDELITY_PROFILES[level];
  return {
    level,
    capabilityLines: [
      { label: 'Spatial presentation', value: profile.spatial ? '3D' : '2D/reduced' },
      { label: 'Max applied overlays', value: String(profile.maxAppliedOverlays) },
      { label: 'Max animation instructions', value: String(profile.maxAnimationInstructions) },
      { label: 'Presence detail', value: profile.presenceDetail },
      { label: 'Narrative detail', value: profile.narrativeDetail },
      { label: 'Remote rendering', value: profile.remoteRendering ? 'requested' : 'off' },
    ],
    reductionCount: reductions.length,
  };
}

/** Project one mount envelope into a summary view model. */
export function toMountSummary(envelope: MountEnvelopeInput): MountSummaryViewModel {
  const graphKindLabel = envelope.invocationId.split('-').slice(-1)[0] ?? 'graph';
  const usageParts: string[] = [];
  if (envelope.declaredTriangles !== undefined) {
    usageParts.push(`${envelope.declaredTriangles} triangles`);
  }
  if (envelope.declaredTextureBytes !== undefined) {
    usageParts.push(`${envelope.declaredTextureBytes} texture bytes`);
  }
  return {
    invocationId: envelope.invocationId,
    graphKindLabel,
    digestLabel: shortDigest(envelope.graphDigest),
    declaredUsageLabel: usageParts.length > 0 ? usageParts.join(' · ') : 'no declared usage',
  };
}

/** Project the advance-frame envelope into a summary view model. */
export function toAdvanceSummary(envelope: AdvanceEnvelopeInput): EnvelopeSummaryViewModel {
  return {
    invocationId: envelope.invocationId,
    kindLabel: 'advance-frame',
    detailLabel: `frame ${envelope.frameIndex} at ${envelope.atMs} ms`,
  };
}

/** Project the submit-intent envelope into a summary view model. */
export function toSubmitIntentSummary(envelope: SubmitIntentInput): EnvelopeSummaryViewModel {
  return {
    invocationId: envelope.invocationId,
    kindLabel: 'submit-intent',
    detailLabel: `${envelope.intent.id}@${envelope.intent.version} via ${envelope.modality}`,
  };
}

/** Project one typed world-experience error into the notice view model. */
export function toErrorNotice(error: WorldErrorInput): WorldErrorNoticeViewModel {
  let detailLabel: string | null = null;
  switch (error.code) {
    case 'budget-exceeded':
      detailLabel = `${error.resource}: encountered ${error.encountered}, limit ${error.limit}`;
      break;
    case 'cross-tenant-denied':
      detailLabel = `expected tenant ${error.expectedTenantId}, encountered ${error.encounteredTenantId}`;
      break;
    case 'digest-mismatch':
      detailLabel = `expected ${shortDigest(error.expected)}, encountered ${shortDigest(error.encountered)}`;
      break;
    case 'executable-ui-rejected':
      detailLabel = `offending key: ${error.offendingKey}`;
      break;
    case 'invalid-intent':
    case 'malformed-record':
      detailLabel =
        error.issues.length > 0
          ? error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
          : null;
      break;
    case 'unknown-evidence-reference':
      detailLabel = `evidence ${shortDigest(error.evidenceDigest)}`;
      break;
    case 'unknown-overlay-reference':
      detailLabel = `overlay ${error.overlayId}`;
      break;
    case 'unknown-ontology-record':
      detailLabel = error.recordId ?? error.discriminator ?? null;
      break;
    case 'unknown-scene-reference':
      detailLabel = `reference ${error.encountered}`;
      break;
    case 'version-unsupported':
      detailLabel = `expected ${error.expected}, encountered ${error.encountered}`;
      break;
    case 'invalid-replay-position':
      detailLabel = null;
      break;
  }
  return {
    code: error.code,
    title: error.code,
    message: error.message,
    detailLabel,
  };
}
