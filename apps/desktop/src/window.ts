/**
 * The typed desktop window model (W017 host-shell contract).
 *
 * A window is a SHELL SURFACE, not a native toolkit object: its lifecycle
 * is a closed typed state machine (WINDOW_TRANSITIONS), its geometry is
 * neutral presentation data, and its render hosting is a W013 renderer
 * session binding (negotiated at open, addressed by digest). Every window
 * record is content-addressed (canonical JSON -> SHA-256) and carries
 * provenance, so a window state is exact-revision addressable evidence.
 *
 * Deterministic derivation: the W013 device-session and renderer-session
 * ids are derived from the window id (never caller-supplied), so the same
 * window always binds the same sessions — identical inputs produce
 * identical digests, and session snapshots replay byte-identically.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { z } from 'zod';
import {
  bindRendererSession,
  type RendererBinding,
} from '@epoch/renderer-runtime';
import type { DeviceDescriptor, TenantScope } from '@epoch/experience-protocol';
import {
  desktopOk,
  invalidTransitionError,
  type DesktopResult,
} from './errors';
import {
  DesktopRecordVersionSchema,
  WINDOW_STATES,
  WINDOW_TRANSITIONS,
  type WindowEvent,
  type WindowState,
} from './version';
import {
  DeviceSessionIdSchema,
  DesktopSessionIdSchema,
  ProvenanceSchema,
  RendererSessionIdSchema,
  VirtualTimeMsSchema,
  WindowBoundsSchema,
  WindowIdSchema,
  type Provenance,
  type WindowId,
} from './primitives';

/** Schema-name discriminator carried by every window record. */
export const WINDOW_RECORD_SCHEMA_NAME = 'epoch.desktop.window-record' as const;

/** The renderer-session id derived from a window id (`win-x` -> `rs-x`). */
export function rendererSessionIdOf(windowId: WindowId): string {
  return windowId.replace(/^win-/, 'rs-');
}

/** The device-session id derived from a window id (`win-x` -> `ds-x`). */
export function deviceSessionIdOf(windowId: WindowId): string {
  return windowId.replace(/^win-/, 'ds-');
}

/** The window lifecycle gate (the closed transition table). */
export function isLegalWindowTransition(state: WindowState, event: WindowEvent): boolean {
  return WINDOW_TRANSITIONS[state].includes(event);
}

/** The next state of one legal window transition. */
export function nextWindowState(event: WindowEvent): WindowState {
  switch (event) {
    case 'opened':
      return 'open';
    case 'focused':
      return 'focused';
    case 'blurred':
      return 'blurred';
    case 'close-requested':
      return 'closing';
    case 'closed':
      return 'closed';
  }
}

/** The window-record content (digest-sealed form). */
export const WindowRecordContentSchema = z
  .strictObject({
    schema: z.literal(WINDOW_RECORD_SCHEMA_NAME),
    schemaVersion: DesktopRecordVersionSchema,
    windowId: WindowIdSchema,
    /** Owning shell session (opaque dss id). */
    sessionId: DesktopSessionIdSchema,
    /** Human-facing title (presentation data only). */
    title: z.string().min(1).max(256),
    state: z.enum(WINDOW_STATES),
    createdAtMs: VirtualTimeMsSchema,
    focusedAtMs: VirtualTimeMsSchema.optional(),
    closedAtMs: VirtualTimeMsSchema.optional(),
    bounds: WindowBoundsSchema.optional(),
    /** The derived W013 session ids (deterministic). */
    deviceSessionId: DeviceSessionIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    provenance: ProvenanceSchema,
  })
  .meta({
    id: 'DesktopWindowRecordContent',
    title: 'DesktopWindowRecordContent',
    description:
      'The content of a desktop window record: lifecycle state, neutral geometry, derived W013 session ids, and provenance.',
  });

/** One window-record content. */
export type WindowRecordContent = z.infer<typeof WindowRecordContentSchema>;

/** The sealed window record: content plus its SHA-256 digest. */
export const WindowRecordSchema = WindowRecordContentSchema.extend({
  digest: z.string().regex(/^[0-9a-f]{64}$/),
}).meta({
  id: 'DesktopWindowRecord',
  title: 'DesktopWindowRecord',
  description: 'The sealed desktop window record: content plus its SHA-256 content digest.',
});

/** One sealed window record. */
export type WindowRecord = z.infer<typeof WindowRecordSchema>;

/** The content of a sealed record (digest excluded). */
function windowContent(record: WindowRecord): JsonValue {
  const { digest: _claimed, ...content } = record;
  void _claimed;
  return content as unknown as JsonValue;
}

/** Seal a valid window-record content (computes the digest). */
export function sealWindowRecord(content: WindowRecordContent): WindowRecord {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/** Verify a sealed window record (tamper detection). */
export function verifyWindowRecord(record: WindowRecord): boolean {
  return canonicalDigest(windowContent(record)) === record.digest;
}

/** Total window-record admission (version gate -> schema gate -> digest gate). */
export function parseWindowRecord(input: unknown): DesktopResult<WindowRecord> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const encountered = (input as Record<string, unknown>).schemaVersion;
    if (encountered !== undefined && encountered !== 1) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `record version mismatch: expected 1, encountered ${String(encountered)}`,
          expected: '1',
          encountered: String(encountered),
        },
      };
    }
    const schemaName = (input as Record<string, unknown>).schema;
    if (schemaName !== undefined && schemaName !== WINDOW_RECORD_SCHEMA_NAME) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `schema discriminator mismatch: expected ${WINDOW_RECORD_SCHEMA_NAME}, encountered ${String(schemaName)}`,
          expected: WINDOW_RECORD_SCHEMA_NAME,
          encountered: String(schemaName),
        },
      };
    }
  }
  const parsed = WindowRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'window record failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  if (!verifyWindowRecord(parsed.data)) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'window record digest does not match its content — the record is rejected (tamper detection)',
        path: '$',
        expected: canonicalDigest(windowContent(parsed.data)),
        encountered: parsed.data.digest,
      },
    };
  }
  return desktopOk(parsed.data);
}

/** Apply one window lifecycle event to a window record (pure: new record). */
export function applyWindowEvent(
  record: WindowRecord,
  event: WindowEvent,
  atMs: number,
): DesktopResult<WindowRecord> {
  if (!isLegalWindowTransition(record.state, event)) {
    return { ok: false, error: invalidTransitionError('window', record.state, event) };
  }
  const next = nextWindowState(event);
  const { digest: _stale, ...content } = record;
  void _stale;
  const updated: WindowRecordContent = {
    ...content,
    state: next,
    focusedAtMs: event === 'focused' ? atMs : record.focusedAtMs,
    closedAtMs: event === 'closed' ? atMs : record.closedAtMs,
  };
  return desktopOk(sealWindowRecord(updated));
}

/**
 * Bind a renderer session for one window (W013 negotiation,
 * deterministic): the device-session snapshot is derived from the window
 * id, the session's tenant scope, and the session's device descriptor.
 * The renderer descriptor arrives as an opaque document and is validated
 * by the W013 binding admission (typed `malformed-record` rejections).
 */
export function bindWindowRenderer(options: {
  readonly windowId: WindowId;
  readonly tenantScope: TenantScope;
  readonly renderer: unknown;
  readonly device: DeviceDescriptor;
  readonly boundAtMs: number;
}): DesktopResult<RendererBinding> {
  const bound = bindRendererSession({
    rendererSessionId: rendererSessionIdOf(options.windowId),
    renderer: options.renderer,
    device: {
      deviceSessionId: deviceSessionIdOf(options.windowId),
      tenantScope: options.tenantScope,
      device: options.device,
    },
    boundAtMs: options.boundAtMs,
  });
  if (!bound.ok) {
    return {
      ok: false,
      error: {
        code: 'invocation-rejected',
        message: `the renderer runtime denied the window binding (${bound.error.code}): ${bound.error.message}`,
        cause: bound.error,
      },
    };
  }
  return desktopOk(bound.value);
}

/** The provenance type re-export (window records carry it). */
export type { Provenance };
