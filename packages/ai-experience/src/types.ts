/**
 * @epoch/ai-experience — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Authority model (architecture lock rules 1/3/8/12/16 + the W015 pins):
 * these are the AI-COLLABORATION SEMANTICS as typed data over the
 * event-sourced W010 substrate — collaboration sessions, presence, focus,
 * takeover/release transitions and replay/branch references are TYPED
 * EVENTS/RECORDS in the W010 event shapes (session-journal envelopes in
 * the exact @epoch/collaboration `CollaborationEvent` grammar, mirrored +
 * parity-pinned; event-log records in the open `ai` payload namespace,
 * runtime reuse). The package never reimplements event storage, never
 * mutates kernel state, never makes authorization decisions, and never
 * becomes a second authority: the World Model owns semantics, the Action
 * Gateway owns execution, and the event log owns change history.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { EventSequence, EventStreamId } from '@epoch/event-log';
import type {
  DeviceDescriptor,
  ExperienceGraphKind,
  ExperienceNode,
  ProjectedEvidenceRef,
  ProjectedReference,
} from '@epoch/experience-protocol';
import type {
  AgentPresenceState,
  AiSessionState,
  ControlDenialReason,
  InteractionIntentKind,
  PeerParticipantKind,
} from './version';
import type { AI_EXPERIENCE_RECORD_VERSION } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface AiExperienceIssue {
  readonly path: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Opaque identity aliases (W010 style: plain string aliases, pinned to the
// mirrored upstream grammars by the zod validators + parity tests).
// ---------------------------------------------------------------------------

/** Opaque collaboration session identity (`session:<slug>`, W010 grammar). */
export type AiSessionId = string;

/** Tenant scope of an AI-collaboration record (`tenant:<slug>`, W009 grammar). */
export type AiTenantId = string;

/** Opaque participant principal id (`principal:<slug>`, W009 grammar). */
export type AiPrincipalId = string;

/**
 * The typed AI-experience error taxonomy (W015 Tech Lead pin). Every
 * entry point is total — errors are values, never exceptions. See
 * `AI_EXPERIENCE_ERROR_CODES` in src/version.ts for the code inventory.
 */
export type AiExperienceError =
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly AiExperienceIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'unknown-session-reference';
      readonly message: string;
      readonly sessionId: string;
      readonly expectedSessionId?: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly sessionId?: string;
    }
  | {
      readonly code: 'takeover-denied';
      readonly message: string;
      readonly reason: ControlDenialReason;
      readonly actor: AiPrincipalId;
      readonly sessionId: AiSessionId;
    }
  | {
      readonly code: 'invalid-intent';
      readonly message: string;
      readonly issues: readonly AiExperienceIssue[];
    }
  | {
      readonly code: 'executable-ui-rejected';
      readonly message: string;
      readonly path: string;
      readonly key: string;
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly path: string;
      readonly key: string;
    }
  | {
      readonly code: 'unknown-evidence-reference';
      readonly message: string;
      readonly recordDigest: Sha256Hex;
    }
  | {
      readonly code: 'replay-position-invalid';
      readonly message: string;
      readonly streamId: string;
      readonly sequence: number;
    };

/** Total-result wrapper of every AI-experience entry point. */
export type AiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AiExperienceError };

/** See {@link ActionProposalTarget}. */
// (The interface is declared below with the focus vocabulary.)

// ---------------------------------------------------------------------------
// Human/agent role descriptors.
// ---------------------------------------------------------------------------

/**
 * One granted interaction-intent subset — the typed powers a participant
 * holds in a session (sorted ascending, duplicate-free). Takeover/release
 * admission checks these grants; everything else (approvals, execution)
 * remains the Action Gateway's authority — intents are UX-level requests.
 */
export type IntentGrant = readonly InteractionIntentKind[];

/**
 * A human/agent ROLE DESCRIPTOR: the participant (opaque principal id),
 * its peer kind (W011 vocabulary subset: humans and agents are PEERS),
 * the registered agent identity for agent peers (W003 grammar — the
 * follow-agent/camera vocabulary), and the granted interaction intents.
 * Assignment instants are PRODUCER-SUPPLIED (this package never reads a
 * clock).
 */
export interface ParticipantRoleDescriptor {
  readonly principalId: AiPrincipalId;
  readonly participantKind: PeerParticipantKind;
  /** Required for agent peers; forbidden for human peers. */
  readonly agentId?: string | undefined;
  readonly allowedIntents: IntentGrant;
  readonly assignedAt: string;
}

/** Optional tenant-hierarchy narrowing of a session (W009/W010 grammars). */
export interface AiSessionScope {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

// ---------------------------------------------------------------------------
// The collaboration-session descriptor.
// ---------------------------------------------------------------------------

/**
 * The typed, tenant-scoped AI-collaboration session descriptor: the
 * session's OPENING FACT (who opened it, when, under which tenant, with
 * which declared peer roles). Every subsequent collaboration semantic —
 * presence, focus, takeover/release, intents, moments, close — is an
 * EVENT over the W010 substrate, never a mutation of this record.
 * The opening principal must hold a declared role.
 */
export interface AiSessionDescriptor {
  readonly schemaVersion: typeof AI_EXPERIENCE_RECORD_VERSION;
  readonly sessionId: AiSessionId;
  readonly tenantId: AiTenantId;
  readonly scope?: AiSessionScope | undefined;
  readonly displayName: string;
  readonly openedBy: AiPrincipalId;
  readonly openedAt: string;
  readonly roles: readonly ParticipantRoleDescriptor[];
}

// ---------------------------------------------------------------------------
// Control authority, provenance, and denial.
// ---------------------------------------------------------------------------

/**
 * The authority a take-control claims (discriminated on `kind`):
 * `session-owner` (the opening principal), `role-grant` (the actor's
 * declared role), or `explicit-handover` (the current controller names
 * the principal it hands control to).
 */
export type ControlAuthority =
  | { readonly kind: 'session-owner' }
  | { readonly kind: 'role-grant' }
  | { readonly kind: 'explicit-handover'; readonly from: AiPrincipalId };

/**
 * The provenance of a control transition — WHO acted, WHEN (producer-
 * supplied), ON WHAT AUTHORITY. Every accepted takeover/release carries
 * one; unauthorized attempts carry the same provenance inside the typed
 * {@link ControlRejection}.
 */
export interface ControlProvenance {
  readonly actor: AiPrincipalId;
  readonly occurredAt: string;
  readonly authority: ControlAuthority;
}

/**
 * The typed rejection of an unauthorized control transition: the full
 * claimed provenance plus the typed denial reason. Recorded as a
 * `control.denied` event (the denial is itself history — provenance is
 * never lost).
 */
export interface ControlRejection {
  readonly actor: AiPrincipalId;
  readonly occurredAt: string;
  readonly claimedAuthority: ControlAuthority;
  readonly reason: ControlDenialReason;
}

// ---------------------------------------------------------------------------
// Focus.
// ---------------------------------------------------------------------------

/**
 * The exact-revision action-proposal reference — the @epoch/action-protocol
 * (W003) `ProposalReference` shape, mirrored and parity-pinned through
 * @epoch/collaboration's `CollaborationSubject` (devDependency tests; the
 * member grammars are agent-protocol runtime reuses).
 */
export interface ActionProposalTarget {
  readonly proposalId: string;
  readonly canonicalDigest: Sha256Hex;
}

/**
 * What a participant is focusing on — an opaque reference into the shared
 * model in the exact W010 collaboration subject grammar (a world entity
 * by id, or an action proposal at an exact revision), mirrored and
 * parity-pinned. References only: focus never embeds or mutates them.
 */
export type FocusTarget =
  | { readonly kind: 'world-entity'; readonly entityId: string }
  | { readonly kind: 'action-proposal'; readonly proposal: ActionProposalTarget };

// ---------------------------------------------------------------------------
// The interaction-intent vocabulary (typed subsets of the Universal
// interactions; each member a versioned discriminated-union member).
// ---------------------------------------------------------------------------

/** `select` — focus the shared view on one projected kernel reference. */
export interface SelectIntent {
  readonly kind: 'select';
  readonly intentVersion: 1;
  readonly target: ProjectedReference;
}

/** `inspect` — request the inspector projection for one reference. */
export interface InspectIntent {
  readonly kind: 'inspect';
  readonly intentVersion: 1;
  readonly target: ProjectedReference;
}

/** `follow-agent` — follow an agent's camera/cursor (agent gameplay). */
export interface FollowAgentIntent {
  readonly kind: 'follow-agent';
  readonly intentVersion: 1;
  readonly agentId: string;
}

/** `take-control` — claim session control on an explicit authority. */
export interface TakeControlIntent {
  readonly kind: 'take-control';
  readonly intentVersion: 1;
  readonly authority: ControlAuthority;
}

/** `release-control` — relinquish session control. */
export interface ReleaseControlIntent {
  readonly kind: 'release-control';
  readonly intentVersion: 1;
}

/** `pause` — pause the session playback. */
export interface PauseIntent {
  readonly kind: 'pause';
  readonly intentVersion: 1;
}

/** `resume` — resume the session playback. */
export interface ResumeIntent {
  readonly kind: 'resume';
  readonly intentVersion: 1;
}

/**
 * `replay` — move the session timeline to a position. The position is a
 * W010 event-log stream coordinate (streamId + sequence); admission
 * validates it against the known stream bounds (`replay-position-invalid`).
 */
export interface ReplayIntent {
  readonly kind: 'replay';
  readonly intentVersion: 1;
  readonly position: TimelinePosition;
}

/** `branch` — branch the timeline from a recorded position. */
export interface BranchIntent {
  readonly kind: 'branch';
  readonly intentVersion: 1;
  readonly from: TimelinePosition;
  readonly label?: string | undefined;
}

/** `approve` — signal approval of an action proposal at an exact revision. */
export interface ApproveIntent {
  readonly kind: 'approve';
  readonly intentVersion: 1;
  readonly target: ActionProposalTarget;
}

/** `reject` — signal rejection of an action proposal at an exact revision. */
export interface RejectIntent {
  readonly kind: 'reject';
  readonly intentVersion: 1;
  readonly target: ActionProposalTarget;
}

/** `execute` — request execution of an action proposal (the Action Gateway decides). */
export interface ExecuteIntent {
  readonly kind: 'execute';
  readonly intentVersion: 1;
  readonly target: ActionProposalTarget;
}

/**
 * `annotate` — attach a note (plus optional open data, scanned against the
 * vendor/executable blocklists) to a projected kernel reference.
 */
export interface AnnotateIntent {
  readonly kind: 'annotate';
  readonly intentVersion: 1;
  readonly target: ProjectedReference;
  readonly note: string;
  readonly data?: Readonly<Record<string, JsonValue>> | undefined;
}

/** `compare` — place exactly two projected references side by side (sorted). */
export interface CompareIntent {
  readonly kind: 'compare';
  readonly intentVersion: 1;
  readonly targets: [ProjectedReference, ProjectedReference];
}

/** `filter` — apply open, typed-data filter criteria to the view. */
export interface FilterIntent {
  readonly kind: 'filter';
  readonly intentVersion: 1;
  readonly criteria: Readonly<Record<string, JsonValue>>;
}

/** `query` — pose a query as plain text (never an executable expression). */
export interface QueryIntent {
  readonly kind: 'query';
  readonly intentVersion: 1;
  readonly text: string;
}

/**
 * The typed interaction-intent union — sixteen versioned members, one per
 * admitted Universal-interaction subset. Agents emit these TYPED intents,
 * never arbitrary executable UI code (the Dynamic UI law).
 */
export type InteractionIntent =
  | AnnotateIntent
  | ApproveIntent
  | BranchIntent
  | CompareIntent
  | ExecuteIntent
  | FilterIntent
  | FollowAgentIntent
  | InspectIntent
  | PauseIntent
  | QueryIntent
  | ReplayIntent
  | RejectIntent
  | ReleaseControlIntent
  | ResumeIntent
  | SelectIntent
  | TakeControlIntent;

// ---------------------------------------------------------------------------
// Timeline positions (the W010 replay/cursor grammar, runtime reuse).
// ---------------------------------------------------------------------------

/**
 * One timeline/replay position: a W010 event-log stream coordinate. The
 * sequence is INCLUSIVE — the last event the position reflects (sequence
 * 0 denotes the stream start). Structurally identical to @epoch/replay's
 * `ReplayCursor` field grammar (parity-pinned by devDependency tests;
 * replay's own cursor semantics are exclusive-lower-bound, documented).
 */
export interface TimelinePosition {
  readonly streamId: EventStreamId;
  readonly sequence: EventSequence;
}

/** One bound of a known stream: the stream id and its last applied sequence. */
export interface StreamBound {
  readonly streamId: EventStreamId;
  readonly lastSequence: EventSequence;
}

/** One recorded branch point (from a `branch` intent). */
export interface BranchPoint {
  readonly from: TimelinePosition;
  readonly label?: string | undefined;
  readonly sequence: number;
}

// ---------------------------------------------------------------------------
// The typed AI-collaboration event (session-journal shape).
// ---------------------------------------------------------------------------

/**
 * The immutable content of one typed AI-collaboration event — the exact
 * W010 `CollaborationEvent` envelope grammar (schemaVersion, sessionId,
 * per-session journal sequence, tenant scope, acting principal,
 * occurrence instant — PRODUCER-SUPPLIED) with the AI-collaboration kind
 * vocabulary in place of the coordination kinds. Per-kind members are
 * carried only by their kinds (member consistency is enforced at
 * admission). Facts, never mutations:
 *
 * - `presence.changed` — `participant` + `presence` (membership-sourced
 *   joins/leaves and presence heartbeats alike);
 * - `focus.changed` / `focus.released` — `participant` (+ `target`);
 * - `control.taken` — `provenance` (+ `supersededController`, the
 *   controller superseded by a preempting takeover, if any);
 * - `control.released` — `provenance`;
 * - `control.denied` — `rejection` (the typed denial WITH provenance —
 *   unauthorized takeovers are history, never silent);
 * - `intent.emitted` — `intent` (the full typed intent payload);
 * - `moment.captured` — `momentDigest` (the Engineering Moment's content
 *   address — references only, moments are never embedded);
 * - `session.closed` — the terminal lifecycle fact (no members).
 */
export interface AiCollaborationEvent {
  readonly schemaVersion: typeof AI_EXPERIENCE_RECORD_VERSION;
  readonly sessionId: AiSessionId;
  readonly sequence: number;
  readonly tenantId: AiTenantId;
  readonly actor: AiPrincipalId;
  readonly occurredAt: string;
  readonly kind: AiCollaborationEventKindValue;
  /** presence.changed only. */
  readonly participant?: AiPrincipalId | undefined;
  /** presence.changed only. */
  readonly presence?: AgentPresenceState | undefined;
  /** focus.changed only. */
  readonly target?: FocusTarget | undefined;
  /** control.taken / control.released only. */
  readonly provenance?: ControlProvenance | undefined;
  /** control.taken only (the superseded controller of a preempting takeover). */
  readonly supersededController?: AiPrincipalId | undefined;
  /** control.denied only. */
  readonly rejection?: ControlRejection | undefined;
  /** intent.emitted only. */
  readonly intent?: InteractionIntent | undefined;
  /** moment.captured only. */
  readonly momentDigest?: Sha256Hex | undefined;
}

/** The closed kind vocabulary of {@link AiCollaborationEvent}. */
export type AiCollaborationEventKindValue =
  | 'presence.changed'
  | 'focus.changed'
  | 'focus.released'
  | 'control.taken'
  | 'control.released'
  | 'control.denied'
  | 'intent.emitted'
  | 'moment.captured'
  | 'session.closed';

/** The published event record: content plus its content address. */
export interface AiCollaborationEventRecord {
  readonly event: AiCollaborationEvent;
  readonly contentDigest: Sha256Hex;
}

/** A creation envelope (content + the digest CLAIMED for it). */
export interface AiCollaborationEventRegistration {
  readonly event: AiCollaborationEvent;
  readonly digest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The deterministic collaboration projection (pure fold output).
// ---------------------------------------------------------------------------

/** One participant's presence projection. */
export interface ParticipantPresence {
  readonly principalId: AiPrincipalId;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly presence: AgentPresenceState;
  readonly lastSequence: number;
}

/** One participant's focus projection. */
export interface ParticipantFocus {
  readonly principalId: AiPrincipalId;
  readonly target: FocusTarget;
  readonly lastSequence: number;
}

/** One follow edge: which participant follows which registered agent. */
export interface AgentFollow {
  readonly followerPrincipalId: AiPrincipalId;
  readonly agentId: string;
  readonly lastSequence: number;
}

/** One annotation on the shared view (from `annotate` intents). */
export interface ViewAnnotation {
  readonly participant: AiPrincipalId;
  readonly target: ProjectedReference;
  readonly note: string;
  readonly sequence: number;
}

/** The playback state of the session (pause/resume intents). */
export type PlaybackState = 'playing' | 'paused';

/** One captured Engineering Moment reference in the projection. */
export interface CapturedMoment {
  readonly momentDigest: Sha256Hex;
  readonly sequence: number;
}

/**
 * The deterministic projection of one collaboration session — the pure
 * fold of its typed events. Every array is SORTED (no insertion-order
 * leaks); two event sets that differ only in input order project
 * byte-identically. The view block carries the last-acted view intents
 * (select/compare/filter/query) — presentation state, never semantic
 * state (lock rule 8).
 */
export interface CollaborationProjection {
  readonly session: AiSessionDescriptor;
  readonly state: AiSessionState;
  readonly presence: readonly ParticipantPresence[];
  readonly focus: readonly ParticipantFocus[];
  readonly controller?: AiPrincipalId | undefined;
  readonly controlDenials: readonly ControlRejection[];
  readonly follows: readonly AgentFollow[];
  readonly playback: PlaybackState;
  /** The current timeline position, once a replay intent (or an initial position) sets one. */
  readonly timelinePosition?: TimelinePosition | undefined;
  readonly branchPoints: readonly BranchPoint[];
  readonly annotations: readonly ViewAnnotation[];
  readonly moments: readonly CapturedMoment[];
  readonly view: {
    readonly selection?: ProjectedReference | undefined;
    readonly comparison?: [ProjectedReference, ProjectedReference] | undefined;
    readonly filters?: Readonly<Record<string, JsonValue>> | undefined;
    readonly lastQuery?: string | undefined;
  };
  readonly eventCount: number;
  readonly lastSequence: number;
}

// ---------------------------------------------------------------------------
// Engineering Moments (shareable/replayable first-class records).
// ---------------------------------------------------------------------------

/** Reference to the W011 Experience Graph that is the moment's visual state. */
export interface ExperienceGraphReference {
  readonly graphKind: ExperienceGraphKind;
  readonly graphDigest: Sha256Hex;
}

/** Opaque scenario reference (the world scenario the moment belongs to). */
export interface ScenarioReference {
  readonly scenarioId: string;
}

/** One participant's state captured in an Engineering Moment. */
export interface MomentParticipantState {
  readonly principalId: AiPrincipalId;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly presence: AgentPresenceState;
  readonly focus?: FocusTarget | undefined;
  readonly holdsControl: boolean;
}

/**
 * The content of an Engineering Moment — the shareable/replayable
 * collaboration unit (spec/experience-architecture.md, binding): world
 * snapshot + agent state + human state + visual state + timeline
 * position + evidence + scenario + available actions. A RECORD TYPE, not
 * a runtime feature: producing one never mutates engine state. Every
 * reference is opaque and tenant-scoped; the record is content-addressed
 * (SHA-256 over canonical JSON) so the digest IS the shareable identity.
 */
export interface EngineeringMomentContent {
  readonly schemaVersion: typeof AI_EXPERIENCE_RECORD_VERSION;
  readonly sessionId: AiSessionId;
  readonly tenantId: AiTenantId;
  readonly capturedBy: AiPrincipalId;
  readonly capturedAt: string;
  readonly label?: string | undefined;
  readonly worldSnapshot: readonly ProjectedReference[];
  readonly agentState: readonly MomentParticipantState[];
  readonly humanState: readonly MomentParticipantState[];
  readonly visualState: ExperienceGraphReference;
  readonly timelinePosition: TimelinePosition;
  readonly evidence: readonly ProjectedEvidenceRef[];
  readonly scenario: ScenarioReference;
  readonly availableActions: IntentGrant;
}

/** The sealed Engineering Moment record: content plus its content address. */
export interface EngineeringMomentRecord {
  readonly moment: EngineeringMomentContent;
  readonly momentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// W010 substrate adapters (input shapes).
// ---------------------------------------------------------------------------

/**
 * The mirrored W010 `CollaborationEventRecord` shape (the exact
 * @epoch/collaboration grammar — session journal envelope with the W010
 * coordination kind vocabulary — mirrored and parity-pinned via
 * devDependency tests; NEVER a runtime import).
 */
export interface MirroredCollaborationEventRecord {
  readonly event: {
    readonly schemaVersion: 1;
    readonly sessionId: string;
    readonly sequence: number;
    readonly tenantId: string;
    readonly actor: string;
    readonly kind:
      | 'participant.joined'
      | 'participant.left'
      | 'participant.presence'
      | 'subject.focused'
      | 'subject.released'
      | 'coordination.note'
      | 'session.closed';
    readonly participant?: string | undefined;
    readonly presence?: AgentPresenceState | undefined;
    readonly subject?: FocusTarget | undefined;
    readonly data?: Readonly<Record<string, JsonValue>> | undefined;
    readonly occurredAt: string;
  };
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// W011 presence-graph emission (view-model inputs).
// ---------------------------------------------------------------------------

/** One presence seat to project (participant + optional cursor). */
export interface PresenceSeatInput {
  readonly principalId: AiPrincipalId;
  readonly participantKind: PeerParticipantKind;
  readonly agentId?: string | undefined;
  readonly presence: AgentPresenceState;
  /** Optional projected kernel reference the seat anchors to. */
  readonly ref?: ProjectedReference | undefined;
}

/** One presence cursor to project (2D or 3D position). */
export interface PresenceCursorInput {
  readonly principalId: AiPrincipalId;
  readonly participantKind: PeerParticipantKind;
  readonly position2d?: readonly [number, number] | undefined;
  readonly position3d?: readonly [number, number, number] | undefined;
  readonly atMs?: number | undefined;
}

/** The assembled W011 presence projection (content + emitted nodes). */
export interface PresenceGraphProjection {
  readonly nodes: readonly ExperienceNode[];
  readonly device: DeviceDescriptor;
}
