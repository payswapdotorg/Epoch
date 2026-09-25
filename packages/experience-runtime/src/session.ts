/**
 * The device session — the HOST model of the Experience Runtime (W013).
 *
 * A device session is tenant-scoped, carries the W011 device-descriptor
 * vocabulary (typed capabilities/limits — the abstract device slot W019
 * fills; adaptation is NOT this package's surface), an optional
 * deterministic virtual-time {@link FrameSchedule}, and the session's
 * current lifecycle state. Sessions are content-addressed records
 * (`DeviceSessionRecord`): the digest addresses the exact revision of the
 * session, and admission rejects a claimed digest that does not match the
 * recomputed one.
 *
 * The record's derived fields (`frameIndex`, `tickIndex`) are kept
 * consistent with `virtualTimeMs` and the schedule by a schema refinement,
 * so a tampered record with drifting indices is a typed
 * `malformed-record`.
 */
import { z } from 'zod';
import { DeviceDescriptorSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import {
  DEVICE_SESSION_SCHEMA_NAME,
  DeviceSessionStateSchema,
  ExperienceRuntimeProtocolVersionSchema,
} from './version';
import {
  DeviceSessionIdSchema,
  EventSequenceSchema,
  FrameIndexSchema,
  Sha256HexSchema,
  TickIndexSchema,
  VirtualTimeMsSchema,
} from './primitives';
import { FrameScheduleSchema, frameIndexAt, tickIndexAt } from './schedule';

/**
 * The shared canonical-consistency refinement: with a schedule, `frameIndex`
 * and `tickIndex` must equal the schedule-derived indices of the current
 * virtual time; without one, both must be 0 (an unscheduled session frames
 * nothing). A mounted state must carry a mount time not after the current
 * virtual time.
 */
function refineDeviceSession(
  session: {
    schedule?: z.infer<typeof FrameScheduleSchema>;
    virtualTimeMs: number;
    frameIndex: number;
    tickIndex: number;
    mountedStateDigest?: z.infer<typeof Sha256HexSchema>;
    mountedAtMs?: number;
  },
  ctx: z.RefinementCtx,
): void {
  if (session.schedule !== undefined) {
    const expectedFrame = frameIndexAt(session.schedule, session.virtualTimeMs);
    if (session.frameIndex !== expectedFrame) {
      ctx.addIssue({
        code: 'custom',
        message: `frameIndex ${session.frameIndex} is inconsistent with virtual time ${session.virtualTimeMs} (expected ${expectedFrame})`,
        path: ['frameIndex'],
      });
    }
    const expectedTick = tickIndexAt(session.schedule, session.virtualTimeMs);
    if (session.tickIndex !== expectedTick) {
      ctx.addIssue({
        code: 'custom',
        message: `tickIndex ${session.tickIndex} is inconsistent with virtual time ${session.virtualTimeMs} (expected ${expectedTick})`,
        path: ['tickIndex'],
      });
    }
  } else {
    if (session.frameIndex !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'an unscheduled session must carry frameIndex 0 (no frames are scheduled)',
        path: ['frameIndex'],
      });
    }
    if (session.tickIndex !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'an unscheduled session must carry tickIndex 0 (no ticks are scheduled)',
        path: ['tickIndex'],
      });
    }
  }
  if (session.mountedStateDigest !== undefined) {
    if (session.mountedAtMs === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a mounted state must carry its mount time',
        path: ['mountedAtMs'],
      });
    } else if (session.mountedAtMs > session.virtualTimeMs) {
      ctx.addIssue({
        code: 'custom',
        message: `mountedAtMs ${session.mountedAtMs} is after the current virtual time ${session.virtualTimeMs}`,
        path: ['mountedAtMs'],
      });
    }
  } else if (session.mountedAtMs !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'mountedAtMs requires a mounted state digest',
      path: ['mountedAtMs'],
    });
  }
}

/** The content of a device-session record (everything except the digest). */
export const DeviceSessionContentSchema = z
  .strictObject({
    schema: z.literal(DEVICE_SESSION_SCHEMA_NAME),
    protocolVersion: ExperienceRuntimeProtocolVersionSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    device: DeviceDescriptorSchema,
    schedule: FrameScheduleSchema.optional(),
    state: DeviceSessionStateSchema,
    virtualTimeMs: VirtualTimeMsSchema,
    frameIndex: FrameIndexSchema,
    tickIndex: TickIndexSchema,
    /** Count of runtime events emitted so far (the last sequence number). */
    eventSequence: EventSequenceSchema,
    mountedStateDigest: Sha256HexSchema.optional(),
    mountedAtMs: VirtualTimeMsSchema.optional(),
  })
  .superRefine(refineDeviceSession)
  .meta({
    id: 'DeviceSessionContent',
    title: 'DeviceSessionContent',
    description:
      'The content of a device-session record: discriminator, version, tenant scope, W011 device descriptor, optional virtual-time schedule, lifecycle state, and consistent frame/tick/mount state.',
  });

/** One device-session content. */
export type DeviceSessionContent = z.infer<typeof DeviceSessionContentSchema>;

/**
 * The sealed device-session record: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded). Each
 * lifecycle or virtual-time transition produces a new sealed revision.
 */
export const DeviceSessionRecordSchema = z
  .strictObject({
    schema: z.literal(DEVICE_SESSION_SCHEMA_NAME),
    protocolVersion: ExperienceRuntimeProtocolVersionSchema,
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    device: DeviceDescriptorSchema,
    schedule: FrameScheduleSchema.optional(),
    state: DeviceSessionStateSchema,
    virtualTimeMs: VirtualTimeMsSchema,
    frameIndex: FrameIndexSchema,
    tickIndex: TickIndexSchema,
    eventSequence: EventSequenceSchema,
    mountedStateDigest: Sha256HexSchema.optional(),
    mountedAtMs: VirtualTimeMsSchema.optional(),
    digest: Sha256HexSchema,
  })
  .superRefine(refineDeviceSession)
  .meta({
    id: 'DeviceSessionRecord',
    title: 'DeviceSessionRecord',
    description:
      'The sealed device-session record: consistent host-model content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed device-session record. */
export type DeviceSessionRecord = z.infer<typeof DeviceSessionRecordSchema>;
