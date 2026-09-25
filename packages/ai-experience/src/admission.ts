/**
 * Intent admission — the total gate every emitted interaction intent
 * passes before it becomes a typed AI-collaboration event.
 *
 * Admission is PURE (no state, no clock, no randomness) and total (errors
 * are values). Fixed precedence, so consumers branch deterministically:
 *
 * 1. session gate — the envelope's session must be the supplied session
 *    (`unknown-session-reference`);
 * 2. tenant gate — the envelope's tenant must be the session's tenant
 *    (`cross-tenant-denied`, R12);
 * 3. intent gate — the intent must be a member of the versioned
 *    interaction-intent union (`invalid-intent` with dotted paths);
 * 4. Dynamic UI law — executable UI code in open intent payloads is
 *    `executable-ui-rejected` (agents emit TYPED intents, never
 *    arbitrary executable UI code);
 * 5. provider-neutrality law — vendor/provider fields in open intent
 *    payloads are `vendor-fields-rejected` (lock rule 13);
 * 6. tenant-reference gate — every projected reference the intent
 *    carries must belong to the session's tenant (`cross-tenant-denied`);
 * 7. role gate — the acting principal must hold a declared role whose
 *    granted subset contains the intent kind (a control intent denied
 *    here yields a `control.denied` event with the typed rejection and
 *    full claimed provenance; any other intent yields `validation`);
 * 8. control gate — take-control/release-control authority is verified
 *    against the current controller (a typed `takeover-denied` rejection
 *    recorded as a `control.denied` event — provenance is never lost);
 * 9. replay-position gate — replay/branch timeline positions must be
 *    within the known stream bounds (`replay-position-invalid`).
 *
 * Authority model (lock rules 3/12): approvals and execution requests are
 * UX-level REQUESTS only — the Action Gateway remains the execution
 * authority; this gate never makes authorization decisions beyond
 * collaboration control coordination (which IS collaboration semantics).
 */
import { AGENT_PRESENCE_TRANSITIONS } from './version';
import {
  AiSessionDescriptorSchema,
  InteractionIntentSchema,
} from './schema';
import { flattenZodIssues, invalidIntentError, validationMessage } from './issues';
import { intentNeutralityFailure } from './digest';
import type {
  AiCollaborationEvent,
  AiExperienceError,
  AiResult,
  AiSessionDescriptor,
  ControlAuthority,
  ControlProvenance,
  ControlRejection,
  InteractionIntent,
  StreamBound,
  TimelinePosition,
} from './types';

/** The typed envelope an intent travels in. */
export interface IntentEnvelope {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actor: string;
  readonly occurredAt: string;
  /** The session-journal sequence the admitted fact will occupy. */
  readonly sequence: number;
  readonly intent: unknown;
}

/** The control-state snapshot admission reads (never mutated). */
export interface ControlStateSnapshot {
  /** The current controller, when one holds control. */
  readonly controller?: string | undefined;
}

/** Options of {@link admitIntent}. */
export interface AdmitIntentOptions {
  /** The session the intent addresses (the authority for tenant/roles). */
  readonly session: AiSessionDescriptor;
  /** The current control state (from the session projection). */
  readonly control?: ControlStateSnapshot;
  /**
   * Known stream bounds for the replay-position gate. When omitted, every
   * replay/branch position is invalid (a session without streams cannot
   * be replayed).
   */
  readonly streamBounds?: readonly StreamBound[];
}

function ok<T>(value: T): AiResult<T> {
  return { ok: true, value };
}

function fail<T>(error: AiExperienceError): AiResult<T> {
  return { ok: false, error };
}

function crossTenant(session: AiSessionDescriptor, encountered: string): AiExperienceError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant intent denied: session "${session.sessionId}" belongs to tenant "${session.tenantId}", but the envelope carries "${encountered}"`,
    expectedTenantId: session.tenantId,
    encounteredTenantId: encountered,
    sessionId: session.sessionId,
  };
}

/** Validate a timeline position against the known stream bounds. */
export function validateTimelinePosition(
  position: TimelinePosition,
  streamBounds: readonly StreamBound[],
): AiExperienceError | null {
  const bound = streamBounds.find((candidate) => candidate.streamId === position.streamId);
  if (bound === undefined) {
    return {
      code: 'replay-position-invalid',
      message: `timeline position references stream "${position.streamId}", which is not among the known session streams`,
      streamId: position.streamId,
      sequence: position.sequence,
    };
  }
  if (position.sequence < 0 || position.sequence > bound.lastSequence) {
    return {
      code: 'replay-position-invalid',
      message: `timeline position ${position.sequence} is outside stream "${position.streamId}" bounds [0, ${bound.lastSequence}]`,
      streamId: position.streamId,
      sequence: position.sequence,
    };
  }
  return null;
}

/** Every projected reference an intent carries (for the tenant gate). */
function intentReferences(intent: InteractionIntent): readonly { tenantId: string }[] {
  switch (intent.kind) {
    case 'select':
    case 'inspect':
      return [intent.target];
    case 'annotate':
      return [intent.target];
    case 'compare':
      return [intent.targets[0], intent.targets[1]];
    default:
      return [];
  }
}

/** The typed event for an admitted non-control intent (`intent.emitted`). */
function emittedEvent(
  envelope: IntentEnvelope,
  session: AiSessionDescriptor,
  intent: InteractionIntent,
): AiCollaborationEvent {
  return {
    schemaVersion: 1,
    sessionId: session.sessionId,
    sequence: envelope.sequence,
    tenantId: session.tenantId,
    actor: envelope.actor,
    occurredAt: envelope.occurredAt,
    kind: 'intent.emitted',
    intent,
  };
}

/** The `control.denied` fact — the typed rejection WITH its provenance. */
function deniedEvent(
  envelope: IntentEnvelope,
  session: AiSessionDescriptor,
  rejection: ControlRejection,
): AiCollaborationEvent {
  return {
    schemaVersion: 1,
    sessionId: session.sessionId,
    sequence: envelope.sequence,
    tenantId: session.tenantId,
    actor: envelope.actor,
    occurredAt: envelope.occurredAt,
    kind: 'control.denied',
    rejection,
  };
}

/**
 * Verify a claimed control authority against the session and the current
 * controller. Returns the typed denial reason, or null when the
 * authority holds.
 */
function authorityDenial(
  session: AiSessionDescriptor,
  controller: string | undefined,
  actor: string,
  authority: ControlAuthority,
): ControlRejection['reason'] | null {
  switch (authority.kind) {
    case 'session-owner':
      return actor === session.openedBy ? null : 'claimed-authority-invalid';
    case 'role-grant':
      // The role grant itself is verified by the role gate (the actor's
      // granted subset must include take-control); an actor claiming a
      // role grant without holding one never reaches this point.
      return null;
    case 'explicit-handover':
      if (controller === undefined) {
        return 'claimed-authority-invalid';
      }
      return controller === authority.from ? null : 'claimed-authority-invalid';
  }
}

/**
 * Admit one interaction intent against a session, its declared roles, and
 * the current control state. Total; see the module docs for the fixed
 * precedence of typed errors.
 *
 * Take-control and release-control are TYPED TRANSITIONS: an authorized
 * transition yields a `control.taken`/`control.released` event with full
 * provenance (who, when, on what authority — plus the superseded
 * controller of a preempting takeover); an unauthorized attempt yields a
 * `control.denied` event carrying the typed rejection with the SAME
 * claimed provenance — denials are history, never silent.
 */
export function admitIntent(
  envelope: IntentEnvelope,
  options: AdmitIntentOptions,
): AiResult<AiCollaborationEvent> {
  const { session } = options;

  // Precedence 1: session gate.
  if (envelope.sessionId !== session.sessionId) {
    return fail({
      code: 'unknown-session-reference',
      message: `intent addresses session "${envelope.sessionId}", but the admission context is session "${session.sessionId}"`,
      sessionId: envelope.sessionId,
      expectedSessionId: session.sessionId,
    });
  }

  // Precedence 2: tenant gate.
  if (envelope.tenantId !== session.tenantId) {
    return fail(crossTenant(session, envelope.tenantId));
  }

  // Precedence 3: intent gate (the versioned discriminated union).
  const intentParsed = InteractionIntentSchema.safeParse(envelope.intent);
  if (!intentParsed.success) {
    return fail(invalidIntentError(intentParsed.error));
  }
  const intent = intentParsed.data;

  // Precedence 4-5: Dynamic UI law + provider-neutrality law.
  const neutralityFailure = intentNeutralityFailure(intent);
  if (neutralityFailure !== null) {
    return fail(neutralityFailure);
  }

  // Precedence 6: tenant-reference gate.
  for (const reference of intentReferences(intent)) {
    if (reference.tenantId !== session.tenantId) {
      return fail(crossTenant(session, reference.tenantId));
    }
  }

  // Precedence 7: role gate — the actor must hold a declared role.
  const role = session.roles.find((candidate) => candidate.principalId === envelope.actor);
  if (role === undefined) {
    return fail(
      validationMessage(
        `acting principal "${envelope.actor}" holds no declared role in session "${session.sessionId}"`,
        'actor',
      ),
    );
  }
  if (!role.allowedIntents.includes(intent.kind)) {
    if (intent.kind === 'take-control' || intent.kind === 'release-control') {
      return ok(
        deniedEvent(envelope, session, {
          actor: envelope.actor,
          occurredAt: envelope.occurredAt,
          claimedAuthority:
            intent.kind === 'take-control' ? intent.authority : { kind: 'role-grant' },
          reason: 'actor-lacks-control-authority',
        }),
      );
    }
    return fail(
      validationMessage(
        `role of "${envelope.actor}" does not grant the "${intent.kind}" intent`,
        'intent.kind',
      ),
    );
  }

  // Precedence 9: replay-position gate.
  const streamBounds = options.streamBounds ?? [];
  if (intent.kind === 'replay' || intent.kind === 'branch') {
    const position = intent.kind === 'replay' ? intent.position : intent.from;
    const positionFailure = validateTimelinePosition(position, streamBounds);
    if (positionFailure !== null) {
      return fail(positionFailure);
    }
  }

  // Precedence 8: control transitions (the typed takeover/release path).
  const controller = options.control?.controller;
  if (intent.kind === 'take-control') {
    const denial = authorityDenial(session, controller, envelope.actor, intent.authority);
    if (denial !== null) {
      return ok(
        deniedEvent(envelope, session, {
          actor: envelope.actor,
          occurredAt: envelope.occurredAt,
          claimedAuthority: intent.authority,
          reason: denial,
        }),
      );
    }
    const provenance: ControlProvenance = {
      actor: envelope.actor,
      occurredAt: envelope.occurredAt,
      authority: intent.authority,
    };
    return ok({
      schemaVersion: 1,
      sessionId: session.sessionId,
      sequence: envelope.sequence,
      tenantId: session.tenantId,
      actor: envelope.actor,
      occurredAt: envelope.occurredAt,
      kind: 'control.taken',
      provenance,
      supersededController: controller,
    });
  }
  if (intent.kind === 'release-control') {
    if (controller !== envelope.actor) {
      return ok(
        deniedEvent(envelope, session, {
          actor: envelope.actor,
          occurredAt: envelope.occurredAt,
          claimedAuthority: { kind: 'role-grant' },
          reason: 'actor-not-controller',
        }),
      );
    }
    return ok({
      schemaVersion: 1,
      sessionId: session.sessionId,
      sequence: envelope.sequence,
      tenantId: session.tenantId,
      actor: envelope.actor,
      occurredAt: envelope.occurredAt,
      kind: 'control.released',
      provenance: {
        actor: envelope.actor,
        occurredAt: envelope.occurredAt,
        authority: { kind: 'role-grant' },
      },
    });
  }

  // Every other admitted intent is an `intent.emitted` fact.
  return ok(emittedEvent(envelope, session, intent));
}

// ---------------------------------------------------------------------------
// Presence admission (membership-sourced presence facts).
// ---------------------------------------------------------------------------

/**
 * Validate a presence transition against the mirrored W010 transition
 * table (plus the membership-sourced rejoin: `left -> joining` is the
 * rejoin fact, sourced from a membership event). Returns a typed
 * validation error or null.
 */
export function presenceTransitionFailure(
  from: string | undefined,
  to: string,
): AiExperienceError | null {
  if (from === undefined) {
    if (to !== 'joining') {
      return validationMessage(
        `an unseen participant can only join (joining), not appear as "${to}"`,
        'presence',
      );
    }
    return null;
  }
  const legal = AGENT_PRESENCE_TRANSITIONS[from as keyof typeof AGENT_PRESENCE_TRANSITIONS];
  if (legal === undefined || !(legal as readonly string[]).includes(to)) {
    return validationMessage(
      `illegal presence transition "${from}" -> "${to}" (the W010 presence transition table)`,
      'presence',
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session validation (the total parse of a session descriptor).
// ---------------------------------------------------------------------------

/** Validate a session descriptor against the published contract. Total. */
export function validateSessionDescriptor(input: unknown): AiResult<AiSessionDescriptor> {
  const parsed = AiSessionDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: 'validation',
      message: `session descriptor failed schema validation (${flattenZodIssues(parsed.error).length} issue${flattenZodIssues(parsed.error).length === 1 ? '' : 's'})`,
      issues: flattenZodIssues(parsed.error),
    });
  }
  return ok(parsed.data);
}
