/**
 * Runtime type guards for the feature contracts — hand-written,
 * deterministic, dependency-free (zod is not an app dependency; the app
 * manifest is frozen during W015). The guards validate the STRUCTURAL
 * projection of `@epoch/ai-experience` records at JSON boundaries (the
 * shell hands the feature module plain JSON; nothing is trusted blindly).
 */
import type {
  AgentPresenceState,
  AiCollaborationEvent,
  CollaborationProjection,
  EngineeringMomentRecord,
  InteractionIntentKind,
  PeerParticipantKind,
} from './contracts';

const PRESENCE_STATES: readonly string[] = ['joining', 'present', 'idle', 'left'];
const PEER_KINDS: readonly string[] = ['agent', 'human'];
const INTENT_KINDS: readonly string[] = [
  'annotate',
  'approve',
  'branch',
  'compare',
  'execute',
  'filter',
  'follow-agent',
  'inspect',
  'pause',
  'query',
  'reject',
  'release-control',
  'replay',
  'resume',
  'select',
  'take-control',
];
const EVENT_KINDS: readonly string[] = [
  'presence.changed',
  'focus.changed',
  'focus.released',
  'control.taken',
  'control.released',
  'control.denied',
  'intent.emitted',
  'moment.captured',
  'session.closed',
];
const PRINCIPAL_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;
const SESSION_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;
const TENANT_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Guard: `AgentPresenceState`. */
export function isAgentPresenceState(value: unknown): value is AgentPresenceState {
  return isString(value) && PRESENCE_STATES.includes(value);
}

/** Guard: `PeerParticipantKind`. */
export function isPeerParticipantKind(value: unknown): value is PeerParticipantKind {
  return isString(value) && PEER_KINDS.includes(value);
}

/** Guard: `InteractionIntentKind`. */
export function isInteractionIntentKind(value: unknown): value is InteractionIntentKind {
  return isString(value) && INTENT_KINDS.includes(value);
}

/** Guard: a principal id (`principal:<slug>`). */
export function isPrincipalId(value: unknown): value is string {
  return isString(value) && PRINCIPAL_PATTERN.test(value);
}

/** Guard: a session id (`session:<slug>`). */
export function isSessionId(value: unknown): value is string {
  return isString(value) && SESSION_PATTERN.test(value);
}

/** Guard: a tenant id (`tenant:<slug>`). */
export function isTenantId(value: unknown): value is string {
  return isString(value) && TENANT_PATTERN.test(value);
}

/** Guard: a lowercase 64-hex SHA-256 digest. */
export function isSha256Digest(value: unknown): value is string {
  return isString(value) && DIGEST_PATTERN.test(value);
}

/** Guard: a timeline position. */
export function isTimelinePosition(value: unknown): value is {
  streamId: string;
  sequence: number;
} {
  return (
    isRecord(value) &&
    isString(value.streamId) &&
    isNumber(value.sequence) &&
    value.sequence >= 0 &&
    Number.isInteger(value.sequence)
  );
}

/** Guard: a participant role descriptor. */
export function isParticipantRoleDescriptor(value: unknown): value is {
  principalId: string;
  participantKind: PeerParticipantKind;
  agentId?: string;
  allowedIntents: readonly InteractionIntentKind[];
  assignedAt: string;
} {
  return (
    isRecord(value) &&
    isPrincipalId(value.principalId) &&
    isPeerParticipantKind(value.participantKind) &&
    (value.agentId === undefined || isString(value.agentId)) &&
    Array.isArray(value.allowedIntents) &&
    value.allowedIntents.every((kind) => isInteractionIntentKind(kind)) &&
    isString(value.assignedAt)
  );
}

/** Guard: a session descriptor (the opening fact). */
export function isAiSessionDescriptor(value: unknown): value is {
  schemaVersion: number;
  sessionId: string;
  tenantId: string;
  displayName: string;
  openedBy: string;
  openedAt: string;
  roles: readonly unknown[];
} {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isSessionId(value.sessionId) &&
    isTenantId(value.tenantId) &&
    isString(value.displayName) &&
    isPrincipalId(value.openedBy) &&
    isString(value.openedAt) &&
    Array.isArray(value.roles) &&
    value.roles.length > 0 &&
    value.roles.every((role) => isParticipantRoleDescriptor(role))
  );
}

/** Guard: a typed AI-collaboration journal event. */
export function isAiCollaborationEvent(value: unknown): value is AiCollaborationEvent {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isSessionId(value.sessionId) || !isTenantId(value.tenantId)) return false;
  if (!isPrincipalId(value.actor) || !isString(value.occurredAt)) return false;
  if (!isNumber(value.sequence) || !Number.isInteger(value.sequence) || value.sequence < 1) {
    return false;
  }
  if (!isString(value.kind) || !EVENT_KINDS.includes(value.kind)) return false;
  if (value.participant !== undefined && !isPrincipalId(value.participant)) return false;
  if (value.presence !== undefined && !isAgentPresenceState(value.presence)) return false;
  if (value.momentDigest !== undefined && !isSha256Digest(value.momentDigest)) return false;
  return true;
}

/** Guard: the collaboration projection (the fold output). */
export function isCollaborationProjection(value: unknown): value is CollaborationProjection {
  if (!isRecord(value)) return false;
  if (!isAiSessionDescriptor(value.session)) return false;
  if (value.state !== 'open' && value.state !== 'closed') return false;
  if (!Array.isArray(value.presence)) return false;
  for (const entry of value.presence) {
    if (
      !isRecord(entry) ||
      !isPrincipalId(entry.principalId) ||
      !isPeerParticipantKind(entry.participantKind) ||
      !isAgentPresenceState(entry.presence)
    ) {
      return false;
    }
  }
  if (value.controller !== undefined && !isPrincipalId(value.controller)) return false;
  if (value.playback !== 'playing' && value.playback !== 'paused') return false;
  if (value.timelinePosition !== undefined && !isTimelinePosition(value.timelinePosition)) {
    return false;
  }
  return isNumber(value.eventCount) && isNumber(value.lastSequence);
}

/** Guard: an Engineering Moment record (content plus its digest). */
export function isEngineeringMomentRecord(value: unknown): value is EngineeringMomentRecord {
  if (!isRecord(value)) return false;
  if (!isSha256Digest(value.momentDigest)) return false;
  const moment = value.moment;
  if (!isRecord(moment)) return false;
  if (moment.schemaVersion !== 1) return false;
  if (!isSessionId(moment.sessionId) || !isTenantId(moment.tenantId)) return false;
  if (!isPrincipalId(moment.capturedBy) || !isString(moment.capturedAt)) return false;
  if (!isTimelinePosition(moment.timelinePosition)) return false;
  if (!Array.isArray(moment.worldSnapshot) || moment.worldSnapshot.length === 0) return false;
  if (!Array.isArray(moment.evidence) || moment.evidence.length === 0) return false;
  if (!Array.isArray(moment.availableActions) || moment.availableActions.length === 0) {
    return false;
  }
  if (!moment.availableActions.every((kind) => isInteractionIntentKind(kind))) return false;
  if (!isRecord(moment.visualState) || !isSha256Digest(moment.visualState.graphDigest)) {
    return false;
  }
  if (!isRecord(moment.scenario) || !isString(moment.scenario.scenarioId)) return false;
  return true;
}
