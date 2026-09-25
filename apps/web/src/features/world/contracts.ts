/**
 * World feature contracts — the typed VIEW-MODEL surface of the
 * interactive-world feature module (W016).
 *
 * Design constraint (binding): this module lives inside `apps/web` whose
 * manifest is FROZEN to this Work Order (apps/web/package.json is W014's
 * surface), so it cannot declare `@epoch/world-experience` as a
 * dependency and therefore cannot import it. Instead, the record-facing
 * input types below are STRUCTURAL MIRRORS of the exact
 * `@epoch/world-experience` public-surface subset this feature consumes.
 * TypeScript structural typing means the package records are assignable
 * to these interfaces as-is the moment W014 wires the feature (see
 * README.md for the wiring contract and the field-by-field mapping).
 *
 * View models are presentation-only records (label-ready strings, sorted
 * collections) — never kernel semantics (architecture lock rule 8: the
 * experience layer is a projection, never a second source of truth).
 */

// ---------------------------------------------------------------------------
// Input contracts — structural mirrors of the @epoch/world-experience
// surface (field names and shapes match the package records exactly).
// ---------------------------------------------------------------------------

/** The world-subset universal interaction kinds (the package's closed vocabulary). */
export type InteractionKindInput =
  | 'annotate'
  | 'branch'
  | 'change'
  | 'compare'
  | 'connect'
  | 'disconnect'
  | 'filter'
  | 'follow-agent'
  | 'hide'
  | 'inspect'
  | 'isolate'
  | 'measure'
  | 'move'
  | 'pause'
  | 'query'
  | 'replay'
  | 'resume'
  | 'rotate'
  | 'select'
  | 'show'
  | 'simulate'
  | 'zoom';

/** The typed fidelity levels (device adaptation). */
export type FidelityLevelInput = 'desktop' | 'low' | 'mobile' | 'remote' | 'web';

/** One scene entity (the package's SceneEntity, structural). */
export interface SceneEntityInput {
  readonly entityId: string;
  readonly contentDigest: string;
  readonly entityType: string;
  readonly representationRecordId: string;
  readonly affordanceRecordId?: string | undefined;
  readonly label?: string | undefined;
  readonly position: readonly [number, number, number];
  readonly orientation?: readonly [number, number, number, number] | undefined;
  readonly scale?: readonly [number, number, number] | undefined;
  readonly visible: boolean;
  readonly isolated: boolean;
}

/** One visual overlay (the package's VisualOverlay union, structural). */
export type VisualOverlayInput =
  | {
      readonly overlayId: string;
      readonly overlayKind: 'highlight';
      readonly entityId: string;
      readonly color: string;
    }
  | {
      readonly overlayId: string;
      readonly overlayKind: 'annotation';
      readonly entityId: string;
      readonly text: string;
      readonly evidenceDigests?: readonly string[] | undefined;
    }
  | {
      readonly overlayId: string;
      readonly overlayKind: 'measurement';
      readonly fromEntityId: string;
      readonly toEntityId: string;
      readonly label?: string | undefined;
      readonly evidenceDigests?: readonly string[] | undefined;
    }
  | {
      readonly overlayId: string;
      readonly overlayKind: 'state';
      readonly entityId: string;
      readonly stateKey: string;
      readonly tint?: string | undefined;
      readonly badgeLabel?: string | undefined;
    };

/** One applied-overlay entry (the package's OverlayApplication, structural). */
export interface OverlayApplicationInput {
  readonly overlayId: string;
  readonly orderIndex: number;
}

/** One timeline marker (the package's SceneTimelineMarker, structural). */
export interface SceneMarkerInput {
  readonly markerId: string;
  readonly atMs: number;
  readonly label?: string | undefined;
  readonly markerKind: 'branch-point' | 'event' | 'phase-end' | 'phase-start' | 'replay-cursor';
}

/** The timeline/replay position (the package's SceneTimelinePosition, structural). */
export interface TimelinePositionInput {
  readonly atMs: number;
  readonly frameIndex: number;
  readonly paused: boolean;
}

/** The scene timeline (the package's SceneTimeline, structural). */
export interface SceneTimelineInput {
  readonly markers: readonly SceneMarkerInput[];
  readonly trackLabel: string;
  readonly trackStartMs: number;
  readonly trackEndMs: number;
  readonly position: TimelinePositionInput;
}

/** The camera state (the package's CameraState union, structural). */
export type CameraStateInput =
  | {
      readonly mode: 'orbit';
      readonly position: readonly [number, number, number];
      readonly orientation?: readonly [number, number, number, number] | undefined;
      readonly target?: readonly [number, number, number] | undefined;
      readonly fovRadians?: number | undefined;
    }
  | {
      readonly mode: 'free';
      readonly position: readonly [number, number, number];
      readonly orientation?: readonly [number, number, number, number] | undefined;
    }
  | {
      readonly mode: 'follow-agent';
      readonly agentRef: {
        readonly kind: 'agent';
        readonly tenantId: string;
        readonly agentId: string;
        readonly contentDigest: string;
      };
      readonly followDistance?: number | undefined;
      readonly cursor?:
        | {
            readonly position2d?: { readonly x: number; readonly y: number } | undefined;
            readonly position3d?: readonly [number, number, number] | undefined;
            readonly atMs?: number | undefined;
          }
        | undefined;
    };

/** One narrative/status block (the package's NarrativeStatusBlock, structural). */
export interface NarrativeBlockInput {
  readonly blockId: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly tone?: 'cautionary' | 'celebratory' | 'informative' | 'neutral' | undefined;
  readonly statusKey?: string | undefined;
  readonly evidenceDigests?: readonly string[] | undefined;
  readonly atMs?: number | undefined;
}

/** One scene candidate/action control (the package's SceneControl, structural). */
export interface SceneControlInput {
  readonly controlId: string;
  readonly controlKind: 'axis' | 'button' | 'selector' | 'toggle';
  readonly intent: { readonly id: string; readonly version: string };
  readonly label?: string | undefined;
  readonly options?: readonly string[] | undefined;
}

/** One presence participant (the package's ParticipantReference, structural). */
export interface ParticipantInput {
  readonly participantId: string;
  readonly participantKind: 'agent' | 'human' | 'system';
}

/** The sealed world scene (the package's WorldScene, structural). */
export interface WorldSceneInput {
  readonly schema: 'epoch.world-scene';
  readonly protocolVersion: string;
  readonly sceneId: string;
  readonly tenantScope: {
    readonly tenantId: string;
    readonly workspaceId?: string | undefined;
    readonly projectId?: string | undefined;
  };
  readonly name: string;
  readonly entities: readonly SceneEntityInput[];
  readonly focusedEntityIds: readonly string[];
  readonly overlays: readonly VisualOverlayInput[];
  readonly appliedOverlays: readonly OverlayApplicationInput[];
  readonly narrativeBlocks: readonly NarrativeBlockInput[];
  readonly timeline: SceneTimelineInput;
  readonly camera: CameraStateInput;
  readonly participants: readonly ParticipantInput[];
  readonly agents: readonly {
    readonly kind: 'agent';
    readonly tenantId: string;
    readonly agentId: string;
    readonly contentDigest: string;
  }[];
  readonly evidenceReferences: readonly {
    readonly kind: 'evidence-record';
    readonly tenantId: string;
    readonly recordDigest: string;
  }[];
  readonly controls: readonly SceneControlInput[];
  readonly digest: string;
}

/** The mount-graph envelope (the package's WorldMountGraphEnvelope, structural). */
export interface MountEnvelopeInput {
  readonly schema: 'epoch.renderer-invocation';
  readonly protocolVersion: string;
  readonly kind: 'mount-graph';
  readonly invocationId: string;
  readonly rendererSessionId: string;
  readonly graphDigest: string;
  readonly atMs: number;
  readonly declaredTriangles?: number | undefined;
  readonly declaredTextureBytes?: number | undefined;
}

/** The advance-frame envelope (the package's WorldAdvanceFrameEnvelope, structural). */
export interface AdvanceEnvelopeInput {
  readonly schema: 'epoch.renderer-invocation';
  readonly protocolVersion: string;
  readonly kind: 'advance-frame';
  readonly invocationId: string;
  readonly rendererSessionId: string;
  readonly frameIndex: number;
  readonly atMs: number;
}

/** The submit-intent envelope (the package's WorldSubmitIntentEnvelope, structural). */
export interface SubmitIntentInput {
  readonly schema: 'epoch.renderer-invocation';
  readonly protocolVersion: string;
  readonly kind: 'submit-intent';
  readonly invocationId: string;
  readonly rendererSessionId: string;
  readonly modality: string;
  readonly intent: { readonly id: string; readonly version: string };
}

/** The typed world-experience error (the package's WorldExperienceError union, structural). */
export type WorldErrorInput =
  | { readonly code: 'version-unsupported'; readonly message: string; readonly expected: string; readonly encountered: string }
  | { readonly code: 'malformed-record'; readonly message: string; readonly issues: readonly { path: string; message: string }[] }
  | { readonly code: 'digest-mismatch'; readonly message: string; readonly expected: string; readonly encountered: string }
  | { readonly code: 'unknown-scene-reference'; readonly message: string; readonly encountered: string }
  | { readonly code: 'cross-tenant-denied'; readonly message: string; readonly expectedTenantId: string; readonly encounteredTenantId: string }
  | { readonly code: 'invalid-intent'; readonly message: string; readonly issues: readonly { path: string; message: string }[] }
  | { readonly code: 'unknown-overlay-reference'; readonly message: string; readonly overlayId: string }
  | { readonly code: 'unknown-ontology-record'; readonly message: string; readonly recordId?: string | undefined; readonly discriminator?: string | undefined }
  | { readonly code: 'budget-exceeded'; readonly message: string; readonly resource: string; readonly limit: number; readonly encountered: number }
  | { readonly code: 'executable-ui-rejected'; readonly message: string; readonly offendingKey: string }
  | { readonly code: 'invalid-replay-position'; readonly message: string }
  | { readonly code: 'unknown-evidence-reference'; readonly message: string; readonly evidenceDigest: string };

/** One explicit fidelity reduction (the package's FidelityReduction, structural). */
export interface FidelityReductionInput {
  readonly aspect: string;
  readonly reason: string;
  readonly encountered: number;
  readonly retained: number;
}

// ---------------------------------------------------------------------------
// View models — presentation-only records (label-ready, sorted).
// ---------------------------------------------------------------------------

/** The scene overview view model. */
export interface WorldSceneOverviewViewModel {
  readonly sceneId: string;
  readonly sceneName: string;
  readonly tenantId: string;
  readonly scopeLabel: string;
  readonly digestLabel: string;
  readonly entityCount: number;
  readonly focusedCount: number;
  readonly appliedOverlayCount: number;
  readonly narrativeBlockCount: number;
  readonly participantCount: number;
  readonly agentCount: number;
  readonly controlCount: number;
}

/** One scene entity row. */
export interface SceneEntityRowViewModel {
  readonly entityId: string;
  readonly label: string;
  readonly entityType: string;
  readonly positionLabel: string;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly isolated: boolean;
}

/** One overlay stack entry (application order). */
export interface OverlayStackEntryViewModel {
  readonly overlayId: string;
  readonly overlayKind: string;
  readonly orderIndex: number;
  readonly targetLabel: string;
}

/** The timeline status view model. */
export interface TimelineStatusViewModel {
  readonly trackLabel: string;
  readonly positionLabel: string;
  readonly frameLabel: string;
  readonly paused: boolean;
  readonly markerCount: number;
  readonly branchPointCount: number;
  readonly progressLabel: string;
}

/** The camera status view model. */
export interface CameraStatusViewModel {
  readonly mode: string;
  readonly detailLabel: string;
  readonly followingAgentId: string | null;
  readonly cursorLabel: string | null;
}

/** One narrative feed entry. */
export interface NarrativeFeedEntryViewModel {
  readonly blockId: string;
  readonly title: string;
  readonly tone: string;
  readonly evidenceCount: number;
  readonly hasBody: boolean;
}

/** One interaction catalog entry. */
export interface InteractionCatalogEntryViewModel {
  readonly kind: InteractionKindInput;
  readonly intentId: string;
}

/** The fidelity profile view model. */
export interface FidelityProfileViewModel {
  readonly level: FidelityLevelInput;
  readonly capabilityLines: readonly { readonly label: string; readonly value: string }[];
  readonly reductionCount: number;
}

/** One mount envelope summary. */
export interface MountSummaryViewModel {
  readonly invocationId: string;
  readonly graphKindLabel: string;
  readonly digestLabel: string;
  readonly declaredUsageLabel: string;
}

/** The advance/submit envelope summary. */
export interface EnvelopeSummaryViewModel {
  readonly invocationId: string;
  readonly kindLabel: string;
  readonly detailLabel: string;
}

/** The error notice view model. */
export interface WorldErrorNoticeViewModel {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly detailLabel: string | null;
}
