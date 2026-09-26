/**
 * @epoch/action-gateway — runtime zod validators for the host-model types
 * (action entries and the whole-host snapshot; the outcome records live in
 * src/outcomes.ts, the events in src/events.ts). Strict object shapes:
 * unknown structural fields are rejected, so provider/vendor semantics
 * cannot enter host types through this door.
 */
import { z } from 'zod';
import {
  ActionProposalSchema,
  ActionTypeReferenceSchema,
  ProposalReferenceSchema,
} from '@epoch/action-protocol';
import { ActionPolicySnapshotSchema, TimestampSchema } from '@epoch/action-policy';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ACTION_ID_PATTERN,
  ACTION_STATUSES,
  GATEWAY_RECORD_VERSION,
} from './version';
import { ACTION_STREAM_ID_PATTERN, SealedActionEventSchema, actionStreamIdOf } from './events';
import { SealedActionOutcomeRecordSchema } from './outcomes';
import { gatewayValidationError, rePathedIssues } from './issues';
import type { ActionEntry, GatewayResult, GatewaySnapshot } from './types';

/** One hosted action entry (the host model over the kernel records). */
export const ActionEntrySchema = z
  .strictObject({
    schemaVersion: z.literal(GATEWAY_RECORD_VERSION),
    actionId: z.string().regex(ACTION_ID_PATTERN),
    tenantId: TenantIdSchema,
    actionType: ActionTypeReferenceSchema,
    proposal: ActionProposalSchema,
    proposalRef: ProposalReferenceSchema,
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    status: z.enum(ACTION_STATUSES),
    streamId: z.string().regex(ACTION_STREAM_ID_PATTERN),
    outcome: SealedActionOutcomeRecordSchema.optional(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((entry, ctx) => {
    if (entry.streamId !== actionStreamIdOf(entry.actionId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the stream id must be the action id\'s derived stream (stream:action-<suffix>)',
        path: ['streamId'],
      });
    }
    if (entry.status === 'executed' && entry.outcome?.kind !== 'succeeded') {
      ctx.addIssue({
        code: 'custom',
        message: 'an executed action carries a succeeded outcome record',
        path: ['outcome'],
      });
    }
    if (entry.status === 'failed' && entry.outcome?.kind !== 'failed') {
      ctx.addIssue({
        code: 'custom',
        message: 'a failed action carries a failed outcome record',
        path: ['outcome'],
      });
    }
    if (entry.status !== 'executed' && entry.status !== 'failed' && entry.outcome !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a dispatched action carries an outcome record',
        path: ['outcome'],
      });
    }
  });

/** The deterministic whole-host snapshot. */
export const GatewaySnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(GATEWAY_RECORD_VERSION),
    registry: ActionPolicySnapshotSchema,
    actions: z.array(ActionEntrySchema).readonly(),
    events: z.array(SealedActionEventSchema).readonly(),
  })
  .readonly();

/** Parse + validate one action entry (snapshot restore path). */
export function parseActionEntry(input: unknown, path: string): GatewayResult<ActionEntry> {
  const parsed = ActionEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: gatewayValidationError(rePathedIssues(parsed.error, path)) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse + validate a whole snapshot envelope. */
export function parseGatewaySnapshot(input: unknown): GatewayResult<GatewaySnapshot> {
  const parsed = GatewaySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: gatewayValidationError(rePathedIssues(parsed.error, '$')) };
  }
  return { ok: true, value: parsed.data };
}
