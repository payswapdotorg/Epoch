/**
 * The reference in-memory collaboration hub (W010): session-based
 * presence/coordination over the shared model.
 *
 * Owns (and only owns): typed session lifecycle (creation, the terminal
 * `session.closed` event), participant membership (opaque principal
 * ids), presence events with a typed transition table, and the
 * session-scoped append-only coordination journal with the strict
 * per-session sequence discipline.
 *
 * Explicitly NOT (architecture lock rules 1/3/12):
 * - NOT a second authority: coordination never mutates the world model
 *   and never makes authorization decisions — participants coordinate;
 *   their ACTIONS still flow through the Action Gateway;
 * - NOT a real-time transport (WebSocket/presence brokers are future
 *   adapters);
 * - NOT durable persistence;
 * - NOT a clock: ZERO wall-clock reads and ZERO randomness — instants
 *   are producer-supplied payload data.
 *
 * Admission discipline (total, never throws; fixed precedence):
 * 1. version gate — schemaVersion skew is `version-unsupported`;
 * 2. schema gate — strict-object validation rejects unknown (vendor)
 *    fields; failures are `validation` with dotted paths;
 * 3. digest gate — the claimed digest must equal the recomputed
 *    canonical SHA-256, else `digest-mismatch`;
 * 4. member gate — per-kind member consistency (membership events name
 *    a participant; presence events name participant + presence; focus
 *    events carry a subject; notes may carry data), else `validation`;
 * 5. tenant gate — the hub's expected tenant (when set) and the
 *    session's fixed tenant must match, else `cross-tenant-denied` (R12);
 * 6. session gate — the session must exist (`unknown-session`) and be
 *    open (`session-closed`);
 * 7. sequence gate — journals are contiguous from 1: gaps, duplicates,
 *    and out-of-order appends are typed rejections;
 * 8. membership gate — join uniqueness (`duplicate-participant`),
 *    leave/presence for active members (`unknown-participant`), and the
 *    presence transition table (`invalid-presence-transition`).
 *
 * Determinism: maps iterate in insertion order, but every read path
 * sorts before exposing anything (no insertion-order leaks).
 */
import { PRESENCE_TRANSITIONS, type PresenceState } from './version';
import { CollaborationSessionSchema, CollaborationEventSchema } from './schema';
import { verifySessionDigest, verifyEventDigest } from './digest';
import { flattenZodIssues } from './issues';
import type {
  CollaborationError,
  CollaborationEvent,
  CollaborationEventRecord,
  CollaborationEventRegistration,
  CollaborationHubOptions,
  CollaborationResult,
  CollaborationSessionId,
  CollaborationSessionRecord,
  CollaborationSnapshot,
  ParticipantPresence,
  ReadJournalOptions,
  ReadOptions,
  SessionRegistration,
  SessionStateInfo,
} from './types';

function ok<T>(value: T): CollaborationResult<T> {
  return { ok: true, value };
}

function fail<T>(error: CollaborationError): CollaborationResult<T> {
  return { ok: false, error };
}

/** One session's journal + membership projection. */
interface SessionState {
  readonly record: CollaborationSessionRecord;
  closed: boolean;
  lastSequence: number;
  eventCount: number;
  /** principalId -> membership projection (active = present, not left). */
  readonly members: Map<string, { presence: string; lastSequence: number }>;
  /** sequence -> record (the append-only journal). */
  readonly journal: Map<number, CollaborationEventRecord>;
}

/** Per-kind member consistency (admission precedence 4). */
function memberViolation(event: CollaborationEvent): CollaborationError | null {
  const issues: { path: string; message: string }[] = [];
  switch (event.kind) {
    case 'participant.joined':
    case 'participant.left': {
      if (event.participant === undefined) {
        issues.push({
          path: 'event.participant',
          message: `membership events ("${event.kind}") must name the participant principal`,
        });
      }
      if (event.presence !== undefined) {
        issues.push({
          path: 'event.presence',
          message: 'membership events do not carry presence states',
        });
      }
      if (event.subject !== undefined) {
        issues.push({
          path: 'event.subject',
          message: 'membership events do not carry subjects',
        });
      }
      break;
    }
    case 'participant.presence': {
      if (event.participant === undefined) {
        issues.push({
          path: 'event.participant',
          message: 'presence events must name the participant principal',
        });
      }
      if (event.presence === undefined) {
        issues.push({
          path: 'event.presence',
          message: 'presence events must declare the presence state',
        });
      }
      if (event.presence === 'left') {
        issues.push({
          path: 'event.presence',
          message:
            'presence "left" is set only by the participant.left membership event — rejoin instead',
        });
      }
      if (event.subject !== undefined) {
        issues.push({
          path: 'event.subject',
          message: 'presence events do not carry subjects',
        });
      }
      break;
    }
    case 'subject.focused': {
      if (event.subject === undefined) {
        issues.push({
          path: 'event.subject',
          message: 'subject.focused events must carry the focused subject',
        });
      }
      if (event.participant !== undefined) {
        issues.push({
          path: 'event.participant',
          message: 'focus events do not name participants (the actor focuses)',
        });
      }
      break;
    }
    case 'subject.released': {
      if (event.subject === undefined) {
        issues.push({
          path: 'event.subject',
          message: 'subject.released events must carry the released subject',
        });
      }
      if (event.participant !== undefined) {
        issues.push({
          path: 'event.participant',
          message: 'focus events do not name participants (the actor releases)',
        });
      }
      break;
    }
    case 'coordination.note': {
      if (event.participant !== undefined) {
        issues.push({
          path: 'event.participant',
          message: 'coordination notes do not name participants (the actor notes)',
        });
      }
      if (event.presence !== undefined) {
        issues.push({
          path: 'event.presence',
          message: 'coordination notes do not carry presence states',
        });
      }
      break;
    }
    case 'session.closed': {
      if (event.participant !== undefined) {
        issues.push({
          path: 'event.participant',
          message: 'the session.closed event does not name participants',
        });
      }
      if (event.presence !== undefined) {
        issues.push({
          path: 'event.presence',
          message: 'the session.closed event does not carry presence',
        });
      }
      if (event.subject !== undefined) {
        issues.push({
          path: 'event.subject',
          message: 'the session.closed event does not carry subjects',
        });
      }
      if (event.data !== undefined) {
        issues.push({
          path: 'event.data',
          message: 'the session.closed event does not carry data',
        });
      }
      break;
    }
    default:
      break;
  }
  if (issues.length === 0) {
    return null;
  }
  return {
    code: 'validation',
    message: `collaboration event members are inconsistent for kind "${event.kind}" (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Version gate helper. */
function versionGate(record: unknown): CollaborationError | null {
  if (typeof record !== 'object' || record === null) {
    return {
      code: 'validation',
      message: 'collaboration record must be a JSON object',
      issues: [{ path: 'record', message: 'expected a JSON object' }],
    };
  }
  const encountered = (record as Record<string, unknown>).schemaVersion;
  if (typeof encountered === 'number' && encountered !== 1) {
    return {
      code: 'version-unsupported',
      message: `collaboration record version mismatch: expected 1, encountered ${encountered}`,
      expected: '1',
      encountered: String(encountered),
    };
  }
  return null;
}

/**
 * The reference collaboration hub. Construct directly (`new
 * CollaborationHub()`) or tenant-scoped (`new CollaborationHub({
 * expectedTenantId })`); restore deterministically from a snapshot
 * (`CollaborationHub.fromSnapshot`).
 */
export class CollaborationHub {
  /** sessionId -> state. Every read path sorts before exposing. */
  private readonly sessions = new Map<CollaborationSessionId, SessionState>();

  private readonly expectedTenantId: string | undefined;

  constructor(options: CollaborationHubOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /** Number of sessions in the hub. */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Admit a sealed session record (the session's opening fact).
   * Precedence: version -> schema -> digest -> tenant -> duplicate.
   */
  createSession(input: SessionRegistration): CollaborationResult<CollaborationSessionRecord> {
    const versionFailure = versionGate(
      input === null || input === undefined ? null : input.session,
    );
    if (versionFailure !== null) {
      return fail(versionFailure);
    }
    const parsed = CollaborationSessionSchema.safeParse(input.session);
    if (!parsed.success) {
      return fail({
        code: 'validation',
        message: 'collaboration session failed schema validation',
        issues: flattenZodIssues(parsed.error),
      });
    }
    const verified = verifySessionDigest(input);
    if (!verified.ok) {
      return fail(verified.error);
    }
    const session = verified.value;
    if (this.expectedTenantId !== undefined && session.tenantId !== this.expectedTenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `cross-tenant session creation denied: this hub is scoped to tenant "${this.expectedTenantId}", encountered "${session.tenantId}"`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: session.tenantId,
        sessionId: session.sessionId,
      });
    }
    if (this.sessions.has(session.sessionId)) {
      return fail({
        code: 'duplicate-session',
        message: `session "${session.sessionId}" already exists — session ids are unique forever`,
        sessionId: session.sessionId,
      });
    }
    const record: CollaborationSessionRecord = {
      session,
      sessionDigest: input.digest,
    };
    this.sessions.set(session.sessionId, {
      record,
      closed: false,
      lastSequence: 0,
      eventCount: 0,
      members: new Map(),
      journal: new Map(),
    });
    return ok(record);
  }

  /**
   * Append one sealed coordination event to a session journal. Admission
   * precedence is documented on the class. Returns the stored record.
   */
  appendEvent(
    input: CollaborationEventRegistration,
  ): CollaborationResult<CollaborationEventRecord> {
    const versionFailure = versionGate(
      input === null || input === undefined ? null : input.event,
    );
    if (versionFailure !== null) {
      return fail(versionFailure);
    }
    const parsed = CollaborationEventSchema.safeParse(input.event);
    if (!parsed.success) {
      return fail({
        code: 'validation',
        message: 'collaboration event failed schema validation',
        issues: flattenZodIssues(parsed.error),
      });
    }
    const verified = verifyEventDigest(input);
    if (!verified.ok) {
      return fail(verified.error);
    }
    const event = verified.value;

    // Member gate (per-kind consistency).
    const member = memberViolation(event);
    if (member !== null) {
      return fail(member);
    }

    // Tenant gate.
    if (this.expectedTenantId !== undefined && event.tenantId !== this.expectedTenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `cross-tenant coordination append denied: this hub is scoped to tenant "${this.expectedTenantId}", encountered "${event.tenantId}"`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: event.tenantId,
        sessionId: event.sessionId,
      });
    }
    const state = this.sessions.get(event.sessionId);
    if (state === undefined) {
      return fail({
        code: 'unknown-session',
        message: `session "${event.sessionId}" does not exist in this hub`,
        sessionId: event.sessionId,
      });
    }
    if (state.record.session.tenantId !== event.tenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `cross-tenant coordination append denied: session "${event.sessionId}" is scoped to tenant "${state.record.session.tenantId}", encountered "${event.tenantId}"`,
        expectedTenantId: state.record.session.tenantId,
        encounteredTenantId: event.tenantId,
        sessionId: event.sessionId,
      });
    }
    if (state.closed) {
      return fail({
        code: 'session-closed',
        message: `session "${event.sessionId}" is closed — its coordination journal is immutable history`,
        sessionId: event.sessionId,
      });
    }

    // Sequence gate (contiguous from 1).
    if (event.sequence !== state.lastSequence + 1) {
      if (state.journal.has(event.sequence)) {
        return fail({
          code: 'duplicate-sequence',
          message: `journal sequence ${event.sequence} is already recorded in session "${event.sessionId}"`,
          sessionId: event.sessionId,
          sequence: event.sequence,
        });
      }
      if (event.sequence > state.lastSequence + 1) {
        return fail({
          code: 'sequence-gap',
          message: `journal sequence gap in session "${event.sessionId}": expected ${state.lastSequence + 1}, encountered ${event.sequence}`,
          sessionId: event.sessionId,
          expectedSequence: state.lastSequence + 1,
          encounteredSequence: event.sequence,
        });
      }
      return fail({
        code: 'out-of-order-sequence',
        message: `out-of-order journal append in session "${event.sessionId}": expected ${state.lastSequence + 1}, encountered ${event.sequence}`,
        sessionId: event.sessionId,
        expectedSequence: state.lastSequence + 1,
        encounteredSequence: event.sequence,
      });
    }

    // Membership gate.
    const memberError = this.membershipViolation(state, event);
    if (memberError !== null) {
      return fail(memberError);
    }

    const record: CollaborationEventRecord = { event, contentDigest: input.digest };
    state.journal.set(event.sequence, record);
    state.lastSequence = event.sequence;
    state.eventCount += 1;

    // Project membership/presence/lifecycle.
    this.project(state, event);
    if (event.kind === 'session.closed') {
      state.closed = true;
    }
    return ok(record);
  }

  /** The membership/presence/lifecycle projection of one appended event. */
  private project(state: SessionState, event: CollaborationEvent): void {
    switch (event.kind) {
      case 'participant.joined': {
        state.members.set(event.participant as string, {
          presence: 'joining',
          lastSequence: event.sequence,
        });
        break;
      }
      case 'participant.left': {
        state.members.set(event.participant as string, {
          presence: 'left',
          lastSequence: event.sequence,
        });
        break;
      }
      case 'participant.presence': {
        const member = state.members.get(event.participant as string);
        if (member !== undefined) {
          member.presence = event.presence as string;
          member.lastSequence = event.sequence;
        }
        break;
      }
      default:
        break;
    }
  }

  /** Membership invariants (admission precedence 8). */
  private membershipViolation(
    state: SessionState,
    event: CollaborationEvent,
  ): CollaborationError | null {
    if (event.kind === 'participant.joined') {
      const existing = state.members.get(event.participant as string);
      if (existing !== undefined && existing.presence !== 'left') {
        return {
          code: 'duplicate-participant',
          message: `participant "${event.participant}" is already an active member of session "${event.sessionId}"`,
          sessionId: event.sessionId,
          principalId: event.participant as string,
        };
      }
      return null;
    }
    if (event.kind === 'participant.left') {
      const existing = state.members.get(event.participant as string);
      if (existing === undefined || existing.presence === 'left') {
        return {
          code: 'unknown-participant',
          message: `participant "${event.participant}" is not an active member of session "${event.sessionId}"`,
          sessionId: event.sessionId,
          principalId: event.participant as string,
        };
      }
      return null;
    }
    if (event.kind === 'participant.presence') {
      const existing = state.members.get(event.participant as string);
      if (existing === undefined || existing.presence === 'left') {
        return {
          code: 'unknown-participant',
          message: `participant "${event.participant}" is not an active member of session "${event.sessionId}"`,
          sessionId: event.sessionId,
          principalId: event.participant as string,
        };
      }
      const from = existing.presence as PresenceState;
      const to = event.presence as PresenceState;
      const legal = PRESENCE_TRANSITIONS[from].includes(to);
      if (!legal) {
        return {
          code: 'invalid-presence-transition',
          message: `participant "${event.participant}" cannot transition presence from "${from}" to "${to}" in session "${event.sessionId}"`,
          sessionId: event.sessionId,
          principalId: event.participant as string,
          from,
          to,
        };
      }
      return null;
    }
    return null;
  }

  /** The session state projection (lifecycle + membership + cursor). */
  sessionState(
    sessionId: CollaborationSessionId,
    options: ReadOptions = {},
  ): CollaborationResult<SessionStateInfo> {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return fail({
        code: 'unknown-session',
        message: `session "${sessionId}" does not exist in this hub`,
        sessionId,
      });
    }
    const denial = readDenial(state, sessionId, options);
    if (denial !== null) {
      return fail(denial);
    }
    return ok({
      session: state.record.session,
      state: state.closed ? 'closed' : 'open',
      participants: activeParticipants(state),
      lastSequence: state.lastSequence,
      eventCount: state.eventCount,
    });
  }

  /** The active (non-left) membership projection, sorted by principalId. */
  participants(
    sessionId: CollaborationSessionId,
    options: ReadOptions = {},
  ): CollaborationResult<readonly ParticipantPresence[]> {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return fail({
        code: 'unknown-session',
        message: `session "${sessionId}" does not exist in this hub`,
        sessionId,
      });
    }
    const denial = readDenial(state, sessionId, options);
    if (denial !== null) {
      return fail(denial);
    }
    return ok(activeParticipants(state));
  }

  /** Read a session journal (cursor primitive, ascending order). */
  readJournal(
    sessionId: CollaborationSessionId,
    options: ReadJournalOptions & ReadOptions = {},
  ): CollaborationResult<readonly CollaborationEventRecord[]> {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      return fail({
        code: 'unknown-session',
        message: `session "${sessionId}" does not exist in this hub`,
        sessionId,
      });
    }
    const denial = readDenial(state, sessionId, options);
    if (denial !== null) {
      return fail(denial);
    }
    const after = options.after ?? 0;
    const limit = options.limit ?? Number.POSITIVE_INFINITY;
    const records: CollaborationEventRecord[] = [];
    for (let sequence = after + 1; sequence <= state.lastSequence && records.length < limit; sequence += 1) {
      const record = state.journal.get(sequence);
      if (record !== undefined) {
        records.push(record);
      }
    }
    return ok(records);
  }

  /** Whether the session exists (total — never errors). */
  hasSession(sessionId: CollaborationSessionId): boolean {
    return this.sessions.has(sessionId);
  }

  /** All session records, sorted by sessionId ascending. */
  listSessions(): readonly CollaborationSessionRecord[] {
    return [...this.sessions.keys()]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        (sessionId) =>
          (this.sessions.get(sessionId) as SessionState).record,
      );
  }

  /**
   * Deterministic, serialization-friendly whole-hub projection: sessions
   * sorted by sessionId, journals sorted by (sessionId, sequence).
   */
  snapshot(): CollaborationSnapshot {
    const sessions = this.listSessions();
    const events: CollaborationEventRecord[] = [];
    for (const sessionId of [...this.sessions.keys()].sort()) {
      const state = this.sessions.get(sessionId) as SessionState;
      for (let sequence = 1; sequence <= state.lastSequence; sequence += 1) {
        const record = state.journal.get(sequence);
        if (record !== undefined) {
          events.push(record);
        }
      }
    }
    return { schemaVersion: 1, sessions, events };
  }

  /**
   * Deterministically restore a hub from a snapshot: every session and
   * event passes the FULL admission pipeline (version, schema, digest,
   * members, tenant, sequence, membership) — a tampered, reordered, or
   * gapped snapshot never restores.
   */
  static fromSnapshot(
    snapshot: CollaborationSnapshot,
    options: CollaborationHubOptions = {},
  ): CollaborationResult<CollaborationHub> {
    const hub = new CollaborationHub(options);
    for (const sessionRecord of snapshot.sessions) {
      const created = hub.createSession({
        session: sessionRecord.session,
        digest: sessionRecord.sessionDigest,
      });
      if (!created.ok) {
        return fail(created.error);
      }
    }
    for (const eventRecord of snapshot.events) {
      const appended = hub.appendEvent({
        event: eventRecord.event,
        digest: eventRecord.contentDigest,
      });
      if (!appended.ok) {
        return fail(appended.error);
      }
    }
    return ok(hub);
  }
}

/** The active membership projection, sorted by principalId. */
function activeParticipants(state: SessionState): ParticipantPresence[] {
  return [...state.members.entries()]
    .filter((entry) => entry[1].presence !== 'left')
    .map((entry) => ({
      principalId: entry[0],
      presence: entry[1].presence as ParticipantPresence['presence'],
      lastSequence: entry[1].lastSequence,
    }))
    .sort((a, b) => (a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0));
}

/** Cross-tenant read denial (R12), or null when the read is allowed. */
function readDenial(
  state: SessionState,
  sessionId: CollaborationSessionId,
  options: ReadOptions,
): CollaborationError | null {
  if (options.asTenant === undefined) {
    return null;
  }
  if (options.asTenant !== state.record.session.tenantId) {
    return {
      code: 'cross-tenant-denied',
      message: `cross-tenant read denied: session "${sessionId}" belongs to tenant "${state.record.session.tenantId}", caller tenant "${options.asTenant}"`,
      expectedTenantId: state.record.session.tenantId,
      encounteredTenantId: options.asTenant,
      sessionId,
    };
  }
  return null;
}
