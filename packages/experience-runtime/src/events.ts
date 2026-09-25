/**
 * Typed runtime events of a device session (architecture.md "Experience
 * Runtime"): lifecycle events (`session-opened` / `session-paused` /
 * `session-resumed` / `session-closed`), frame events (`frame-started`),
 * tick events (`tick-advanced`), and state events (`state-mounted`).
 *
 * Every event carries the session it belongs to and a 1-based contiguous
 * {@link EventSequence} — the total order of the session's history. An
 * {@link RuntimeEventTrace} is the sealed, content-addressed record of one
 * session's event history: sequences are contiguous from 1, every event
 * names the trace's session, the lifecycle events replay into a legal
 * state machine, and the whole record is digest-sealed (tamper detection).
 */
import { z } from 'zod';
import {
  DeviceDescriptorSchema,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import {
  RUNTIME_EVENT_TRACE_SCHEMA_NAME,
  ExperienceRuntimeProtocolVersionSchema,
  MAX_TRACE_EVENTS,
} from './version';
import {
  DeviceSessionIdSchema,
  EventSequenceSchema,
  FrameIndexSchema,
  Sha256HexSchema,
  TickIndexSchema,
  VirtualTimeMsSchema,
} from './primitives';
import { FrameScheduleSchema } from './schedule';

// ---------------------------------------------------------------------------
// The event union (discriminated on `kind`).
// ---------------------------------------------------------------------------

const SessionOpenedEventSchema = z
  .strictObject({
    kind: z.literal('session-opened'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    device: DeviceDescriptorSchema,
    schedule: FrameScheduleSchema.optional(),
    occurredAtMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'SessionOpenedEvent',
    title: 'SessionOpenedEvent',
    description: 'Lifecycle event: a device session was opened for a tenant-scoped device.',
  });

const SessionPausedEventSchema = z
  .strictObject({
    kind: z.literal('session-paused'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    occurredAtMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'SessionPausedEvent',
    title: 'SessionPausedEvent',
    description: 'Lifecycle event: an active device session was paused (virtual time frozen).',
  });

const SessionResumedEventSchema = z
  .strictObject({
    kind: z.literal('session-resumed'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    occurredAtMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'SessionResumedEvent',
    title: 'SessionResumedEvent',
    description: 'Lifecycle event: a paused device session was resumed.',
  });

const SessionClosedEventSchema = z
  .strictObject({
    kind: z.literal('session-closed'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    occurredAtMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'SessionClosedEvent',
    title: 'SessionClosedEvent',
    description: 'Lifecycle event: a device session was closed (terminal).',
  });

const FrameStartedEventSchema = z
  .strictObject({
    kind: z.literal('frame-started'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    frameIndex: FrameIndexSchema,
    frameDurationMs: z.number().int().min(1),
    atMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'FrameStartedEvent',
    title: 'FrameStartedEvent',
    description: 'Frame event: a scheduled frame started at a virtual-time boundary.',
  });

const TickAdvancedEventSchema = z
  .strictObject({
    kind: z.literal('tick-advanced'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tickIndex: TickIndexSchema,
    frameIndex: FrameIndexSchema,
    atMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'TickAdvancedEvent',
    title: 'TickAdvancedEvent',
    description: 'Tick event: the logical tick advanced at a tick-boundary frame start.',
  });

const StateMountedEventSchema = z
  .strictObject({
    kind: z.literal('state-mounted'),
    sequence: EventSequenceSchema,
    deviceSessionId: DeviceSessionIdSchema,
    stateDigest: Sha256HexSchema,
    atMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'StateMountedEvent',
    title: 'StateMountedEvent',
    description: 'State event: render-ready content (content-addressed digest) was mounted.',
  });

/** The runtime-event union (discriminated on `kind`). */
export const RuntimeEventSchema = z
  .discriminatedUnion('kind', [
    SessionOpenedEventSchema,
    SessionPausedEventSchema,
    SessionResumedEventSchema,
    SessionClosedEventSchema,
    FrameStartedEventSchema,
    TickAdvancedEventSchema,
    StateMountedEventSchema,
  ])
  .meta({
    id: 'RuntimeEvent',
    title: 'RuntimeEvent',
    description:
      'One typed runtime event of a device session: lifecycle, frame, tick, or state; totally ordered by sequence.',
  });

/** One runtime event. */
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

// ---------------------------------------------------------------------------
// The event trace (sealed, content-addressed).
// ---------------------------------------------------------------------------

/**
 * Replay the lifecycle of an event list: `session-opened` must come first
 * (the trace starts at session open); lifecycle transitions must follow the
 * active/paused/closed state machine; frame, tick, and state events occur
 * only while active. Returns the index of the first violating event, or
 * null when the whole list is consistent.
 */
function firstLifecycleViolation(events: readonly RuntimeEvent[]): number | null {
  let state: 'unopened' | 'active' | 'paused' | 'closed' = 'unopened';
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    switch (event.kind) {
      case 'session-opened':
        if (state !== 'unopened') {
          return i;
        }
        state = 'active';
        break;
      case 'session-paused':
        if (state !== 'active') {
          return i;
        }
        state = 'paused';
        break;
      case 'session-resumed':
        if (state !== 'paused') {
          return i;
        }
        state = 'active';
        break;
      case 'session-closed':
        if (state !== 'active' && state !== 'paused') {
          return i;
        }
        state = 'closed';
        break;
      default:
        if (state !== 'active') {
          return i;
        }
        break;
    }
  }
  return null;
}

/**
 * The shared canonical-ordering refinement of an event trace: sequences are
 * contiguous 1..n, every event names the trace's session, the first event
 * is `session-opened` with the trace's tenant scope, and the lifecycle
 * replays legally.
 */
function refineEventTrace(
  trace: {
    deviceSessionId: z.infer<typeof DeviceSessionIdSchema>;
    tenantScope: z.infer<typeof TenantScopeSchema>;
    events: z.infer<typeof RuntimeEventSchema>[];
  },
  ctx: z.RefinementCtx,
): void {
  for (let i = 0; i < trace.events.length; i += 1) {
    const event = trace.events[i];
    if (event.sequence !== i + 1) {
      ctx.addIssue({
        code: 'custom',
        message: `event sequences must be contiguous and 1-based (event ${i} carries sequence ${event.sequence})`,
        path: ['events', i, 'sequence'],
      });
      return;
    }
    if (event.deviceSessionId !== trace.deviceSessionId) {
      ctx.addIssue({
        code: 'custom',
        message: `every event must name the trace's session "${trace.deviceSessionId}" (event ${i} names "${event.deviceSessionId}")`,
        path: ['events', i, 'deviceSessionId'],
      });
      return;
    }
  }
  const first = trace.events[0];
  if (first !== undefined && first.kind !== 'session-opened') {
    ctx.addIssue({
      code: 'custom',
      message: 'an event trace must begin with the session-opened event',
      path: ['events', 0, 'kind'],
    });
    return;
  }
  if (first !== undefined && first.kind === 'session-opened') {
    if (
      first.tenantScope.tenantId !== trace.tenantScope.tenantId ||
      first.tenantScope.workspaceId !== trace.tenantScope.workspaceId ||
      first.tenantScope.projectId !== trace.tenantScope.projectId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'the session-opened event must carry the trace tenant scope',
        path: ['events', 0, 'tenantScope'],
      });
      return;
    }
  }
  const violation = firstLifecycleViolation(trace.events);
  if (violation !== null) {
    ctx.addIssue({
      code: 'custom',
      message: `event ${violation} ("${trace.events[violation].kind}") is illegal in the replayed session lifecycle`,
      path: ['events', violation, 'kind'],
    });
  }
}

/** The content of an event trace (everything except the digest). */
export const RuntimeEventTraceContentSchema = z
  .strictObject({
    schema: z.literal(RUNTIME_EVENT_TRACE_SCHEMA_NAME),
    protocolVersion: ExperienceRuntimeProtocolVersionSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    events: z.array(RuntimeEventSchema).min(1).max(MAX_TRACE_EVENTS),
  })
  .superRefine(refineEventTrace)
  .meta({
    id: 'RuntimeEventTraceContent',
    title: 'RuntimeEventTraceContent',
    description:
      'The content of a runtime event trace: discriminator, version, session, tenant scope, and the contiguous, lifecycle-consistent event history.',
  });

/** One event-trace content. */
export type RuntimeEventTraceContent = z.infer<typeof RuntimeEventTraceContentSchema>;

/**
 * The sealed event-trace record: content plus its SHA-256 digest over the
 * canonical JSON of the content (the digest field excluded). The digest
 * addresses the exact revision of the trace; admission rejects a claimed
 * digest that does not match the recomputed one.
 */
export const RuntimeEventTraceSchema = z
  .strictObject({
    schema: z.literal(RUNTIME_EVENT_TRACE_SCHEMA_NAME),
    protocolVersion: ExperienceRuntimeProtocolVersionSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    events: z.array(RuntimeEventSchema).min(1).max(MAX_TRACE_EVENTS),
    digest: Sha256HexSchema,
  })
  .superRefine(refineEventTrace)
  .meta({
    id: 'RuntimeEventTrace',
    title: 'RuntimeEventTrace',
    description:
      'The sealed runtime event-trace record: a session lifecycle-consistent history plus its SHA-256 content digest.',
  });

/** One sealed event trace. */
export type RuntimeEventTrace = z.infer<typeof RuntimeEventTraceSchema>;
