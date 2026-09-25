/**
 * Collaboration event adapters over the W010 event shapes — the seam
 * between the event-sourced substrate (W010) and the typed AI-collaboration
 * semantics.
 *
 * Two substrate families, both consumed:
 *
 * 1. EVENT-LOG records (@epoch/event-log — RUNTIME dependency): an
 *    AI-collaboration fact travels as an event-log `EventRecord` whose
 *    payload discriminator lives in the open `ai` namespace
 *    (`ai:<kebab-kind>`), with the typed event as the payload data minus
 *    the envelope-duplicated scoping fields (tenant/actor/occurredAt come
 *    from the envelope — the transport is the scoping authority, and the
 *    adapter re-checks tenant consistency so a payload cannot smuggle a
 *    foreign tenant). {@link toEventLogPayload} and
 *    {@link buildEventLogContent} emit; {@link fromEventLogRecord} adapts.
 *
 * 2. COLLABORATION journal events (@epoch/collaboration — devDependency
 *    parity ONLY, per the W015 runtime-dependency pin; the shapes are
 *    MIRRORED in src/schema.ts and parity-pinned by
 *    test/parity.test.ts): W010 coordination facts map onto the typed
 *    AI-collaboration vocabulary (joins/leaves/presence -> presence facts;
 *    subject focus -> focus facts; session.closed -> the terminal close).
 *    `coordination.note` carries no AI-collaboration semantic and is a
 *    typed validation rejection (the adapter vocabulary is closed).
 *
 * The adapters are PURE and TOTAL; they never store, never mutate, and
 * never read a clock.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  EVENT_LOG_RECORD_VERSION,
  parseEventRecord,
  type EventContent,
  type EventPayload,
} from '@epoch/event-log';
import { AI_EVENT_NAMESPACE } from './version';
import { MirroredCollaborationEventRecordSchema } from './schema';
import { flattenZodIssues, validationError, validationMessage } from './issues';
import { AiCollaborationEventSchema } from './schema';
import type { AiCollaborationEvent, AiResult } from './types';

function ok<T>(value: T): AiResult<T> {
  return { ok: true, value };
}

/** `presence.changed` -> `presence-changed` (the payload discriminator suffix). */
function kebabOfKind(kind: AiCollaborationEvent['kind']): string {
  return kind.replace('.', '-');
}

/** The `ai:*` event-log payload discriminator of one typed event kind. */
export function eventLogDiscriminatorOf(kind: AiCollaborationEvent['kind']): string {
  return `${AI_EVENT_NAMESPACE}:${kebabOfKind(kind)}`;
}

// ---------------------------------------------------------------------------
// Typed event -> event-log payload (emission into the substrate).
// ---------------------------------------------------------------------------

/**
 * The payload data of a typed event: every field EXCEPT the envelope-
 * duplicated scoping members (tenantId, actor, occurredAt — the event-log
 * envelope owns those) and the schemaVersion (the envelope owns its own).
 */
function payloadDataOf(event: AiCollaborationEvent): Record<string, JsonValue> {
  const { schemaVersion: _sv, tenantId: _t, actor: _a, occurredAt: _o, ...rest } = event;
  void _sv;
  void _t;
  void _a;
  void _o;
  return rest as unknown as Record<string, JsonValue>;
}

/** Build the event-log payload of one typed AI-collaboration event. */
export function toEventLogPayload(event: AiCollaborationEvent): EventPayload {
  const parsed = AiCollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error(
      `cannot build an event-log payload for an invalid AI-collaboration event (${flattenZodIssues(parsed.error)[0]?.path ?? '?'}: ${flattenZodIssues(parsed.error)[0]?.message ?? 'invalid'})`,
    );
  }
  return {
    discriminator: eventLogDiscriminatorOf(parsed.data.kind),
    data: payloadDataOf(parsed.data),
  };
}

/** The transport coordinates an emitted event-log record needs. */
export interface EventLogCoordinates {
  readonly streamId: string;
  readonly sequence: number;
  readonly causalParent: { readonly streamId: string; readonly sequence: number } | null;
}

/**
 * Build the event-log `EventContent` carrying one typed event. The
 * envelope supplies the scoping members (tenant, actor, instant) from the
 * typed event itself; the caller supplies the transport coordinates.
 * Seal the content with @epoch/event-log's own `sealEvent` (the substrate
 * admission stays the substrate's).
 */
export function buildEventLogContent(
  event: AiCollaborationEvent,
  coordinates: EventLogCoordinates,
): EventContent {
  return {
    schemaVersion: EVENT_LOG_RECORD_VERSION,
    streamId: coordinates.streamId,
    sequence: coordinates.sequence,
    tenantId: event.tenantId,
    actor: event.actor,
    causalParent: coordinates.causalParent,
    payload: toEventLogPayload(event),
    occurredAt: event.occurredAt,
  } as EventContent;
}

// ---------------------------------------------------------------------------
// Event-log record -> typed event (adaptation from the substrate).
// ---------------------------------------------------------------------------

/**
 * Adapt an event-log `EventRecord` carrying an `ai:*` payload into the
 * typed AI-collaboration event. Total:
 * - the record is verified with the event-log digest discipline first
 *   (`digest-mismatch` on tamper);
 * - non-`ai` namespaces are typed validation rejections (the adapter is
 *   scoped to its own namespace);
 * - the payload data is recombined with the envelope's scoping members
 *   and validated as the typed event (`validation`);
 * - a payload session tenant that disagrees with the envelope tenant is a
 *   typed `cross-tenant-denied` rejection (R12 — the transport envelope
 *   is the scoping authority).
 */
export function fromEventLogRecord(record: unknown): AiResult<AiCollaborationEvent> {
  // Substrate admission: the full event-log record discipline (schema +
  // digest tamper detection) via the substrate's own total parser.
  const admitted = parseEventRecord(record);
  if (!admitted.ok) {
    const failure = admitted.error;
    if (failure.code === 'digest-mismatch') {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message:
            'event-log record digest does not match its content (tampered or mismatched envelope) — the record is rejected',
          expected: failure.expected,
          encountered: failure.encountered,
        },
      };
    }
    return { ok: false, error: validationMessage('invalid event-log record', 'record') };
  }
  const content = admitted.value.event;

  // Namespace scope: the adapter owns the open `ai` namespace only.
  const discriminator: string = content.payload.discriminator;
  if (!discriminator.startsWith(`${AI_EVENT_NAMESPACE}:`)) {
    return {
      ok: false,
      error: validationMessage(
        `event-log discriminator "${discriminator}" is outside the "${AI_EVENT_NAMESPACE}" namespace — this adapter is scoped to AI-collaboration payloads`,
        'payload.discriminator',
      ),
    };
  }

  // Recombine: the envelope owns tenant/actor/instant; the data owns the rest.
  const data = content.payload.data as Record<string, unknown>;
  const candidate = {
    schemaVersion: 1,
    ...(data as object),
    tenantId: content.tenantId,
    actor: content.actor,
    occurredAt: content.occurredAt,
  };
  const typed = AiCollaborationEventSchema.safeParse(candidate);
  if (!typed.success) {
    return { ok: false, error: validationError(typed.error) };
  }

  // Transport/payload tenant consistency (no foreign-tenant smuggling).
  const payloadTenant = (data as { tenantId?: unknown }).tenantId;
  if (typeof payloadTenant === 'string' && payloadTenant !== content.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `payload tenant "${payloadTenant}" disagrees with the event-log envelope tenant "${content.tenantId}" (the envelope is the scoping authority)`,
        expectedTenantId: content.tenantId,
        encounteredTenantId: payloadTenant,
      },
    };
  }

  return ok(typed.data);
}

// ---------------------------------------------------------------------------
// W010 collaboration journal event -> typed event (mirrored adapter).
// ---------------------------------------------------------------------------

/**
 * Adapt a W010 `CollaborationEventRecord` (mirrored grammar; parity-pinned
 * against @epoch/collaboration by devDependency tests) into the typed
 * AI-collaboration vocabulary:
 *
 * | W010 kind                | typed kind        | members                          |
 * | ------------------------ | ----------------- | -------------------------------- |
 * | `participant.joined`     | `presence.changed`| participant, presence=`joining`  |
 * | `participant.presence`   | `presence.changed`| participant, presence             |
 * | `participant.left`       | `presence.changed`| participant, presence=`left`      |
 * | `subject.focused`        | `focus.changed`   | participant=actor, target=subject |
 * | `subject.released`       | `focus.released`  | participant=actor                 |
 * | `session.closed`         | `session.closed`  | —                                 |
 * | `coordination.note`      | — (typed rejection: no AI-collaboration semantic) |
 *
 * Total: the mirrored record is digest-verified first (`digest-mismatch`
 * on tamper), then mapped.
 */
export function fromCollaborationEventRecord(record: unknown): AiResult<AiCollaborationEvent> {
  const parsed = MirroredCollaborationEventRecordSchema.safeParse(record);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const envelope = parsed.data.event;

  // Digest discipline: the W010 record's claimed content address.
  const expected: Sha256Hex = canonicalDigest(envelope as unknown as JsonValue);
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'collaboration event digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  const base = {
    schemaVersion: 1 as const,
    sessionId: envelope.sessionId,
    sequence: envelope.sequence,
    tenantId: envelope.tenantId,
    actor: envelope.actor,
    occurredAt: envelope.occurredAt,
  };

  switch (envelope.kind) {
    case 'participant.joined':
      return ok({
        ...base,
        kind: 'presence.changed',
        participant: envelope.participant,
        presence: 'joining',
      });
    case 'participant.presence':
      return ok({
        ...base,
        kind: 'presence.changed',
        participant: envelope.participant,
        presence: envelope.presence,
      });
    case 'participant.left':
      return ok({
        ...base,
        kind: 'presence.changed',
        participant: envelope.participant,
        presence: 'left',
      });
    case 'subject.focused':
      return ok({
        ...base,
        kind: 'focus.changed',
        participant: envelope.actor,
        target: envelope.subject,
      });
    case 'subject.released':
      return ok({
        ...base,
        kind: 'focus.released',
        participant: envelope.actor,
      });
    case 'session.closed':
      return ok({ ...base, kind: 'session.closed' });
    case 'coordination.note':
      return {
        ok: false,
        error: validationMessage(
          'W010 "coordination.note" events carry no AI-collaboration semantic (the adapter vocabulary is closed)',
          'event.kind',
        ),
      };
  }
}
