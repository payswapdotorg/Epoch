/**
 * Execution outcome records (W022): the gateway records record-shaped
 * outcomes ONLY — typed success/failure records with evidence references,
 * content-addressed over the shared canonical machinery. The gateway never
 * implements side effects: the EFFECT is the adapter seam's (src/types.ts
 * ActionExecutionPort); this module owns the RECORD the gateway seals and
 * appends to the action entry.
 */
import { z } from 'zod';
import { ProposalReferenceSchema } from '@epoch/action-protocol';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/action-policy';
import { TenantIdSchema } from '@epoch/tenancy';
import { zodIssuesToGatewayIssues, gatewayValidationError, rePathedIssues } from './issues';
import { SHA256_HEX_PATTERN } from './events';
import { GATEWAY_RECORD_VERSION } from './version';
import { TimestampSchema } from '@epoch/action-policy';
import type { ActionOutcomeContent, GatewayResult, SealedActionOutcomeRecord } from './types';

/** The action id grammar (mirrored from src/version.ts for the schema). */
const ACTION_ID_SCHEMA_PATTERN = /^action:[a-z0-9][a-z0-9-]{0,55}$/;

/** The shared outcome shape (the sealed record extends it with the digest). */
const actionOutcomeShape = z.strictObject({
    schemaVersion: z.literal(GATEWAY_RECORD_VERSION),
    tenantId: TenantIdSchema,
    actionId: z.string().regex(ACTION_ID_SCHEMA_PATTERN),
    proposalRef: ProposalReferenceSchema,
    decisionDigest: z.string().regex(SHA256_HEX_PATTERN),
    kind: z.enum(['succeeded', 'failed']),
    failure: z
      .strictObject({
        code: z.string().min(1).max(128),
        reason: z.string().min(1).max(10000),
      })
      .readonly()
      .optional(),
    evidenceRefs: z.array(z.string().min(1).max(256)).readonly(),
    executedAt: TimestampSchema,
  });

/** Failure is present iff the outcome failed. */
function refineOutcomeShape(
  content: { kind: 'succeeded' | 'failed'; failure?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (content.kind === 'failed' && content.failure === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a failed outcome carries its typed failure',
      path: ['failure'],
    });
  }
  if (content.kind !== 'failed' && content.failure !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'only a failed outcome carries a failure',
      path: ['failure'],
    });
  }
}

/** The immutable content of one execution outcome record. */
export const ActionOutcomeContentSchema = actionOutcomeShape
  .readonly()
  .superRefine(refineOutcomeShape);

/** The sealed execution outcome record (content + digest). */
export const SealedActionOutcomeRecordSchema = actionOutcomeShape
  .extend({
    contentDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .superRefine(refineOutcomeShape);

/**
 * Compute the content digest of an outcome record. Throws on invalid
 * content; producers validate first ({@link sealActionOutcome} is the
 * total form).
 */
export function computeActionOutcomeDigest(content: ActionOutcomeContent): Sha256Hex {
  const parsed = ActionOutcomeContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid action outcome (validate first — sealActionOutcome is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid outcome content into its published record. Total. */
export function sealActionOutcome(content: unknown): GatewayResult<SealedActionOutcomeRecord> {
  const parsed = ActionOutcomeContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: gatewayValidationError(zodIssuesToGatewayIssues(parsed.error)) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed outcome record (tamper detection — `digest-mismatch`). */
export function verifySealedActionOutcome(sealed: unknown): GatewayResult<SealedActionOutcomeRecord> {
  const parsed = SealedActionOutcomeRecordSchema.safeParse(sealed);
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
        message: 'sealed action outcome digest does not match its content — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Re-path a zod failure under a base path (snapshot restore convenience). */
export function outcomeIssuesAt(
  error: Parameters<typeof rePathedIssues>[0],
  base: string,
): { path: string; message: string }[] {
  return rePathedIssues(error, base);
}
