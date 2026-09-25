/**
 * Typed view models — the pure presentation projection of the AI
 * collaboration semantics. Deterministic by construction: sorted rows,
 * derived labels, no clock reads, no randomness, no environment access.
 * These builders are the feature module's entire logic surface; the
 * components below render them.
 */
import type {
  AiCollaborationEvent,
  AiSessionDescriptor,
  CollaborationProjection,
  ControlRejection,
  EngineeringMomentRecord,
  FocusTarget,
  InteractionIntent,
  ProjectedRef,
} from './contracts';

/** The maximum intent-feed rows the panel renders (bounded display). */
export const INTENT_FEED_LIMIT = 50;

/** Derive a human-readable label from an opaque principal id. */
export function principalLabel(principalId: string): string {
  const separator = principalId.indexOf(':');
  return separator >= 0 ? principalId.slice(separator + 1) : principalId;
}

/** Derive a short display digest (first 12 hex characters) with an ellipsis marker. */
export function shortDigest(digest: string): string {
  return `${digest.slice(0, 12)}…`;
}

/** Derive a target label from an opaque focus target. */
export function focusTargetLabel(target: FocusTarget): string {
  if (target.kind === 'world-entity') {
    return `world entity ${target.entityId}`;
  }
  return `proposal ${target.proposal.proposalId}`;
}

/** Derive a target label from an opaque projected reference. */
export function projectedRefLabel(ref: ProjectedRef): string {
  switch (ref.kind) {
    case 'world-entity':
      return `world entity ${ref.entityId}`;
    case 'world-relation':
      return `world relation ${shortDigest(ref.relationId.slice(4))}`;
    case 'world-event':
      return `world event ${ref.eventId}`;
    case 'agent':
      return `agent ${ref.agentId}`;
    case 'evidence-record':
      return `evidence ${shortDigest(ref.recordDigest)}`;
    case 'capability':
      return `capability ${ref.capabilityId}@${ref.capabilityVersion}`;
  }
}

/** Derive a control-authority label. */
export function authorityLabel(authority: {
  kind: string;
  from?: string;
}): string {
  switch (authority.kind) {
    case 'session-owner':
      return 'session owner';
    case 'role-grant':
      return 'role grant';
    case 'explicit-handover':
      return `handover from ${principalLabel(authority.from ?? '?')}`;
    default:
      return authority.kind;
  }
}

/** One presence roster row (sorted by principalId — the projection's order). */
export interface PresenceRow {
  readonly key: string;
  readonly principalId: string;
  readonly label: string;
  readonly participantKind: string;
  readonly agentId?: string;
  readonly presence: string;
  readonly holdsControl: boolean;
  readonly focusLabel?: string;
  readonly followsAgentId?: string;
}

/** One control-denial row (typed rejection with provenance, latest first). */
export interface DenialRow {
  readonly key: string;
  readonly actorLabel: string;
  readonly reason: string;
  readonly claimedAuthorityLabel: string;
  readonly occurredAt: string;
}

/** One timeline branch row. */
export interface BranchRow {
  readonly key: string;
  readonly label: string;
  readonly positionLabel: string;
}

/** One intent-feed row (latest first, bounded). */
export interface FeedRow {
  readonly key: string;
  readonly sequence: number;
  readonly actorLabel: string;
  readonly summary: string;
  readonly occurredAt: string;
}

/** One Engineering Moment summary card. */
export interface MomentCard {
  readonly key: string;
  readonly digest: string;
  readonly shortDigest: string;
  readonly label: string;
  readonly capturedByLabel: string;
  readonly capturedAt: string;
  readonly agentCount: number;
  readonly humanCount: number;
  readonly evidenceCount: number;
  readonly snapshotCount: number;
  readonly availableActions: readonly string[];
  readonly positionLabel: string;
}

/** The aggregate view model rendered by the feature's root panel. */
export interface AgentCollaborationViewModel {
  readonly sessionKey: string;
  readonly title: string;
  readonly tenantId: string;
  readonly scopeLabel: string;
  readonly stateLabel: string;
  readonly openedByLabel: string;
  readonly openedAt: string;
  readonly eventCount: number;
  readonly lastSequence: number;
  readonly roster: readonly PresenceRow[];
  readonly controllerLabel: string | null;
  readonly hasControl: boolean;
  readonly denials: readonly DenialRow[];
  readonly playback: string;
  readonly positionLabel: string;
  readonly branches: readonly BranchRow[];
  readonly feed: readonly FeedRow[];
  readonly moments: readonly MomentCard[];
}

/** Build the presence roster rows from the projection. */
export function buildPresenceRoster(projection: CollaborationProjection): readonly PresenceRow[] {
  const follows = new Map(
    projection.follows.map((follow) => [follow.followerPrincipalId, follow.agentId]),
  );
  return projection.presence
    .filter((entry) => entry.presence !== 'left')
    .map((entry) => {
      const focus = projection.focus.find((f) => f.principalId === entry.principalId);
      return {
        key: entry.principalId,
        principalId: entry.principalId,
        label: principalLabel(entry.principalId),
        participantKind: entry.participantKind,
        agentId: entry.agentId,
        presence: entry.presence,
        holdsControl: projection.controller === entry.principalId,
        focusLabel: focus !== undefined ? focusTargetLabel(focus.target) : undefined,
        followsAgentId: follows.get(entry.principalId),
      };
    })
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/** Build the control-denial rows (latest first). */
export function buildDenialRows(denials: readonly ControlRejection[]): readonly DenialRow[] {
  return [...denials]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0))
    .map((denial, index) => ({
      key: `${denial.actor}#${denial.occurredAt}#${index}`,
      actorLabel: principalLabel(denial.actor),
      reason: denial.reason,
      claimedAuthorityLabel: authorityLabel(denial.claimedAuthority),
      occurredAt: denial.occurredAt,
    }))
    .reverse();
}

/** Build the timeline branch rows. */
export function buildBranchRows(
  branches: readonly { from: { streamId: string; sequence: number }; label?: string; sequence: number }[],
): readonly BranchRow[] {
  return branches.map((branch) => ({
    key: `${branch.from.streamId}#${branch.from.sequence}`,
    label: branch.label ?? `branch @ ${branch.from.sequence}`,
    positionLabel: `${branch.from.streamId} @ ${branch.from.sequence}`,
  }));
}

/** Summarize one typed event as a feed line (pure, total — partial
 * member combinations degrade to explicit placeholders, never crashes). */
export function eventSummary(event: AiCollaborationEvent): string {
  const who = principalLabel(event.participant ?? event.actor);
  switch (event.kind) {
    case 'presence.changed':
      return `${who} is ${event.presence ?? 'unknown presence'}`;
    case 'focus.changed':
      return event.target !== undefined
        ? `${who} focused ${focusTargetLabel(event.target)}`
        : `${who} focused an unknown target`;
    case 'focus.released':
      return `${who} released focus`;
    case 'control.taken': {
      const authority =
        event.provenance !== undefined
          ? authorityLabel(event.provenance.authority)
          : 'unknown authority';
      return `${principalLabel(event.actor)} took control (${authority})`;
    }
    case 'control.released':
      return `${principalLabel(event.actor)} released control`;
    case 'control.denied': {
      const reason = event.rejection !== undefined ? event.rejection.reason : 'unknown reason';
      return `takeover by ${principalLabel(event.actor)} denied (${reason})`;
    }
    case 'intent.emitted':
      return intentSummary(event.intent);
    case 'moment.captured':
      return `engineering moment captured ${
        event.momentDigest !== undefined ? shortDigest(event.momentDigest) : '(no digest)'
      }`;
    case 'session.closed':
      return 'session closed';
    default:
      return event.kind;
  }
}

/** Summarize one typed intent as a feed line. */
export function intentSummary(intent: InteractionIntent | undefined): string {
  if (intent === undefined) return 'intent (malformed)';
  switch (intent.kind) {
    case 'select':
      return `selected ${projectedRefLabel(intent.target)}`;
    case 'inspect':
      return `inspected ${projectedRefLabel(intent.target)}`;
    case 'follow-agent':
      return `follows ${intent.agentId}`;
    case 'take-control':
      return `take control (${authorityLabel(intent.authority)})`;
    case 'release-control':
      return 'release control';
    case 'pause':
      return 'paused playback';
    case 'resume':
      return 'resumed playback';
    case 'replay':
      return `replayed to ${intent.position.streamId} @ ${intent.position.sequence}`;
    case 'branch':
      return `branched at ${intent.from.sequence}${intent.label !== undefined ? ` (${intent.label})` : ''}`;
    case 'approve':
      return `approved proposal ${intent.target.proposalId}`;
    case 'reject':
      return `rejected proposal ${intent.target.proposalId}`;
    case 'execute':
      return `requested execution of ${intent.target.proposalId}`;
    case 'annotate':
      return `annotated ${projectedRefLabel(intent.target)}: ${intent.note}`;
    case 'compare':
      return `compared ${projectedRefLabel(intent.targets[0])} with ${projectedRefLabel(
        intent.targets[1],
      )}`;
    case 'filter':
      return `filtered view (${Object.keys(intent.criteria).length} criteria)`;
    case 'query':
      return `asked: ${intent.text}`;
    default:
      return (intent as { kind: string }).kind;
  }
}

/** Build the intent-feed rows (latest first, bounded). */
export function buildIntentFeed(
  events: readonly AiCollaborationEvent[],
  limit: number = INTENT_FEED_LIMIT,
): readonly FeedRow[] {
  return [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .slice(-limit)
    .reverse()
    .map((event) => ({
      key: `event#${event.sequence}`,
      sequence: event.sequence,
      actorLabel: principalLabel(event.actor),
      summary: eventSummary(event),
      occurredAt: event.occurredAt,
    }));
}

/** Build one Engineering Moment summary card. */
export function buildMomentCard(record: EngineeringMomentRecord): MomentCard {
  const { moment } = record;
  return {
    key: record.momentDigest,
    digest: record.momentDigest,
    shortDigest: shortDigest(record.momentDigest),
    label: moment.label ?? 'untitled moment',
    capturedByLabel: principalLabel(moment.capturedBy),
    capturedAt: moment.capturedAt,
    agentCount: moment.agentState.length,
    humanCount: moment.humanState.length,
    evidenceCount: moment.evidence.length,
    snapshotCount: moment.worldSnapshot.length,
    availableActions: moment.availableActions,
    positionLabel: `${moment.timelinePosition.streamId} @ ${moment.timelinePosition.sequence}`,
  };
}

/** Derive the session scope label. */
export function scopeLabel(session: AiSessionDescriptor): string {
  if (session.scope === undefined) return 'tenant-wide';
  const parts: string[] = [];
  if (session.scope.workspaceId !== undefined) {
    parts.push(principalLabel(session.scope.workspaceId));
  }
  if (session.scope.projectId !== undefined) {
    parts.push(principalLabel(session.scope.projectId));
  }
  return parts.length > 0 ? parts.join(' / ') : 'tenant-wide';
}

/** Build the aggregate view model for the feature's root panel. */
export function buildAgentCollaborationViewModel(
  session: AiSessionDescriptor,
  projection: CollaborationProjection,
  events: readonly AiCollaborationEvent[],
  moments: readonly EngineeringMomentRecord[] = [],
): AgentCollaborationViewModel {
  return {
    sessionKey: session.sessionId,
    title: session.displayName,
    tenantId: session.tenantId,
    scopeLabel: scopeLabel(session),
    stateLabel: projection.state,
    openedByLabel: principalLabel(session.openedBy),
    openedAt: session.openedAt,
    eventCount: projection.eventCount,
    lastSequence: projection.lastSequence,
    roster: buildPresenceRoster(projection),
    controllerLabel:
      projection.controller !== undefined ? principalLabel(projection.controller) : null,
    hasControl: projection.controller !== undefined,
    denials: buildDenialRows(projection.controlDenials),
    playback: projection.playback,
    positionLabel:
      projection.timelinePosition !== undefined
        ? `${projection.timelinePosition.streamId} @ ${projection.timelinePosition.sequence}`
        : 'not started',
    branches: buildBranchRows(projection.branchPoints),
    feed: buildIntentFeed(events),
    moments: moments.map((record) => buildMomentCard(record)),
  };
}
