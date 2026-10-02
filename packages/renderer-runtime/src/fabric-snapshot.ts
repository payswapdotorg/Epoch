/**
 * The RENDERER SESSION SNAPSHOT (W056) — the PORTABLE VIEW-STATE snapshot
 * that survives a renderer switch (the first step of the switching
 * invariant: "save canonical session snapshot").
 *
 * A snapshot carries:
 * - the canonical IDENTITY: which session produced it, which renderer, and
 *   the world projection reference (scene id + world digest + tenant) —
 *   the continuity anchor the target must match;
 * - the PORTABLE view state (semantic focus, layer visibility, timeline
 *   position, best-effort camera);
 * - the deterministic interaction counters (audit trail).
 *
 * A snapshot NEVER carries provider-native scene graphs, caches, handles,
 * or any semantic payload: those are disposable presentation state; the
 * target session re-mounts from the CANONICAL Epoch projection and then
 * restores exactly this portable subset.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  RENDERER_FABRIC_PROTOCOL_VERSION,
  RENDERER_SESSION_SNAPSHOT_SCHEMA_NAME,
  RendererFabricProtocolVersionSchema,
} from './version';
import { FabricSessionIdSchema } from './fabric-primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';
import { RendererIdSchema } from './primitives';
import { WorldProjectionRefSchema, type WorldProjectionRef } from './world-projection';
import { PortableViewStateSchema, type PortableViewState } from './portable-state';

/**
 * The content of a renderer session snapshot (everything except the digest).
 * The identity fields must be consistent with the session that captured it
 * (the fabric verifies this at capture time).
 */
export const RendererSessionSnapshotContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_SESSION_SNAPSHOT_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    /** The ephemeral fabric session that captured this snapshot. */
    fabricSessionId: FabricSessionIdSchema,
    /** The W013 renderer descriptor identity that captured this snapshot. */
    capturedFromRendererId: RendererIdSchema,
    /** The canonical world projection reference (identity continuity anchor). */
    worldProjection: WorldProjectionRefSchema,
    /** The portable view state (focus/layers/timeline/camera). */
    viewState: PortableViewStateSchema,
    /** Total fabric invocations admitted at capture time. */
    invocationCount: z.number().int().nonnegative(),
    /** Completed switches at capture time. */
    switchCount: z.number().int().nonnegative(),
    /** Virtual time the snapshot was captured at (caller-supplied). */
    capturedAtMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'RendererSessionSnapshotContent',
    title: 'RendererSessionSnapshotContent',
    description:
      'The content of a portable renderer session snapshot: source identity, canonical world projection reference, portable view state, and interaction counters.',
  });

/** One snapshot content. */
export type RendererSessionSnapshotContent = z.infer<
  typeof RendererSessionSnapshotContentSchema
>;

/**
 * The sealed renderer session snapshot: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 */
export const RendererSessionSnapshotSchema = RendererSessionSnapshotContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererSessionSnapshot',
  title: 'RendererSessionSnapshot',
  description:
    'The sealed portable renderer session snapshot: portable view state and canonical identity plus its SHA-256 content digest.',
});

/** One sealed session snapshot. */
export type RendererSessionSnapshot = z.infer<typeof RendererSessionSnapshotSchema>;

/** The input of {@link captureSessionSnapshotContent}. */
export interface CaptureSessionSnapshotInput {
  readonly fabricSessionId: string;
  readonly capturedFromRendererId: string;
  readonly worldProjection: WorldProjectionRef;
  readonly viewState: PortableViewState;
  readonly invocationCount: number;
  readonly switchCount: number;
  readonly capturedAtMs: number;
}

/**
 * Build the snapshot content of a session's portable state (deterministic,
 * pure). Total: invalid inputs yield a typed `invalid-fabric-record`
 * failure.
 */
export function captureSessionSnapshotContent(
  input: CaptureSessionSnapshotInput,
): { ok: true; value: RendererSessionSnapshotContent } | { ok: false; error: { code: 'invalid-fabric-record'; message: string; issues: { path: string; message: string }[] } } {
  const candidate = {
    schema: RENDERER_SESSION_SNAPSHOT_SCHEMA_NAME,
    fabricProtocolVersion: RENDERER_FABRIC_PROTOCOL_VERSION,
    fabricSessionId: input.fabricSessionId,
    capturedFromRendererId: input.capturedFromRendererId,
    worldProjection: input.worldProjection,
    viewState: input.viewState,
    invocationCount: input.invocationCount,
    switchCount: input.switchCount,
    capturedAtMs: input.capturedAtMs,
  };
  const parsed = RendererSessionSnapshotContentSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'invalid-fabric-record',
        message: 'renderer session snapshot failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Seal valid snapshot content (content + its SHA-256 content digest). */
export function sealRendererSessionSnapshot(
  content: RendererSessionSnapshotContent,
): RendererSessionSnapshot {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
