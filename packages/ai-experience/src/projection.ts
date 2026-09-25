/**
 * The deterministic collaboration projection — a PURE fold of typed
 * AI-collaboration events into the session's collaboration state view.
 *
 * This is NOT event storage and NOT a state machine: the W010 substrate
 * (event log + collaboration hub) owns change history and journal
 * admission; this fold projects ALREADY-ADMITTED typed facts into the
 * semantics the AI Collaboration UX consumes (presence, focus, control,
 * follows, playback, timeline, branches, annotations, moments). The
 * kernel replay package remains the reconstruction authority — this is
 * the presentation projection over typed records (lock rule 8).
 *
 * Determinism: ZERO wall-clock reads, ZERO randomness; events are folded
 * in ascending (sequence) order regardless of input order; every exposed
 * array is SORTED (no insertion-order leaks). Two event sets that differ
 * only in input order produce byte-identical projections.
 *
 * Fold gates (first violation aborts the fold with a typed error):
 * 1. session gate — every event must belong to the projected session
 *    (`unknown-session-reference`);
 * 2. tenant gate — every event's tenant must be the session's tenant
 *    (`cross-tenant-denied`, R12);
 * 3. sequence gate — journal sequences must be unique (`validation`);
 * 4. lifecycle gate — no event may follow the terminal `session.closed`
 *    (`validation`);
 * 5. member gate — per-kind member consistency (`validation`);
 * 6. presence gate — presence facts must follow the mirrored W010
 *    transition table (`validation`).
 */
import { AGENT_PRESENCE_TRANSITIONS } from './version';
import { AiCollaborationEventSchema } from './schema';
import { validationMessage } from './issues';
import type { AgentPresenceState } from './version';
import type {
  AiCollaborationEvent,
  AiExperienceError,
  AiResult,
  AiSessionDescriptor,
  AgentFollow,
  BranchPoint,
  CollaborationProjection,
  ControlRejection,
  ParticipantFocus,
  ParticipantPresence,
  ViewAnnotation,
} from './types';

/** Options of {@link projectCollaboration}. */
export interface ProjectCollaborationOptions {
  /**
   * The initial timeline position (defaults to sequence 0 of the supplied
   * initial stream, or a caller-supplied position). A session begins at
   * the start of its stream.
   */
  readonly initialPosition?: { streamId: string; sequence: number };
}

interface FoldState {
  readonly presence: Map<string, ParticipantPresence>;
  readonly focus: Map<string, ParticipantFocus>;
  readonly follows: Map<string, AgentFollow>;
  readonly annotations: ViewAnnotation[];
  readonly branchPoints: BranchPoint[];
  readonly moments: { momentDigest: string; sequence: number }[];
  readonly denials: ControlRejection[];
  controller?: string | undefined;
  playback: 'playing' | 'paused';
  timelinePosition: { streamId: string; sequence: number } | undefined;
  view: CollaborationProjection['view'];
  closed: boolean;
}

function memberViolation(event: AiCollaborationEvent): AiExperienceError | null {
  const issues: { path: string; message: string }[] = [];
  switch (event.kind) {
    case 'presence.changed': {
      if (event.participant === undefined) {
        issues.push({
          path: 'event.participant',
          message: 'presence.changed events must name the participant principal',
        });
      }
      if (event.presence === undefined) {
        issues.push({
          path: 'event.presence',
          message: 'presence.changed events must declare the presence state',
        });
      }
      if (event.target !== undefined) {
        issues.push({ path: 'event.target', message: 'presence events do not carry focus targets' });
      }
      if (event.provenance !== undefined || event.rejection !== undefined) {
        issues.push({ path: 'event.provenance', message: 'presence events do not carry control members' });
      }
      if (event.intent !== undefined) {
        issues.push({ path: 'event.intent', message: 'presence events do not carry intents' });
      }
      if (event.momentDigest !== undefined) {
        issues.push({ path: 'event.momentDigest', message: 'presence events do not carry moment digests' });
      }
      break;
    }
    case 'focus.changed': {
      if (event.participant === undefined) {
        issues.push({
          path: 'event.participant',
          message: 'focus.changed events must name the focusing participant',
        });
      }
      if (event.target === undefined) {
        issues.push({
          path: 'event.target',
          message: 'focus.changed events must carry the focused target',
        });
      }
      if (event.presence !== undefined) {
        issues.push({ path: 'event.presence', message: 'focus events do not carry presence' });
      }
      break;
    }
    case 'focus.released': {
      if (event.participant === undefined) {
        issues.push({
          path: 'event.participant',
          message: 'focus.released events must name the releasing participant',
        });
      }
      if (event.target !== undefined) {
        issues.push({ path: 'event.target', message: 'focus.released events do not carry targets' });
      }
      break;
    }
    case 'control.taken': {
      if (event.provenance === undefined) {
        issues.push({
          path: 'event.provenance',
          message: 'control.taken events must carry the takeover provenance (who, when, on what authority)',
        });
      }
      if (event.rejection !== undefined) {
        issues.push({ path: 'event.rejection', message: 'accepted takeovers do not carry rejections' });
      }
      break;
    }
    case 'control.released': {
      if (event.provenance === undefined) {
        issues.push({
          path: 'event.provenance',
          message: 'control.released events must carry the release provenance',
        });
      }
      break;
    }
    case 'control.denied': {
      if (event.rejection === undefined) {
        issues.push({
          path: 'event.rejection',
          message: 'control.denied events must carry the typed rejection with its provenance',
        });
      }
      if (event.provenance !== undefined) {
        issues.push({ path: 'event.provenance', message: 'denials carry rejections, not acceptances' });
      }
      break;
    }
    case 'intent.emitted': {
      if (event.intent === undefined) {
        issues.push({
          path: 'event.intent',
          message: 'intent.emitted events must carry the full typed intent',
        });
      }
      break;
    }
    case 'moment.captured': {
      if (event.momentDigest === undefined) {
        issues.push({
          path: 'event.momentDigest',
          message: 'moment.captured events must carry the Engineering Moment digest',
        });
      }
      break;
    }
    case 'session.closed': {
      if (event.participant !== undefined || event.presence !== undefined) {
        issues.push({ path: 'event.participant', message: 'close events carry no members' });
      }
      break;
    }
  }
  if (issues.length === 0) {
    return null;
  }
  return {
    code: 'validation',
    message: `AI-collaboration event ${event.sequence} (${event.kind}) failed member consistency`,
    issues,
  };
}

function roleOf(session: AiSessionDescriptor, principalId: string) {
  return session.roles.find((role) => role.principalId === principalId);
}

/**
 * Project one session's typed events into its collaboration state view.
 * Total; see the module docs for the fold gates and determinism contract.
 */
export function projectCollaboration(
  session: AiSessionDescriptor,
  events: readonly unknown[],
  options?: ProjectCollaborationOptions,
): AiResult<CollaborationProjection> {
  // Validate + sort (ascending sequence) regardless of input order.
  const parsed: AiCollaborationEvent[] = [];
  for (const candidate of events) {
    const result = AiCollaborationEventSchema.safeParse(candidate);
    if (!result.success) {
      return { ok: false, error: validationMessage('invalid AI-collaboration event', 'events') };
    }
    parsed.push(result.data);
  }
  parsed.sort((a, b) => a.sequence - b.sequence);

  const state: FoldState = {
    presence: new Map(),
    focus: new Map(),
    follows: new Map(),
    annotations: [],
    branchPoints: [],
    moments: [],
    denials: [],
    controller: undefined,
    playback: 'playing',
    timelinePosition: options?.initialPosition,
    view: {},
    closed: false,
  };

  const seenSequences = new Set<number>();

  for (const event of parsed) {
    // Fold gate 1: session gate.
    if (event.sessionId !== session.sessionId) {
      return {
        ok: false,
        error: {
          code: 'unknown-session-reference',
          message: `event ${event.sequence} belongs to session "${event.sessionId}", but the projection folds session "${session.sessionId}"`,
          sessionId: event.sessionId,
          expectedSessionId: session.sessionId,
        },
      };
    }
    // Fold gate 2: tenant gate.
    if (event.tenantId !== session.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `event ${event.sequence} carries tenant "${event.tenantId}", but session "${session.sessionId}" belongs to "${session.tenantId}"`,
          expectedTenantId: session.tenantId,
          encounteredTenantId: event.tenantId,
          sessionId: session.sessionId,
        },
      };
    }
    // Fold gate 3: sequence gate (journal uniqueness).
    if (seenSequences.has(event.sequence)) {
      return {
        ok: false,
        error: validationMessage(
          `duplicate journal sequence ${event.sequence} (the W010 journal discipline)`,
          'sequence',
        ),
      };
    }
    seenSequences.add(event.sequence);
    // Fold gate 4: lifecycle gate.
    if (state.closed) {
      return {
        ok: false,
        error: validationMessage(
          `event ${event.sequence} follows the terminal session.closed fact`,
          'kind',
        ),
      };
    }
    // Fold gate 5: member gate.
    const member = memberViolation(event);
    if (member !== null) {
      return { ok: false, error: member };
    }

    switch (event.kind) {
      case 'presence.changed': {
        // Fold gate 6: presence gate (the mirrored W010 transition table
        // + the membership-sourced rejoin).
        const current = state.presence.get(event.participant as string)?.presence;
        if (current === undefined) {
          if (event.presence !== 'joining') {
            return {
              ok: false,
              error: validationMessage(
                `an unseen participant can only join (joining), not appear as "${event.presence}"`,
                'presence',
              ),
            };
          }
        } else {
          const legal = AGENT_PRESENCE_TRANSITIONS[current] as readonly string[];
          if (!legal.includes(event.presence as string)) {
            return {
              ok: false,
              error: validationMessage(
                `illegal presence transition "${current}" -> "${event.presence}" (the W010 presence transition table)`,
                'presence',
              ),
            };
          }
        }
        const role = roleOf(session, event.participant as string);
        if (role === undefined) {
          return {
            ok: false,
            error: validationMessage(
              `participant "${event.participant}" holds no declared role in session "${session.sessionId}" (the session descriptor declares the peer set)`,
              'participant',
            ),
          };
        }
        state.presence.set(event.participant as string, {
          principalId: event.participant as string,
          participantKind: role.participantKind,
          agentId: role.agentId,
          presence: event.presence as AgentPresenceState,
          lastSequence: event.sequence,
        });
        if (event.presence === 'left') {
          state.focus.delete(event.participant as string);
        }
        break;
      }
      case 'focus.changed': {
        state.focus.set(event.participant as string, {
          principalId: event.participant as string,
          target: event.target as NonNullable<AiCollaborationEvent['target']>,
          lastSequence: event.sequence,
        });
        break;
      }
      case 'focus.released': {
        state.focus.delete(event.participant as string);
        break;
      }
      case 'control.taken': {
        state.controller = event.provenance?.actor;
        break;
      }
      case 'control.released': {
        if (state.controller === event.provenance?.actor) {
          state.controller = undefined;
        }
        break;
      }
      case 'control.denied': {
        state.denials.push(event.rejection as ControlRejection);
        break;
      }
      case 'intent.emitted': {
        const intent = event.intent as NonNullable<AiCollaborationEvent['intent']>;
        switch (intent.kind) {
          case 'follow-agent':
            state.follows.set(event.actor, {
              followerPrincipalId: event.actor,
              agentId: intent.agentId,
              lastSequence: event.sequence,
            });
            break;
          case 'pause':
            state.playback = 'paused';
            break;
          case 'resume':
            state.playback = 'playing';
            break;
          case 'replay':
            state.timelinePosition = intent.position;
            break;
          case 'branch':
            state.branchPoints.push({
              from: intent.from,
              label: intent.label,
              sequence: event.sequence,
            });
            break;
          case 'select':
            state.view = { ...state.view, selection: intent.target };
            break;
          case 'compare':
            state.view = { ...state.view, comparison: intent.targets };
            break;
          case 'filter':
            state.view = { ...state.view, filters: intent.criteria };
            break;
          case 'query':
            state.view = { ...state.view, lastQuery: intent.text };
            break;
          case 'annotate':
            state.annotations.push({
              participant: event.actor,
              target: intent.target,
              note: intent.note,
              sequence: event.sequence,
            });
            break;
          default:
            break;
        }
        break;
      }
      case 'moment.captured': {
        state.moments.push({
          momentDigest: event.momentDigest as string,
          sequence: event.sequence,
        });
        break;
      }
      case 'session.closed': {
        state.closed = true;
        break;
      }
    }
  }

  // Sorted, duplicate-free exposures (no insertion-order leaks).
  const presence = [...state.presence.values()].sort((a, b) =>
    a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0,
  );
  const focus = [...state.focus.values()].sort((a, b) =>
    a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0,
  );
  const follows = [...state.follows.values()].sort((a, b) =>
    a.followerPrincipalId < b.followerPrincipalId
      ? -1
      : a.followerPrincipalId > b.followerPrincipalId
        ? 1
        : 0,
  );
  const annotations = [...state.annotations].sort((a, b) => a.sequence - b.sequence);
  const branchPoints = [...state.branchPoints].sort((a, b) => {
    if (a.from.streamId !== b.from.streamId) {
      return a.from.streamId < b.from.streamId ? -1 : 1;
    }
    return a.from.sequence - b.from.sequence;
  });
  const moments = [...state.moments].sort((a, b) => a.sequence - b.sequence);

  return {
    ok: true,
    value: {
      session,
      state: state.closed ? 'closed' : 'open',
      presence,
      focus,
      controller: state.controller,
      controlDenials: state.denials,
      follows,
      playback: state.playback,
      timelinePosition: state.timelinePosition,
      branchPoints,
      annotations,
      moments,
      view: state.view,
      eventCount: parsed.length,
      lastSequence: parsed.length > 0 ? parsed[parsed.length - 1].sequence : 0,
    },
  };
}
