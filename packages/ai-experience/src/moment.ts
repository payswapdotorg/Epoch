/**
 * Engineering Moment capture — the total constructor of the
 * shareable/replayable collaboration unit.
 *
 * spec/experience-architecture.md (binding): "A shareable/replayable
 * collaboration unit: world snapshot + agent state + human state + visual
 * state + timeline position + evidence + scenario + available actions."
 *
 * A RECORD TYPE, not a runtime feature: capturing a moment is a PURE
 * construction from the session, its declared roles, the current
 * projection, and caller-supplied references — it never mutates engine
 * state, never reads a clock (instants are producer-supplied), and never
 * becomes a second authority (every kernel object is an opaque,
 * tenant-scoped, content-addressed reference).
 *
 * Capture precedence (fixed, so consumers branch deterministically):
 * 1. capture-actor gate — the capturing principal must be a present
 *    participant of the projection (`validation`);
 * 2. tenant gate — every snapshot/evidence reference must belong to the
 *    session's tenant (`cross-tenant-denied`, R12);
 * 3. evidence gate — every evidence reference must resolve against the
 *    known evidence digests (`unknown-evidence-reference`);
 * 4. position gate — the timeline position must be within the known
 *    stream bounds (`replay-position-invalid`);
 * 5. seal — the content is schema-validated and content-addressed with
 *    its canonical SHA-256 digest (the moment's shareable identity).
 */
import type { ProjectedEvidenceRef, ProjectedReference } from '@epoch/experience-protocol';
import { projectedReferenceKey } from '@epoch/experience-protocol';
import { EngineeringMomentContentSchema } from './schema';
import { validationError, validationMessage } from './issues';
import { validateTimelinePosition } from './admission';
import { computeMomentDigest } from './digest';
import type { InteractionIntentKind } from './version';
import type {
  AiResult,
  AiSessionDescriptor,
  CollaborationProjection,
  EngineeringMomentContent,
  EngineeringMomentRecord,
  ExperienceGraphReference,
  ParticipantRoleDescriptor,
  ScenarioReference,
  StreamBound,
  TimelinePosition,
} from './types';

/** The input of {@link captureEngineeringMoment}. */
export interface CaptureMomentInput {
  /** The session the moment belongs to (the opening-fact authority). */
  readonly session: AiSessionDescriptor;
  /** The current deterministic projection (agent/human state + controller). */
  readonly projection: CollaborationProjection;
  /** The world snapshot: the projected kernel references the moment freezes. */
  readonly worldSnapshot: readonly ProjectedReference[];
  /** The visual state reference: the W011 Experience Graph digest. */
  readonly visualState: ExperienceGraphReference;
  /** The evidence the moment captures (W006 content-addressed records). */
  readonly evidence: readonly ProjectedEvidenceRef[];
  /** The digests of evidence records the caller can resolve. */
  readonly knownEvidence?: readonly string[];
  /** The timeline position the moment freezes (defaults to the projection's). */
  readonly timelinePosition?: TimelinePosition;
  /** Known stream bounds for the position gate. */
  readonly streamBounds?: readonly StreamBound[];
  /** The opaque scenario the moment belongs to. */
  readonly scenario: ScenarioReference;
  /** The capturing principal. */
  readonly capturedBy: string;
  /** The capture instant (producer-supplied — never a clock read). */
  readonly capturedAt: string;
  /** Optional human label for the shareable unit. */
  readonly label?: string;
  /** The declared roles (derive the moment's available actions). */
  readonly roles?: readonly ParticipantRoleDescriptor[];
}

/**
 * Derive the moment's available actions: the SORTED, duplicate-free union
 * of every declared role's granted intent kinds (the actions available to
 * the collaboration at capture time).
 */
export function deriveAvailableActions(
  roles: readonly ParticipantRoleDescriptor[],
): readonly InteractionIntentKind[] {
  const union = new Set<string>();
  for (const role of roles) {
    for (const kind of role.allowedIntents) {
      union.add(kind);
    }
  }
  return [...union].sort() as readonly InteractionIntentKind[];
}

/** Project one participant kind's moment states from the projection. */
function participantStates(
  projection: CollaborationProjection,
  kind: 'agent' | 'human',
): EngineeringMomentContent['agentState'] {
  return projection.presence
    .filter((entry) => entry.participantKind === kind && entry.presence !== 'left')
    .map((entry) => ({
      principalId: entry.principalId,
      participantKind: kind,
      agentId: entry.agentId,
      presence: entry.presence,
      focus: projection.focus.find((focus) => focus.principalId === entry.principalId)?.target,
      holdsControl: projection.controller === entry.principalId,
    }))
    .sort((a, b) => (a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0));
}

/**
 * Capture an Engineering Moment. Total; see the module docs for the fixed
 * precedence of typed errors. The output record is content-addressed
 * (SHA-256 over canonical JSON) — the digest is the shareable identity,
 * and producing the record mutates nothing.
 */
export function captureEngineeringMoment(
  input: CaptureMomentInput,
): AiResult<EngineeringMomentRecord> {
  const { session, projection } = input;

  // Precedence 1: capture-actor gate — present participant of the projection.
  const actorPresence = projection.presence.find(
    (entry) => entry.principalId === input.capturedBy,
  );
  if (actorPresence === undefined || actorPresence.presence === 'left') {
    return {
      ok: false,
      error: validationMessage(
        `capturing principal "${input.capturedBy}" is not a present participant of session "${session.sessionId}"`,
        'capturedBy',
      ),
    };
  }

  // Precedence 2: tenant gate — snapshot + evidence references.
  const worldSnapshot = [...input.worldSnapshot].sort((a, b) =>
    projectedReferenceKey(a) < projectedReferenceKey(b)
      ? -1
      : projectedReferenceKey(a) > projectedReferenceKey(b)
        ? 1
        : 0,
  );
  for (const reference of worldSnapshot) {
    if (reference.tenantId !== session.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `moment world snapshot references tenant "${reference.tenantId}", but the session belongs to "${session.tenantId}"`,
          expectedTenantId: session.tenantId,
          encounteredTenantId: reference.tenantId,
          sessionId: session.sessionId,
        },
      };
    }
  }

  // Precedence 3: evidence gate — tenant + resolvability.
  const knownSet = new Set(input.knownEvidence ?? []);
  const evidence = [...input.evidence].sort((a, b) =>
    a.recordDigest < b.recordDigest ? -1 : a.recordDigest > b.recordDigest ? 1 : 0,
  );
  for (const reference of evidence) {
    if (reference.tenantId !== session.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `moment evidence references tenant "${reference.tenantId}", but the session belongs to "${session.tenantId}"`,
          expectedTenantId: session.tenantId,
          encounteredTenantId: reference.tenantId,
          sessionId: session.sessionId,
        },
      };
    }
    if (!knownSet.has(reference.recordDigest)) {
      return {
        ok: false,
        error: {
          code: 'unknown-evidence-reference',
          message: `moment evidence digest "${reference.recordDigest}" does not resolve against the session's known evidence records`,
          recordDigest: reference.recordDigest,
        },
      };
    }
  }

  // Precedence 4: position gate.
  const timelinePosition = input.timelinePosition ?? projection.timelinePosition;
  if (timelinePosition === undefined) {
    return {
      ok: false,
      error: validationMessage(
        'the moment has no timeline position (supply one or replay to a position first)',
        'timelinePosition',
      ),
    };
  }
  const positionFailure = validateTimelinePosition(timelinePosition, input.streamBounds ?? []);
  if (positionFailure !== null) {
    return { ok: false, error: positionFailure };
  }

  // Assemble the content (the binding seven components + provenance).
  const availableActions = deriveAvailableActions(input.roles ?? session.roles);
  if (availableActions.length === 0) {
    return {
      ok: false,
      error: validationMessage(
        'a moment must carry at least one available action',
        'availableActions',
      ),
    };
  }

  const content: EngineeringMomentContent = {
    schemaVersion: 1,
    sessionId: session.sessionId,
    tenantId: session.tenantId,
    capturedBy: input.capturedBy,
    capturedAt: input.capturedAt,
    label: input.label,
    worldSnapshot,
    agentState: participantStates(projection, 'agent'),
    humanState: participantStates(projection, 'human'),
    visualState: input.visualState,
    timelinePosition,
    evidence,
    scenario: input.scenario,
    availableActions,
  };

  // Precedence 5: seal (schema validation + content addressing).
  const parsed = EngineeringMomentContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      moment: parsed.data,
      momentDigest: computeMomentDigest(parsed.data),
    },
  };
}
