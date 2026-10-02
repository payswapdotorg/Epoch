/**
 * RENDERER SWITCHING records (W056) — the typed request and receipt of one
 * renderer switch, the two data halves of the switching invariant:
 *
 * ```
 * save canonical session snapshot
 *   -> resolve target renderer
 *   -> verify digest/tenant compatibility
 *   -> mount target from canonical projection
 *   -> restore portable focus/layers/timeline
 *   -> emit switch receipt
 *   -> dispose previous session
 * ```
 *
 * The switch itself never creates durable semantic state: the request is a
 * transient intent (never sealed, never persisted); the receipt is
 * content-addressed execution EVIDENCE (the record a host may keep) that
 * proves the identity continuity (same tenant, same world digest) and the
 * portable restore that happened — nothing more.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import {
  MAX_SWITCH_FALLBACKS,
  RENDERER_FABRIC_PROTOCOL_VERSION,
  RENDERER_SWITCH_RECEIPT_SCHEMA_NAME,
  RENDERER_SWITCH_REQUEST_SCHEMA_NAME,
  RendererFabricProtocolVersionSchema,
} from './version';
import { FabricSessionIdSchema, SwitchIdSchema } from './fabric-primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';
import { RendererIdSchema } from './primitives';
import { PortableViewStateFieldSchema } from './version';
import { PortableViewStateSchema, type PortableViewState } from './portable-state';
import type { TenantScope } from '@epoch/experience-protocol';

// ---------------------------------------------------------------------------
// The switch request (transient intent, never sealed).
// ---------------------------------------------------------------------------

/**
 * One renderer switch request: which session to switch FROM, which
 * renderer to switch TO, the EXPECTED world digest (the continuity claim
 * the fabric verifies against the captured snapshot and the canonical
 * projection), the expected tenant, and the ordered fallback chain (used
 * only when the primary target cannot mount; never silently — the receipt
 * records it).
 */
export const RendererSwitchRequestSchema = z
  .strictObject({
    schema: z.literal(RENDERER_SWITCH_REQUEST_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    switchId: SwitchIdSchema,
    /** The session to switch away from (retained if the switch aborts). */
    sourceFabricSessionId: FabricSessionIdSchema,
    /** The primary target renderer. */
    targetRendererId: RendererIdSchema,
    /** The canonical world digest the switch must preserve (continuity claim). */
    expectedWorldDigest: Sha256HexSchema,
    /** The tenant the switch must stay within. */
    expectedTenantId: z.string().min(1).max(256),
    /** The fabric session id of the target session (caller-scoped, deterministic). */
    targetFabricSessionId: FabricSessionIdSchema,
    /** Ordered fallback renderers (tried after the primary target fails; typed, recorded). */
    fallbackRendererIds: z
      .array(RendererIdSchema)
      .max(MAX_SWITCH_FALLBACKS)
      .refine(
        (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
        'fallbackRendererIds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Virtual time of the switch request (caller-supplied). */
    atMs: VirtualTimeMsSchema,
  })
  .superRefine((request, ctx) => {
    if (request.sourceFabricSessionId === request.targetFabricSessionId) {
      ctx.addIssue({
        code: 'custom',
        message: 'the target fabric session id must differ from the source (a switch creates a NEW session)',
        path: ['targetFabricSessionId'],
      });
    }
  })
  .meta({
    id: 'RendererSwitchRequest',
    title: 'RendererSwitchRequest',
    description:
      'One renderer switch request: source session, primary target renderer, expected world digest and tenant (continuity claims), target session id, ordered fallback chain, and virtual time.',
  });

/** One switch request. */
export type RendererSwitchRequest = z.infer<typeof RendererSwitchRequestSchema>;

// ---------------------------------------------------------------------------
// The switch receipt (content-addressed execution evidence).
// ---------------------------------------------------------------------------

/**
 * The content of a renderer switch receipt (everything except the digest):
 * the proven identity continuity (tenant + world digest), the from/to
 * renderers and sessions, the portable view-state fields actually restored
 * (capability-limited restores are LISTED, never silent), whether a
 * fallback produced the switch, and the disposed source session.
 */
export const RendererSwitchReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_SWITCH_RECEIPT_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    switchId: SwitchIdSchema,
    /** The renderer switched away from. */
    fromRendererId: RendererIdSchema,
    /** The renderer switched to (the primary target, or the fallback that mounted). */
    toRendererId: RendererIdSchema,
    /** The disposed source session. */
    fromFabricSessionId: FabricSessionIdSchema,
    /** The new target session (now the active presentation). */
    toFabricSessionId: FabricSessionIdSchema,
    /** The verified tenant scope (continuity proven). */
    tenantScope: TenantScopeSchema,
    /** The verified canonical world digest (continuity proven). */
    worldDigest: Sha256HexSchema,
    /** Digest of the source snapshot the switch consumed. */
    sourceSnapshotDigest: Sha256HexSchema,
    /** Digest of the canonical projection the target mounted. */
    mountedProjectionDigest: Sha256HexSchema,
    /** The portable view-state fields actually restored (sorted set). */
    restoredViewFields: z
      .array(PortableViewStateFieldSchema)
      .refine(
        (fields) => fields.every((f, i) => i === 0 || f > fields[i - 1]),
        'restoredViewFields must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** The view state carried across (the restore input, for audit). */
    restoredViewState: PortableViewStateSchema,
    /** Whether a fallback renderer (not the requested primary) completed the switch. */
    fallbackApplied: z.boolean(),
    /** Virtual time the switch completed at. */
    atMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'RendererSwitchReceiptContent',
    title: 'RendererSwitchReceiptContent',
    description:
      'The content of a renderer switch receipt: proven tenant/digest continuity, from/to sessions and renderers, restored portable view state, fallback flag, and virtual time.',
  });

/** One switch-receipt content. */
export type RendererSwitchReceiptContent = z.infer<typeof RendererSwitchReceiptContentSchema>;

/**
 * The sealed renderer switch receipt: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded).
 */
export const RendererSwitchReceiptSchema = RendererSwitchReceiptContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererSwitchReceipt',
  title: 'RendererSwitchReceipt',
  description:
    'The sealed renderer switch receipt: content-addressed execution evidence of one completed renderer switch.',
});

/** One sealed switch receipt. */
export type RendererSwitchReceipt = z.infer<typeof RendererSwitchReceiptSchema>;

/** Build the typed `invalid-fabric-record` failure value for zod issues. */
function invalidRecordFailure(message: string, issues: { path: string; message: string }[]) {
  return { code: 'invalid-fabric-record' as const, message, issues };
}

/** The input of {@link captureSwitchReceiptContent}. */
export interface CaptureSwitchReceiptInput {
  readonly switchId: string;
  readonly fromRendererId: string;
  readonly toRendererId: string;
  readonly fromFabricSessionId: string;
  readonly toFabricSessionId: string;
  readonly tenantScope: TenantScope;
  readonly worldDigest: string;
  readonly sourceSnapshotDigest: string;
  readonly mountedProjectionDigest: string;
  readonly restoredViewFields: readonly string[];
  readonly restoredViewState: PortableViewState;
  readonly fallbackApplied: boolean;
  readonly atMs: number;
}

/**
 * Build the switch-receipt content of one completed switch (deterministic,
 * pure). Total: invalid inputs yield a typed `invalid-fabric-record`
 * failure value.
 */
export function captureSwitchReceiptContent(
  input: CaptureSwitchReceiptInput,
): { ok: true; value: RendererSwitchReceiptContent } | { ok: false; error: ReturnType<typeof invalidRecordFailure> } {
  const candidate = {
    schema: RENDERER_SWITCH_RECEIPT_SCHEMA_NAME,
    fabricProtocolVersion: RENDERER_FABRIC_PROTOCOL_VERSION,
    switchId: input.switchId,
    fromRendererId: input.fromRendererId,
    toRendererId: input.toRendererId,
    fromFabricSessionId: input.fromFabricSessionId,
    toFabricSessionId: input.toFabricSessionId,
    tenantScope: input.tenantScope,
    worldDigest: input.worldDigest,
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    mountedProjectionDigest: input.mountedProjectionDigest,
    restoredViewFields: [...input.restoredViewFields].sort(),
    restoredViewState: input.restoredViewState,
    fallbackApplied: input.fallbackApplied,
    atMs: input.atMs,
  };
  const parsed = RendererSwitchReceiptContentSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: invalidRecordFailure(
        'renderer switch receipt failed schema validation',
        parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/** Seal valid switch-receipt content (content + its SHA-256 digest). */
export function sealRendererSwitchReceipt(
  content: RendererSwitchReceiptContent,
): RendererSwitchReceipt {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
