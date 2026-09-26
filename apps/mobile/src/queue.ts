/**
 * @epoch/mobile — the offline queue (Work Order W018 Tech Lead pin:
 * "capture/approval intents queue as typed, content-addressed, idempotent
 * records (duplicate capture = sealed prior record)").
 *
 * The queue is an INTENT LOG, never a second semantic store (lock rules
 * 8/16): a queue record references its payload by CONTENT DIGEST and
 * carries replay bookkeeping only. The payload semantics stay in the
 * payload's own sealed record (a capture envelope or a field review
 * proposal) — sync admission (src/sync.ts) replays those through the
 * kernel seams.
 *
 * Idempotency is content-addressed:
 * - enqueuing a capture whose envelope digest is ALREADY queued returns the
 *   SEALED PRIOR queue record (the typed `duplicate-capture` outcome —
 *   never a second record, never a mutation);
 * - enqueuing an approval-intent whose proposal digest is already queued
 *   is the same idempotent replay (the prior record returned).
 *
 * Tenant isolation (R12): queue records are tenant-scoped; cross-tenant
 * admissions are typed `cross-tenant-denied`. Tampering is typed
 * `digest-mismatch`.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { PrincipalIdSchema, Sha256HexSchema } from '@epoch/solution-delivery';
import {
  crossTenantDeniedError,
  digestMismatchError,
  fieldError,
  fieldOk,
  fieldValidationError,
  hasUnrecognizedKeys,
  vendorFieldsError,
  type MobileFieldResult,
} from './errors';
import { FieldQueueIdSchema, FieldSessionIdSchema } from './primitives';
import {
  FieldQueueIntentKindSchema,
  FieldQueueReplayStateSchema,
  MOBILE_FIELD_RECORD_VERSION,
  type FieldQueueIntentKind,
  type FieldQueueReplayState,
} from './version';
import { verifySealedFieldCapture, type SealedFieldCapture } from './capture';
import {
  verifySealedFieldReviewProposal,
  type SealedFieldReviewProposal,
} from './approval';

/** The serialized schema name of an offline queue record. */
export const FIELD_QUEUE_RECORD_SCHEMA_NAME = 'field.queue-record' as const;

/** Upper bound on queued records per tenant (DoS discipline). */
export const MAX_QUEUE_RECORDS = 4096;

/**
 * The replay outcome of one queue record: pending (never replayed),
 * admitted (the kernel seams accepted the replay), or rejected (a typed
 * rejection was recorded — the payload stays queued for operator review).
 */
export const FieldQueueReplaySchema = z
  .strictObject({
    state: FieldQueueReplayStateSchema,
    /** The instant of the LAST replay attempt (caller-supplied). */
    replayedAt: TimestampSchema,
    /** The digest the replay produced (kernel record digest or error identity), when replayed. */
    replayDigest: Sha256HexSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'FieldQueueReplay',
    title: 'FieldQueueReplay',
    description: 'The replay bookkeeping of one offline queue record (state + last attempt provenance).',
  });

/** One queue replay. */
export type FieldQueueReplay = z.infer<typeof FieldQueueReplaySchema>;

/** The immutable content of one queue record (everything except the digest). */
const fieldQueueRecordShape = z.strictObject({
  schema: z.literal(FIELD_QUEUE_RECORD_SCHEMA_NAME),
  schemaVersion: z.literal(MOBILE_FIELD_RECORD_VERSION),
  recordId: FieldQueueIdSchema,
  tenantId: TenantIdSchema,
  sessionId: FieldSessionIdSchema,
  /** The intent kind: replaying a capture, or an approval proposal. */
  intent: FieldQueueIntentKindSchema,
  /** The content digest of the SEALED payload (capture envelope or review proposal). */
  payloadDigest: Sha256HexSchema,
  /** The payload's own opaque identity (capture id or review proposal id). */
  payloadId: z.string().min(1).max(128),
  enqueuedBy: PrincipalIdSchema,
  enqueuedAt: TimestampSchema,
  /** Replay bookkeeping — absent until the first sync attempt. */
  replay: FieldQueueReplaySchema.optional(),
});

export const FieldQueueRecordContentSchema = fieldQueueRecordShape
  .readonly()
  .meta({
    id: 'FieldQueueRecordContent',
    title: 'FieldQueueRecordContent',
    description:
      'The immutable content of one offline queue record: intent kind, the sealed payload referenced by digest + opaque id, enqueue provenance, and replay bookkeeping.',
  });

/** One queue record content. */
export type FieldQueueRecordContent = z.infer<typeof FieldQueueRecordContentSchema>;

/** The sealed queue record: content plus its SHA-256 content digest. */
export const SealedFieldQueueRecordSchema = z
  .strictObject({
    ...fieldQueueRecordShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedFieldQueueRecord',
    title: 'SealedFieldQueueRecord',
    description:
      'The sealed offline queue record: immutable intent content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed queue record. */
export type SealedFieldQueueRecord = z.infer<typeof SealedFieldQueueRecordSchema>;

/** Options to enqueue a capture intent. */
export interface EnqueueCaptureOptions {
  readonly recordId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly enqueuedBy: string;
  readonly enqueuedAt: string;
}

/** Options to enqueue an approval intent (the same provenance shape). */
export type EnqueueApprovalOptions = EnqueueCaptureOptions;

/**
 * The typed duplicate outcome: the queue already holds this exact payload
 * (same content digest) — the SEALED PRIOR record is returned unchanged
 * (idempotent enqueue; the queue never mutates).
 */
export interface DuplicateQueueOutcome {
  readonly kind: 'duplicate-capture';
  readonly prior: SealedFieldQueueRecord;
}

/** The enqueue result: a (possibly new) sealed record, or a typed error. */
export type EnqueueResult =
  | { readonly ok: true; readonly value: SealedFieldQueueRecord }
  | { readonly ok: true; readonly duplicate: DuplicateQueueOutcome }
  | { readonly ok: false; readonly error: import('./errors').MobileFieldError };

/** Seal (validated) content into a queue record. */
function sealQueueRecord(content: FieldQueueRecordContent): SealedFieldQueueRecord {
  return { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** The in-memory offline queue (the reference host's intent log). */
export class OfflineQueue {
  private readonly expectedTenantId: string | undefined;
  private readonly records: SealedFieldQueueRecord[] = [];

  constructor(options: { readonly expectedTenantId?: string | undefined } = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /**
   * Enqueue a CAPTURE intent (a sealed capture envelope). Idempotent by
   * payload digest: a duplicate enqueue returns the sealed PRIOR record
   * (typed `duplicate-capture` outcome — never a second record).
   */
  enqueueCapture(
    capture: SealedFieldCapture,
    options: EnqueueCaptureOptions,
  ): EnqueueResult {
    const verified = verifySealedFieldCapture(capture);
    if (!verified.ok) {
      return verified;
    }
    const envelope = verified.value;
    const tenant = this.tenantGuard(envelope.tenantId);
    if (!tenant.ok) {
      return tenant;
    }
    const prior = this.findByPayloadDigest(envelope.contentDigest);
    if (prior !== undefined) {
      return { ok: true, duplicate: { kind: 'duplicate-capture', prior } };
    }
    return this.append({
      recordId: options.recordId,
      tenantId: envelope.tenantId,
      sessionId: envelope.sessionId,
      intent: 'capture-intent',
      payloadDigest: envelope.contentDigest,
      payloadId: envelope.captureId,
      enqueuedBy: options.enqueuedBy,
      enqueuedAt: options.enqueuedAt,
    });
  }

  /**
   * Enqueue an APPROVAL intent (a sealed field review proposal). Idempotent
   * by payload digest: a duplicate enqueue returns the sealed PRIOR record.
   */
  enqueueApproval(
    proposal: SealedFieldReviewProposal,
    options: EnqueueApprovalOptions,
  ): EnqueueResult {
    const verified = verifySealedFieldReviewProposal(proposal);
    if (!verified.ok) {
      return verified;
    }
    const review = verified.value;
    const tenant = this.tenantGuard(review.tenantId);
    if (!tenant.ok) {
      return tenant;
    }
    const prior = this.findByPayloadDigest(review.contentDigest);
    if (prior !== undefined) {
      return { ok: true, duplicate: { kind: 'duplicate-capture', prior } };
    }
    return this.append({
      recordId: options.recordId,
      tenantId: review.tenantId,
      sessionId: review.sessionId,
      intent: 'approval-intent',
      payloadDigest: review.contentDigest,
      payloadId: review.proposalId,
      enqueuedBy: options.enqueuedBy,
      enqueuedAt: options.enqueuedAt,
    });
  }

  /** Tenant guard (typed cross-tenant-denied rejection). */
  private tenantGuard(tenantId: string): MobileFieldResult<true> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return fieldError(crossTenantDeniedError(this.expectedTenantId, tenantId));
    }
    return { ok: true, value: true };
  }

  /** Append + seal one queue record (bounded, deterministic). */
  private append(content: Omit<FieldQueueRecordContent, 'schema' | 'schemaVersion'>): EnqueueResult {
    if (this.records.length >= MAX_QUEUE_RECORDS) {
      return fieldError({
        code: 'validation',
        message: `the offline queue is bounded at ${MAX_QUEUE_RECORDS} records`,
      });
    }
    if (this.records.some((record) => record.recordId === content.recordId)) {
      return fieldError({
        code: 'version-conflict',
        message: `queue record id "${content.recordId}" is already used — queue record ids are one-shot`,
        recordId: content.recordId,
      });
    }
    const full: FieldQueueRecordContent = {
      schema: FIELD_QUEUE_RECORD_SCHEMA_NAME,
      schemaVersion: MOBILE_FIELD_RECORD_VERSION,
      ...content,
    };
    const parsed = FieldQueueRecordContentSchema.safeParse(full);
    if (!parsed.success) {
      if (hasUnrecognizedKeys(parsed.error)) {
        return fieldError(vendorFieldsError(parsed.error));
      }
      return fieldError(fieldValidationError(parsed.error));
    }
    const sealed = sealQueueRecord(parsed.data);
    this.records.push(sealed);
    return { ok: true, value: sealed };
  }

  /** Find a queued record by payload digest (idempotency lookup). */
  private findByPayloadDigest(payloadDigest: Sha256Hex): SealedFieldQueueRecord | undefined {
    return this.records.find((record) => record.payloadDigest === payloadDigest);
  }

  /** All queue records (deterministic enqueue order). */
  all(): readonly SealedFieldQueueRecord[] {
    return [...this.records];
  }

  /** The pending (never-replayed) records, in enqueue order. */
  pending(): readonly SealedFieldQueueRecord[] {
    return this.records.filter((record) => record.replay === undefined);
  }

  /**
   * Record the replay outcome of one queue record: returns the NEXT sealed
   * record state (immutable update — the replay history chains by digest).
   * Re-replaying an already-replayed record is IDEMPOTENT: the prior
   * sealed record is returned unchanged (duplicate replay = sealed prior).
   */
  replayed(
    record: SealedFieldQueueRecord,
    replay: FieldQueueReplay,
  ): MobileFieldResult<{ record: SealedFieldQueueRecord; duplicate: boolean }> {
    const verified = verifySealedFieldQueueRecord(record);
    if (!verified.ok) {
      return verified;
    }
    const current = verified.value;
    const index = this.records.findIndex((candidate) => candidate.recordId === current.recordId);
    if (index === -1) {
      return fieldError({
        code: 'validation',
        message: `queue record "${current.recordId}" is not held by this queue`,
        recordId: current.recordId,
      });
    }
    if (current.replay !== undefined) {
      // Idempotent replay: the sealed prior record is the answer.
      return fieldOk({ record: current, duplicate: true });
    }
    // The next content state: the prior sealed record's CONTENT (digest
    // stripped — the digest never covers itself) plus the replay outcome.
    const { contentDigest: _priorDigest, ...content } = current;
    void _priorDigest;
    const next: FieldQueueRecordContent = { ...content, replay };
    const sealed = sealQueueRecord(next);
    this.records[index] = sealed;
    return fieldOk({ record: sealed, duplicate: false });
  }

  /** The queue state snapshot (deterministic). */
  snapshot(): readonly SealedFieldQueueRecord[] {
    return this.all();
  }
}

/** Verify a sealed queue record (schema + digest recomputation). */
export function verifySealedFieldQueueRecord(
  sealed: unknown,
): MobileFieldResult<SealedFieldQueueRecord> {
  const parsed = SealedFieldQueueRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fieldError(digestMismatchError(expected, contentDigest));
  }
  return fieldOk(parsed.data);
}

export type { FieldQueueIntentKind, FieldQueueReplayState, Sha256Hex };
