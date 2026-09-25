/**
 * The device-session lifecycle: pure, deterministic transitions over
 * sealed session records.
 *
 * Every transition is a TOTAL function: it takes the current sealed record
 * (plus typed input) and returns either the next sealed record together
 * with the runtime events it emitted, or a typed
 * {@link ExperienceRuntimeError}. Transitions never mutate their input,
 * never read a wall clock (virtual time advances only through explicit
 * caller-supplied deltas), and never touch kernel state — the host model
 * is presentation hosting, not semantic authority (lock rule 8).
 *
 * State machine: `active` -> (`pause`) -> `paused` -> (`resume`) ->
 * `active`; `active` | `paused` -> (`close`) -> `closed` (terminal).
 * Virtual time advances and render states mount only while `active`.
 *
 * Event derivation on advance: every frame whose start lies in the
 * half-open window `[fromMs, toMs)` emits `frame-started` (ascending); a
 * tick-boundary frame additionally emits `tick-advanced` immediately AFTER
 * its `frame-started` (the tick update fires within the frame that opens
 * the tick). Consecutive advances neither double-emit nor drop a boundary.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { DeviceDescriptorSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import { MAX_ADVANCE_MS } from './version';
import { DeviceSessionIdSchema, VirtualTimeMsSchema } from './primitives';
import { FrameScheduleSchema, framesStartedInWindow, isTickBoundary } from './schedule';
import {
  DeviceSessionContentSchema,
  type DeviceSessionContent,
  type DeviceSessionRecord,
} from './session';
import type { RuntimeEvent } from './events';
import type { ExperienceRuntimeError, ExperienceRuntimeResult } from './errors';
import { malformedRecordError } from './issues';

/** Options shared by the lifecycle entry points. */
export interface LifecycleOptions {
  /**
   * The tenant the caller is operating FOR. When provided, an operation on
   * a session owned by a different tenant is rejected with
   * `cross-tenant-denied` (R12 — the hosting boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

/** The typed input of {@link openDeviceSession}. */
export const OpenDeviceSessionInputSchema = z
  .strictObject({
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    device: DeviceDescriptorSchema,
    schedule: FrameScheduleSchema.optional(),
    /** Virtual time the session opens at (default 0). */
    openedAtMs: VirtualTimeMsSchema.optional(),
  })
  .meta({
    id: 'OpenDeviceSessionInput',
    title: 'OpenDeviceSessionInput',
    description:
      'Typed input of openDeviceSession: caller-chosen session identity, tenant scope, W011 device descriptor, optional schedule, optional open time.',
  });

/** One open-session input. */
export type OpenDeviceSessionInput = z.infer<typeof OpenDeviceSessionInputSchema>;

/** The outcome of one lifecycle transition: the next record plus its events. */
export interface SessionTransition {
  /** The next sealed session record (a new revision; input unchanged). */
  readonly session: DeviceSessionRecord;
  /** The runtime events this transition emitted, in total order. */
  readonly events: readonly RuntimeEvent[];
}

function invalidTransition(
  message: string,
  operation: string,
  sessionState: DeviceSessionRecord['state'],
  path: readonly (string | number)[] = [],
): ExperienceRuntimeError {
  return { code: 'invalid-transition', message, path: [...path], operation, sessionState };
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): ExperienceRuntimeError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant session operation denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

function tenantGate(
  session: DeviceSessionRecord,
  options: LifecycleOptions | undefined,
): ExperienceRuntimeError | null {
  if (options?.expectedTenantId !== undefined) {
    if (options.expectedTenantId !== session.tenantScope.tenantId) {
      return tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        session.tenantScope.tenantId,
      );
    }
  }
  return null;
}

/** Strip the digest field from a sealed record (pure projection). */
function contentOf(session: DeviceSessionRecord): DeviceSessionContent {
  const { digest: _sealed, ...content } = session;
  void _sealed;
  return content;
}

/**
 * Open a device session: validates the typed input, derives the initial
 * frame/tick indices from the schedule, seals the record, and emits the
 * `session-opened` lifecycle event. Total: invalid input yields a typed
 * `malformed-record`; tenant mismatch yields `cross-tenant-denied`.
 */
export function openDeviceSession(
  input: unknown,
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const parsed = OpenDeviceSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const opened = parsed.data;
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== opened.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        opened.tenantScope.tenantId,
      ),
    };
  }
  const virtualTimeMs = opened.openedAtMs ?? 0;
  const frameIndex =
    opened.schedule !== undefined
      ? Math.floor(virtualTimeMs / opened.schedule.frameDurationMs)
      : 0;
  const tickIndex =
    opened.schedule !== undefined
      ? Math.floor(frameIndex / opened.schedule.tickCadence)
      : 0;
  const content = DeviceSessionContentSchema.parse({
    schema: 'epoch.experience-runtime.device-session',
    protocolVersion: '1.0.0',
    deviceSessionId: opened.deviceSessionId,
    tenantScope: opened.tenantScope,
    device: opened.device,
    schedule: opened.schedule,
    state: 'active',
    virtualTimeMs,
    frameIndex,
    tickIndex,
    eventSequence: 1,
  });
  const session: DeviceSessionRecord = {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
  const events: RuntimeEvent[] = [
    {
      kind: 'session-opened',
      sequence: 1,
      deviceSessionId: opened.deviceSessionId,
      tenantScope: opened.tenantScope,
      device: opened.device,
      schedule: opened.schedule,
      occurredAtMs: virtualTimeMs,
    },
  ];
  return { ok: true, value: { session, events } };
}

/**
 * Pause an active session (freezes the virtual clock). Total: pausing a
 * paused or closed session yields a typed `invalid-transition`.
 */
export function pauseDeviceSession(
  session: DeviceSessionRecord,
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const denial = tenantGate(session, options);
  if (denial !== null) {
    return { ok: false, error: denial };
  }
  if (session.state !== 'active') {
    return {
      ok: false,
      error: invalidTransition(
        `cannot pause a ${session.state} session (only an active session can be paused)`,
        'pause',
        session.state,
      ),
    };
  }
  const content = contentOf(session);
  const next = DeviceSessionContentSchema.parse({
    ...content,
    state: 'paused',
    eventSequence: session.eventSequence + 1,
  });
  return {
    ok: true,
    value: {
      session: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
      events: [
        {
          kind: 'session-paused',
          sequence: session.eventSequence + 1,
          deviceSessionId: session.deviceSessionId,
          occurredAtMs: session.virtualTimeMs,
        },
      ],
    },
  };
}

/**
 * Resume a paused session. Total: resuming an active or closed session
 * yields a typed `invalid-transition`.
 */
export function resumeDeviceSession(
  session: DeviceSessionRecord,
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const denial = tenantGate(session, options);
  if (denial !== null) {
    return { ok: false, error: denial };
  }
  if (session.state !== 'paused') {
    return {
      ok: false,
      error: invalidTransition(
        `cannot resume a ${session.state} session (only a paused session can be resumed)`,
        'resume',
        session.state,
      ),
    };
  }
  const content = contentOf(session);
  const next = DeviceSessionContentSchema.parse({
    ...content,
    state: 'active',
    eventSequence: session.eventSequence + 1,
  });
  return {
    ok: true,
    value: {
      session: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
      events: [
        {
          kind: 'session-resumed',
          sequence: session.eventSequence + 1,
          deviceSessionId: session.deviceSessionId,
          occurredAtMs: session.virtualTimeMs,
        },
      ],
    },
  };
}

/**
 * Close a session (terminal). Total: closing a closed session yields a
 * typed `invalid-transition`.
 */
export function closeDeviceSession(
  session: DeviceSessionRecord,
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const denial = tenantGate(session, options);
  if (denial !== null) {
    return { ok: false, error: denial };
  }
  if (session.state === 'closed') {
    return {
      ok: false,
      error: invalidTransition(
        'cannot close a closed session (closed is terminal)',
        'close',
        session.state,
      ),
    };
  }
  const content = contentOf(session);
  const next = DeviceSessionContentSchema.parse({
    ...content,
    state: 'closed',
    eventSequence: session.eventSequence + 1,
  });
  return {
    ok: true,
    value: {
      session: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
      events: [
        {
          kind: 'session-closed',
          sequence: session.eventSequence + 1,
          deviceSessionId: session.deviceSessionId,
          occurredAtMs: session.virtualTimeMs,
        },
      ],
    },
  };
}

/**
 * Mount render-ready content (an opaque content digest — e.g. a sealed
 * Experience Graph revision) on an active session, at the session's
 * current virtual time. The host model records the mounted revision; it
 * never interprets content (admission and enforcement are the renderer
 * hosting surface's job in @epoch/renderer-runtime). Total.
 */
export function mountRenderState(
  session: DeviceSessionRecord,
  input: { readonly stateDigest: Sha256Hex },
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const denial = tenantGate(session, options);
  if (denial !== null) {
    return { ok: false, error: denial };
  }
  if (session.state !== 'active') {
    return {
      ok: false,
      error: invalidTransition(
        `cannot mount render state on a ${session.state} session (mounting requires an active session)`,
        'mount',
        session.state,
      ),
    };
  }
  const content = contentOf(session);
  const next = DeviceSessionContentSchema.parse({
    ...content,
    mountedStateDigest: input.stateDigest,
    mountedAtMs: session.virtualTimeMs,
    eventSequence: session.eventSequence + 1,
  });
  return {
    ok: true,
    value: {
      session: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
      events: [
        {
          kind: 'state-mounted',
          sequence: session.eventSequence + 1,
          deviceSessionId: session.deviceSessionId,
          stateDigest: input.stateDigest,
          atMs: session.virtualTimeMs,
        },
      ],
    },
  };
}

/**
 * Advance the virtual clock of an active session by a positive integer
 * delta of milliseconds, emitting the deterministic frame/tick event
 * sequence crossed on the way (see the module docs for the window
 * semantics and the per-boundary event order). Sessions without a
 * schedule emit no frame events (only the clock moves). Total: non-active
 * sessions, non-positive, non-integer, or oversized deltas yield typed
 * `invalid-transition` errors.
 */
export function advanceVirtualTime(
  session: DeviceSessionRecord,
  deltaMs: number,
  options?: LifecycleOptions,
): ExperienceRuntimeResult<SessionTransition> {
  const denial = tenantGate(session, options);
  if (denial !== null) {
    return { ok: false, error: denial };
  }
  if (session.state !== 'active') {
    return {
      ok: false,
      error: invalidTransition(
        `cannot advance virtual time on a ${session.state} session (time advances only while active)`,
        'advance',
        session.state,
        ['deltaMs'],
      ),
    };
  }
  if (!Number.isInteger(deltaMs) || deltaMs <= 0) {
    return {
      ok: false,
      error: invalidTransition(
        `virtual-time delta must be a positive integer of milliseconds (encountered ${deltaMs})`,
        'advance',
        session.state,
        ['deltaMs'],
      ),
    };
  }
  if (deltaMs > MAX_ADVANCE_MS) {
    return {
      ok: false,
      error: invalidTransition(
        `virtual-time delta ${deltaMs}ms exceeds the per-call bound of ${MAX_ADVANCE_MS}ms — advance in smaller steps`,
        'advance',
        session.state,
        ['deltaMs'],
      ),
    };
  }
  const fromMs = session.virtualTimeMs;
  const toMs = fromMs + deltaMs;
  const events: RuntimeEvent[] = [];
  let frameIndex = session.frameIndex;
  let tickIndex = session.tickIndex;
  if (session.schedule !== undefined) {
    const started = framesStartedInWindow(session.schedule, fromMs, toMs);
    for (const index of started) {
      events.push({
        kind: 'frame-started',
        sequence: session.eventSequence + events.length + 1,
        deviceSessionId: session.deviceSessionId,
        frameIndex: index,
        frameDurationMs: session.schedule.frameDurationMs,
        atMs: index * session.schedule.frameDurationMs,
      });
      if (isTickBoundary(session.schedule, index)) {
        const tick = Math.floor(index / session.schedule.tickCadence);
        events.push({
          kind: 'tick-advanced',
          sequence: session.eventSequence + events.length + 1,
          deviceSessionId: session.deviceSessionId,
          tickIndex: tick,
          frameIndex: index,
          atMs: index * session.schedule.frameDurationMs,
        });
      }
    }
    // The session's frame index is the frame CONTAINING the new time, which
    // can be ahead of the last STARTED frame when the window ends inside a
    // later frame.
    frameIndex = Math.floor(toMs / session.schedule.frameDurationMs);
    tickIndex = Math.floor(frameIndex / session.schedule.tickCadence);
  }
  const content = contentOf(session);
  const next = DeviceSessionContentSchema.parse({
    ...content,
    virtualTimeMs: toMs,
    frameIndex,
    tickIndex,
    eventSequence: session.eventSequence + events.length,
  });
  return {
    ok: true,
    value: {
      session: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
      events,
    },
  };
}
