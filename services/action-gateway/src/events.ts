/**
 * The action lifecycle event vocabulary over the W010 event shapes (the
 * W022 dispatch pin: "action:* events — one action = one stream
 * (stream:action-<suffix>); digests mirror computeEventDigest and are
 * admitted by the real sealEvent (runtime parity tests, W036 pattern)").
 *
 * - `ActionEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied instant).
 *   The reserved `action` namespace admits exactly ONE kernel payload
 *   kind — `action:lifecycle` (W010 src/subjects.ts) — so the gateway's
 *   entire vocabulary is `action:lifecycle` facts with the W010 phase
 *   vocabulary (proposed / authorized / rejected / executed /
 *   effects-recorded / failed) plus TYPED detail payloads. Events are
 *   FACTS — there is no mutation API.
 * - One action = one stream (`stream:action-<suffix>`, derived
 *   deterministically by {@link actionStreamIdOf}).
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time via
 *   the mirrored grammars, runtime via test/events.parity.test.ts (the
 *   same fixtures seal through the REAL W010 sealEvent and digest
 *   identically through the REAL computeEventDigest).
 */
import { z } from 'zod';
import {
  ActionTypeReferenceSchema,
  ProposalReferenceSchema,
} from '@epoch/action-protocol';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/action-policy';
import { TenantIdSchema } from '@epoch/tenancy';
import { gatewayValidationError, zodIssuesToGatewayIssues } from './issues';
import {
  ACTION_EVENT_PHASES,
  ACTION_ID_PATTERN,
  ACTION_LIFECYCLE_EVENT_KIND,
  GATEWAY_RECORD_VERSION,
} from './version';
import type { ActionEventPhase, ActionStatus } from './version';
import type { GatewayResult } from './types';

/** The mirrored W010 stream grammar (`stream:<slug>`). */
export const ACTION_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/** The mirrored W009/W010 principal actor grammar. */
export const ACTION_EVENT_ACTOR_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Derive the event stream id of one action: `stream:action-<suffix>` where
 * the suffix is the action id's slug (the action id grammar bounds the
 * suffix so the derived stream id always satisfies the W010 stream
 * grammar). Deterministic: the same action id always maps to the same
 * stream.
 */
export function actionStreamIdOf(actionId: string): string {
  return `stream:action-${actionId.slice('action:'.length)}`;
}

/** One action event sequence number (1-based, contiguous per stream). */
export const ActionEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers');

/** The causal parent reference of an action event (strictly earlier in-stream). */
export const ActionEventCausalParentSchema = z
  .strictObject({
    streamId: z.string().regex(ACTION_STREAM_ID_PATTERN),
    sequence: ActionEventSequenceSchema,
  })
  .readonly();

/** The typed payload of an action event (the W010 action:lifecycle shape). */
export const ActionEventPayloadSchema = z
  .strictObject({
    discriminator: z.literal(ACTION_LIFECYCLE_EVENT_KIND),
    data: z
      .strictObject({
        action: ProposalReferenceSchema,
        actionType: ActionTypeReferenceSchema,
        phase: z.enum(ACTION_EVENT_PHASES),
        detail: z.record(z.string().min(1).max(256), JsonValueSchema).optional(),
      })
      .readonly(),
  })
  .readonly();

/** One action event payload. */
export type ActionEventPayload = z.infer<typeof ActionEventPayloadSchema>;

/**
 * The shared action-event shape (the sealed record extends it with the
 * content digest).
 */
const actionEventShape = z.strictObject({
  schemaVersion: z.literal(GATEWAY_RECORD_VERSION),
  streamId: z.string().regex(ACTION_STREAM_ID_PATTERN),
  sequence: ActionEventSequenceSchema,
  tenantId: TenantIdSchema,
  actor: z.string().regex(ACTION_EVENT_ACTOR_PATTERN),
  causalParent: ActionEventCausalParentSchema.nullable(),
  payload: ActionEventPayloadSchema,
  occurredAt: TimestampSchema,
});

/** A same-stream causal parent must be strictly earlier. */
function refineActionEventShape(
  event: { streamId: string; sequence: number; causalParent: { streamId: string; sequence: number } | null },
  ctx: z.RefinementCtx,
): void {
  if (
    event.causalParent !== null &&
    event.causalParent.streamId === event.streamId &&
    event.causalParent.sequence >= event.sequence
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'a same-stream causal parent must be strictly earlier',
      path: ['causalParent'],
    });
  }
}

/**
 * The immutable content of one action event — the STRUCTURAL MIRROR of
 * W010's `EventContent` (schemaVersion discriminator, stream, sequence,
 * tenant scope, principal actor, causal parent, action:lifecycle payload,
 * producer-supplied occurrence instant).
 */
export const ActionEventContentSchema = actionEventShape
  .readonly()
  .superRefine(refineActionEventShape);

/** One action event content. */
export type ActionEventContent = z.infer<typeof ActionEventContentSchema>;

/**
 * The SEALED action event record: content plus its SHA-256 digest over the
 * canonical JSON of the content (the exact-revision content address —
 * identical to W010's computeEventDigest for the same content, pinned by
 * the runtime parity test).
 */
export const SealedActionEventSchema = actionEventShape
  .extend({
    contentDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .superRefine(refineActionEventShape);

/** One sealed action event. */
export type SealedActionEvent = z.infer<typeof SealedActionEventSchema>;

/**
 * Compute the content digest of an action event: the SHA-256 of its
 * canonical JSON serialization — identical to W010's computeEventDigest
 * for the same content (pinned by the runtime parity test). Throws on
 * invalid content; producers validate first ({@link sealActionEvent} is
 * the total form).
 */
export function computeActionEventDigest(event: ActionEventContent): Sha256Hex {
  const parsed = ActionEventContentSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid action event (validate first — sealActionEvent is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid action-event content into its published record. Total. */
export function sealActionEvent(event: unknown): GatewayResult<SealedActionEvent> {
  const parsed = ActionEventContentSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, error: gatewayValidationError(zodIssuesToGatewayIssues(parsed.error)) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed action event (tamper detection — `digest-mismatch`). */
export function verifySealedActionEvent(sealed: unknown): GatewayResult<SealedActionEvent> {
  const parsed = SealedActionEventSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: gatewayValidationError(zodIssuesToGatewayIssues(parsed.error)) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed action event digest does not match its content — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Validate one action id (the `action:<slug>` grammar); null when valid. */
export function actionIdIssue(actionId: string): string | null {
  return ACTION_ID_PATTERN.test(actionId)
    ? null
    : `action ids must match ${ACTION_ID_PATTERN.toString()} (one action = one stream: stream:action-<suffix>)`;
}

/** The action status → terminal event phase mapping (reads/tests convenience). */
export function terminalPhaseOf(status: ActionStatus): ActionEventPhase {
  switch (status) {
    case 'denied':
    case 'rejected':
    case 'approval-expired':
      return 'rejected';
    case 'executed':
      return 'executed';
    case 'failed':
      return 'failed';
    default:
      return 'proposed';
  }
}

export type { ActionEventPhase } from './version';

/** The minimal decision shape the typed-detail helpers read. */
export interface SealedDecisionLike {
  readonly contentDigest: Sha256Hex;
  readonly policySetDigest: Sha256Hex;
  readonly outcome: string;
}

/** The typed detail of an intake event. */
export function intakeEventDetail(decision: SealedDecisionLike): Record<string, JsonValue> {
  return {
    decisionDigest: decision.contentDigest,
    policySetDigest: decision.policySetDigest,
    outcome: decision.outcome,
  };
}

/** The typed detail of an authorization event. */
export function authorizationEventDetail(
  decision: SealedDecisionLike,
  via: 'policy-allow' | 'human-approval',
  approvals?: number,
): Record<string, JsonValue> {
  const detail: Record<string, JsonValue> = { decisionDigest: decision.contentDigest, via };
  if (approvals !== undefined) {
    detail.approvals = approvals;
  }
  return detail;
}

/** The typed detail of a rejection event. */
export function rejectionEventDetail(
  decision: SealedDecisionLike,
  via: 'policy-deny' | 'human-rejection' | 'approval-timeout',
  denialCode?: string,
): Record<string, JsonValue> {
  const detail: Record<string, JsonValue> = { decisionDigest: decision.contentDigest, via };
  if (denialCode !== undefined) {
    detail.denialCode = denialCode;
  }
  return detail;
}

/** The typed detail of an outcome event. */
export function outcomeEventDetail(outcome: {
  readonly contentDigest: Sha256Hex;
  readonly kind: 'succeeded' | 'failed';
  readonly failure?: { readonly code: string } | undefined;
  readonly evidenceRefs: readonly string[];
}): Record<string, JsonValue> {
  return {
    outcomeDigest: outcome.contentDigest,
    outcomeKind: outcome.kind,
    ...(outcome.failure !== undefined ? { failureCode: outcome.failure.code } : {}),
    evidenceRefs: [...outcome.evidenceRefs],
  };
}
