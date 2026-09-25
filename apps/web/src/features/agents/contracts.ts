/**
 * W015 web feature module — `apps/web/src/features/agents`.
 *
 * A TYPED feature library for the AI Collaboration UX (Work Order W015),
 * following the same standing convention as the marketplace feature
 * module (W023): feature contracts + typed view models + presentational
 * components, standing alone inside the app.
 *
 * Integration status (deliberate): the app manifest is frozen during this
 * Work Order, so this module does NOT import `@epoch/ai-experience` (the
 * app cannot declare the workspace dependency yet — wiring the manifest
 * and mounting routes is the shell/integration Work Order's serialized
 * change). Instead, the contracts below are STRUCTURAL PROJECTIONS of the
 * `@epoch/ai-experience` public surface, field-for-field: the package's
 * records are serialization-friendly plain JSON by construction, so they
 * satisfy these structural types at runtime without any import, and the
 * package's test battery (`packages/ai-experience/test/
 * feature-projection.test.ts`) pins the exact serialized key sets of every
 * record type consumed here — drift fails the package battery, not just
 * this module.
 *
 * The module imports NOTHING outside `apps/web` (react + relative paths
 * only); the logic files import no react at all so they run under any
 * conformant test runner.
 */

/**
 * Structural projection of `@epoch/ai-experience`'s `AgentPresenceState`
 * (the W010 collaboration presence vocabulary).
 */
export type AgentPresenceState = 'joining' | 'present' | 'idle' | 'left';

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `PeerParticipantKind` (the W011 participant-kind subset: humans and
 * agents are collaboration peers).
 */
export type PeerParticipantKind = 'agent' | 'human';

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `InteractionIntentKind` (the closed, sorted sixteen-kind vocabulary of
 * Universal-interaction subsets).
 */
export type InteractionIntentKind =
  | 'annotate'
  | 'approve'
  | 'branch'
  | 'compare'
  | 'execute'
  | 'filter'
  | 'follow-agent'
  | 'inspect'
  | 'pause'
  | 'query'
  | 'reject'
  | 'release-control'
  | 'replay'
  | 'resume'
  | 'select'
  | 'take-control';

/**
 * Structural projection of `@epoch/ai-experience`'s `PlaybackState`.
 */
export type PlaybackState = 'playing' | 'paused';

/**
 * Structural projection of `@epoch/ai-experience`'s `AiSessionState`
 * (the W010 session lifecycle vocabulary).
 */
export type AiSessionState = 'open' | 'closed';

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `ControlDenialReason`.
 */
export type ControlDenialReason =
  | 'actor-lacks-control-authority'
  | 'actor-not-controller'
  | 'claimed-authority-invalid';

/**
 * Structural projection of `@epoch/experience-protocol`'s
 * `ProjectedReference` (opaque, tenant-scoped, exact-revision references
 * to projected kernel state — the W011 vocabulary reused at runtime by
 * `@epoch/ai-experience`).
 */
export type ProjectedRef =
  | { kind: 'world-entity'; tenantId: string; entityId: string; contentDigest: string }
  | { kind: 'world-relation'; tenantId: string; relationId: string; contentDigest: string }
  | { kind: 'world-event'; tenantId: string; eventId: string; contentDigest: string }
  | { kind: 'agent'; tenantId: string; agentId: string; contentDigest: string }
  | { kind: 'evidence-record'; tenantId: string; recordDigest: string }
  | {
      kind: 'capability';
      tenantId: string;
      capabilityId: string;
      capabilityVersion: string;
      contentDigest: string;
    };

/**
 * Structural projection of `@epoch/ai-experience`'s `FocusTarget` (the
 * mirrored W010 collaboration subject grammar).
 */
export type FocusTarget =
  | { kind: 'world-entity'; entityId: string }
  | { kind: 'action-proposal'; proposal: { proposalId: string; canonicalDigest: string } };

/**
 * Structural projection of `@epoch/ai-experience`'s `ControlAuthority`
 * (the typed takeover authority).
 */
export type ControlAuthority =
  | { kind: 'session-owner' }
  | { kind: 'role-grant' }
  | { kind: 'explicit-handover'; from: string };

/**
 * Structural projection of `@epoch/ai-experience`'s `ControlProvenance`
 * (who, when, on what authority).
 */
export interface ControlProvenance {
  readonly actor: string;
  readonly occurredAt: string;
  readonly authority: ControlAuthority;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `ControlRejection`
 * (the typed denial with its claimed provenance).
 */
export interface ControlRejection {
  readonly actor: string;
  readonly occurredAt: string;
  readonly claimedAuthority: ControlAuthority;
  readonly reason: ControlDenialReason;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `TimelinePosition`
 * (a W010 event-log stream coordinate; the sequence is the inclusive
 * last-applied position, 0 = stream start).
 */
export interface TimelinePosition {
  readonly streamId: string;
  readonly sequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `BranchPoint`.
 */
export interface BranchPoint {
  readonly from: TimelinePosition;
  readonly label?: string | undefined;
  readonly sequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `ParticipantRoleDescriptor` (the human/agent role grant).
 */
export interface ParticipantRoleDescriptor {
  readonly principalId: string;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly allowedIntents: readonly InteractionIntentKind[];
  readonly assignedAt: string;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `AiSessionDescriptor`
 * (the tenant-scoped opening fact with declared peer roles).
 */
export interface AiSessionDescriptor {
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly scope?: { readonly workspaceId?: string; readonly projectId?: string } | undefined;
  readonly displayName: string;
  readonly openedBy: string;
  readonly openedAt: string;
  readonly roles: readonly ParticipantRoleDescriptor[];
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `ParticipantPresence` (the projection's presence rows).
 */
export interface ParticipantPresence {
  readonly principalId: string;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly presence: AgentPresenceState;
  readonly lastSequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `ParticipantFocus`.
 */
export interface ParticipantFocus {
  readonly principalId: string;
  readonly target: FocusTarget;
  readonly lastSequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `AgentFollow` (the
 * follow-agent edges).
 */
export interface AgentFollow {
  readonly followerPrincipalId: string;
  readonly agentId: string;
  readonly lastSequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `ViewAnnotation`.
 */
export interface ViewAnnotation {
  readonly participant: string;
  readonly target: ProjectedRef;
  readonly note: string;
  readonly sequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `CapturedMoment`.
 */
export interface CapturedMoment {
  readonly momentDigest: string;
  readonly sequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `CollaborationProjection` — the deterministic fold output the view
 * models consume.
 */
export interface CollaborationProjection {
  readonly session: AiSessionDescriptor;
  readonly state: AiSessionState;
  readonly presence: readonly ParticipantPresence[];
  readonly focus: readonly ParticipantFocus[];
  readonly controller?: string | undefined;
  readonly controlDenials: readonly ControlRejection[];
  readonly follows: readonly AgentFollow[];
  readonly playback: PlaybackState;
  readonly timelinePosition?: TimelinePosition | undefined;
  readonly branchPoints: readonly BranchPoint[];
  readonly annotations: readonly ViewAnnotation[];
  readonly moments: readonly CapturedMoment[];
  readonly view: {
    readonly selection?: ProjectedRef | undefined;
    readonly comparison?: [ProjectedRef, ProjectedRef] | undefined;
    readonly filters?: Readonly<Record<string, unknown>> | undefined;
    readonly lastQuery?: string | undefined;
  };
  readonly eventCount: number;
  readonly lastSequence: number;
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `AiCollaborationEvent` (the typed journal event in the W010
 * session-journal envelope grammar).
 */
export interface AiCollaborationEvent {
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly sequence: number;
  readonly tenantId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly kind:
    | 'presence.changed'
    | 'focus.changed'
    | 'focus.released'
    | 'control.taken'
    | 'control.released'
    | 'control.denied'
    | 'intent.emitted'
    | 'moment.captured'
    | 'session.closed';
  readonly participant?: string | undefined;
  readonly presence?: AgentPresenceState | undefined;
  readonly target?: FocusTarget | undefined;
  readonly provenance?: ControlProvenance | undefined;
  readonly supersededController?: string | undefined;
  readonly rejection?: ControlRejection | undefined;
  readonly intent?: InteractionIntent | undefined;
  readonly momentDigest?: string | undefined;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `InteractionIntent`
 * (the sixteen versioned members).
 */
export type InteractionIntent =
  | { kind: 'annotate'; intentVersion: number; target: ProjectedRef; note: string; data?: Readonly<Record<string, unknown>> }
  | { kind: 'approve'; intentVersion: number; target: { proposalId: string; canonicalDigest: string } }
  | { kind: 'branch'; intentVersion: number; from: TimelinePosition; label?: string }
  | { kind: 'compare'; intentVersion: number; targets: [ProjectedRef, ProjectedRef] }
  | { kind: 'execute'; intentVersion: number; target: { proposalId: string; canonicalDigest: string } }
  | { kind: 'filter'; intentVersion: number; criteria: Readonly<Record<string, unknown>> }
  | { kind: 'follow-agent'; intentVersion: number; agentId: string }
  | { kind: 'inspect'; intentVersion: number; target: ProjectedRef }
  | { kind: 'pause'; intentVersion: number }
  | { kind: 'query'; intentVersion: number; text: string }
  | { kind: 'replay'; intentVersion: number; position: TimelinePosition }
  | { kind: 'reject'; intentVersion: number; target: { proposalId: string; canonicalDigest: string } }
  | { kind: 'release-control'; intentVersion: number }
  | { kind: 'resume'; intentVersion: number }
  | { kind: 'select'; intentVersion: number; target: ProjectedRef }
  | { kind: 'take-control'; intentVersion: number; authority: ControlAuthority };

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `ExperienceGraphReference` (the moment's visual state).
 */
export interface ExperienceGraphReference {
  readonly graphKind: string;
  readonly graphDigest: string;
}

/**
 * Structural projection of `@epoch/ai-experience`'s `ScenarioReference`.
 */
export interface ScenarioReference {
  readonly scenarioId: string;
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `MomentParticipantState`.
 */
export interface MomentParticipantState {
  readonly principalId: string;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly presence: AgentPresenceState;
  readonly focus?: FocusTarget | undefined;
  readonly holdsControl: boolean;
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `EngineeringMomentContent` (the shareable/replayable unit's content).
 */
export interface EngineeringMomentContent {
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly capturedBy: string;
  readonly capturedAt: string;
  readonly label?: string | undefined;
  readonly worldSnapshot: readonly ProjectedRef[];
  readonly agentState: readonly MomentParticipantState[];
  readonly humanState: readonly MomentParticipantState[];
  readonly visualState: ExperienceGraphReference;
  readonly timelinePosition: TimelinePosition;
  readonly evidence: readonly { kind: 'evidence-record'; tenantId: string; recordDigest: string }[];
  readonly scenario: ScenarioReference;
  readonly availableActions: readonly InteractionIntentKind[];
}

/**
 * Structural projection of `@epoch/ai-experience`'s
 * `EngineeringMomentRecord` (content plus its content address).
 */
export interface EngineeringMomentRecord {
  readonly moment: EngineeringMomentContent;
  readonly momentDigest: string;
}
