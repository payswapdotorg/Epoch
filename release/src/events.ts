/**
 * @epoch/release-kit — release events over the W010 shapes (Work Order W035).
 *
 * The readiness journal of one release candidate is ONE append-only event
 * stream (`stream:release-<slug>`) whose events are STRUCTURAL MIRRORS of
 * @epoch/event-log's `EventContent` (W010): stream, 1-based contiguous
 * sequence, tenant scope, principal actor, causal parent, namespaced
 * payload, producer-supplied instant. The payload family is
 * `release:readiness` with typed data per event kind:
 * checklist-derived -> item-completed* -> readiness-evaluated ->
 * release-published.
 *
 * The payload mirror follows the W023 usage-event pattern exactly: the
 * ENVELOPE is the generic W010 shape (discriminator + opaque JSON data
 * bag), and the TYPED family contract (`ReleaseEventDataSchema` +
 * `parseReleaseEventData`) selects the interpretation — so
 * `ReleaseEventContent` is TYPE-EQUAL to `EventContent` and release
 * events are admitted by the REAL W010 seal path (pinned by
 * test/parity.test.ts, never a runtime dependency).
 *
 * `foldReleaseEvents` is the deterministic REPLAY: sorting the records by
 * (streamId, sequence), parsing every payload through the family parser,
 * and folding produces the readiness state — the same fold over the same
 * events yields the same projection regardless of input order (the W031
 * replay discipline).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  READINESS_VERDICTS,
  RELEASE_EVENT_DISCRIMINATOR,
  RELEASE_EVENT_RECORD_VERSION,
  RELEASE_STREAM_ID_PATTERN,
} from './version';
import {
  ChecklistIdSchema,
  NonNegativeIntSchema,
  ReleaseIdSchema,
  digestOfJson,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { Sha256DigestSchema } from './provenance';

// --------------------------------------------------------------------------------
// The typed payload family (the release:readiness data contracts).
// --------------------------------------------------------------------------------

/** The `checklist-derived` payload: the deterministic derivation fact. */
export const ChecklistDerivedDataSchema = z
  .strictObject({
    kind: z.literal('checklist-derived'),
    releaseId: ReleaseIdSchema,
    checklistId: ChecklistIdSchema,
    checklistDigest: Sha256DigestSchema,
    itemCount: z.number().int().min(1),
  })
  .readonly();
export type ChecklistDerivedData = z.infer<typeof ChecklistDerivedDataSchema>;

/** The `item-completed` payload: one immutable completion transition. */
export const ItemCompletedDataSchema = z
  .strictObject({
    kind: z.literal('item-completed'),
    releaseId: ReleaseIdSchema,
    checklistId: ChecklistIdSchema,
    itemId: z.string().regex(/^item:[1-9][0-9]*:[a-z0-9-]+$/),
    checkKind: z.string().min(1).max(64),
    evidenceDigest: Sha256DigestSchema,
    completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    completedBy: z.string().regex(/^actor:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly();
export type ItemCompletedData = z.infer<typeof ItemCompletedDataSchema>;

/** The `readiness-evaluated` payload: the typed verdict fact. */
export const ReadinessEvaluatedDataSchema = z
  .strictObject({
    kind: z.literal('readiness-evaluated'),
    releaseId: ReleaseIdSchema,
    checklistId: ChecklistIdSchema,
    verdict: z.enum(READINESS_VERDICTS),
    completeItems: NonNegativeIntSchema,
    totalItems: z.number().int().min(1),
    evaluationDigest: Sha256DigestSchema,
  })
  .readonly();
export type ReadinessEvaluatedData = z.infer<typeof ReadinessEvaluatedDataSchema>;

/** The `release-published` payload: the sealed manifest fact. */
export const ReleasePublishedDataSchema = z
  .strictObject({
    kind: z.literal('release-published'),
    releaseId: ReleaseIdSchema,
    manifestId: z.string().regex(/^manifest:[0-9a-f]{16}$/),
    manifestDigest: Sha256DigestSchema,
    revision: z.string().regex(/^[0-9a-f]{40}$/),
    label: z.string().min(1).max(128),
  })
  .readonly();
export type ReleasePublishedData = z.infer<typeof ReleasePublishedDataSchema>;

/** The typed payload data of a `release:readiness` event (the family contract). */
export const ReleaseEventDataSchema = z.discriminatedUnion('kind', [
  ChecklistDerivedDataSchema,
  ItemCompletedDataSchema,
  ReadinessEvaluatedDataSchema,
  ReleasePublishedDataSchema,
]);
export type ReleaseEventData = z.infer<typeof ReleaseEventDataSchema>;

// --------------------------------------------------------------------------------
// The event content (the W010 EventContent shape, mirrored).
// --------------------------------------------------------------------------------

/** Opaque release stream identity — MIRRORED from the W010 grammar. */
export const ReleaseStreamIdSchema = z
  .string()
  .regex(RELEASE_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"');
export type ReleaseStreamId = z.infer<typeof ReleaseStreamIdSchema>;

/** One release event sequence number (1-based, contiguous per stream). */
export const ReleaseEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers');
export type ReleaseEventSequence = z.infer<typeof ReleaseEventSequenceSchema>;

/** The causal parent reference of a release event (strictly earlier). */
export const ReleaseCausalParentSchema = z
  .strictObject({
    streamId: ReleaseStreamIdSchema,
    sequence: ReleaseEventSequenceSchema,
  })
  .readonly();
export type ReleaseCausalParent = z.infer<typeof ReleaseCausalParentSchema>;

/** The acting principal of a release event (the W009 grammar, mirrored). */
export const ReleaseEventActorSchema = z
  .string()
  .regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/, 'must be a principal id of the form "principal:<slug>"');
export type ReleaseEventActor = z.infer<typeof ReleaseEventActorSchema>;

/**
 * The generic event payload of a release event — the W010 shape
 * (namespaced discriminator + opaque JSON data bag; the typed family
 * contract selects the interpretation via parseReleaseEventData).
 */
export const ReleaseEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly();
export type ReleaseEventPayload = z.infer<typeof ReleaseEventPayloadSchema>;

/**
 * The event content — a STRUCTURAL MIRROR of @epoch/event-log's
 * `EventContent` (pinned by test/parity.test.ts: compile-time type
 * equality + runtime admission through the REAL W010 seal path +
 * identical digests).
 */
export const ReleaseEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(RELEASE_EVENT_RECORD_VERSION),
    streamId: ReleaseStreamIdSchema,
    sequence: ReleaseEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: ReleaseEventActorSchema,
    causalParent: ReleaseCausalParentSchema.nullable(),
    payload: ReleaseEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly();
export type ReleaseEventContent = z.infer<typeof ReleaseEventContentSchema>;

/** The published event record: content plus its content address (W010). */
export const ReleaseEventRecordSchema = z
  .strictObject({
    event: ReleaseEventContentSchema,
    contentDigest: Sha256DigestSchema,
  })
  .readonly();
export type ReleaseEventRecord = z.infer<typeof ReleaseEventRecordSchema>;

// --------------------------------------------------------------------------------
// Construction + sealing + the typed family parser.
// --------------------------------------------------------------------------------

/** The release event stream id of a release candidate (deterministic). */
export function releaseEventStreamIdOf(releaseId: string): ReleaseStreamId {
  return `stream:release-${releaseId.slice('release:'.length)}`;
}

/**
 * Parse the typed `release:readiness` family data of a release event
 * payload (the W010 family-parser pattern): the discriminator must be
 * `release:readiness` and the data bag must validate through the typed
 * union.
 */
export function parseReleaseEventData(payload: ReleaseEventPayload): ReleaseResult<ReleaseEventData> {
  if (payload.discriminator !== RELEASE_EVENT_DISCRIMINATOR) {
    return releaseFail(
      'validation',
      `release event payload discriminator "${payload.discriminator}" is not "${RELEASE_EVENT_DISCRIMINATOR}"`,
    );
  }
  const parsed = ReleaseEventDataSchema.safeParse(payload.data);
  if (!parsed.success) {
    return releaseFail(
      'validation',
      `release event payload data failed the ${RELEASE_EVENT_DISCRIMINATOR} family validation: ${firstIssueText(parsed.error)}`,
    );
  }
  return { ok: true, value: parsed.data };
}

/** Compute the canonical digest of release event content. */
export function computeReleaseEventDigest(content: ReleaseEventContent): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

/** Seal one release event (validates content + adds the content address). */
export function sealReleaseEvent(content: unknown): ReleaseResult<ReleaseEventRecord> {
  const parsed = ReleaseEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return releaseFail('validation', `release event failed validation: ${firstIssueText(parsed.error)}`, {
      subject: 'event',
    });
  }
  return { ok: true, value: { event: parsed.data, contentDigest: computeReleaseEventDigest(parsed.data) } };
}

/** Verify a release event record's digest (tamper detection). */
export function verifyReleaseEventDigest(record: ReleaseEventRecord): ReleaseResult<ReleaseEventRecord> {
  const reparsed = ReleaseEventContentSchema.safeParse(record.event);
  if (!reparsed.success) {
    return releaseFail('validation', `release event failed validation: ${firstIssueText(reparsed.error)}`, {
      subject: `${record.event.streamId}#${record.event.sequence}`,
    });
  }
  const expected = computeReleaseEventDigest(reparsed.data);
  return expected === record.contentDigest
    ? { ok: true, value: record }
    : releaseFail('digest-mismatch', `event ${record.event.streamId}#${record.event.sequence}: digest does not match content (tampered event)`, {
        subject: `${record.event.streamId}#${record.event.sequence}`,
      });
}

// --------------------------------------------------------------------------------
// The deterministic fold (replay).
// --------------------------------------------------------------------------------

/** The replayed readiness state of one release event stream. */
export interface ReleaseReplay {
  readonly releaseId: string;
  readonly streamId: ReleaseStreamId;
  readonly eventCount: number;
  readonly lastSequence: number;
  readonly derived: { readonly checklistId: string; readonly checklistDigest: string; readonly itemCount: number } | null;
  readonly completedItems: readonly {
    readonly itemId: string;
    readonly checkKind: string;
    readonly evidenceDigest: string;
    readonly completedAt: string;
    readonly completedBy: string;
  }[];
  readonly evaluation: { readonly verdict: string; readonly completeItems: number; readonly totalItems: number; readonly evaluationDigest: string } | null;
  readonly published: { readonly manifestId: string; readonly manifestDigest: string; readonly revision: string; readonly label: string } | null;
}

/**
 * Fold release event records into the replayed readiness state
 * (deterministic): input order is IRRELEVANT (records sort by
 * (streamId, sequence) first); sequences must be contiguous 1..n and
 * single-stream (else the typed `validation` rejection); every payload
 * parses through the typed family parser; the fold is order-independent
 * and byte-reproducible.
 */
export function foldReleaseEvents(records: readonly ReleaseEventRecord[]): ReleaseResult<ReleaseReplay> {
  if (records.length === 0) {
    return releaseFail('validation', 'cannot fold an empty release event stream');
  }
  const sorted = [...records].sort((a, b) => {
    if (a.event.streamId !== b.event.streamId) return a.event.streamId < b.event.streamId ? -1 : 1;
    return a.event.sequence - b.event.sequence;
  });
  const streamId = sorted[0]!.event.streamId;
  if (sorted.some((record) => record.event.streamId !== streamId)) {
    return releaseFail('validation', 'release event fold received records from multiple streams', {
      subject: streamId,
    });
  }
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index]!.event.sequence !== index + 1) {
      return releaseFail('validation', `release event stream "${streamId}" is not contiguous at sequence ${index + 1}`, {
        subject: streamId,
      });
    }
  }

  let releaseId = '';
  let derived: ReleaseReplay['derived'] = null;
  const completedItems: {
    itemId: string;
    checkKind: string;
    evidenceDigest: string;
    completedAt: string;
    completedBy: string;
  }[] = [];
  let evaluation: ReleaseReplay['evaluation'] = null;
  let published: ReleaseReplay['published'] = null;

  for (const record of sorted) {
    const data = parseReleaseEventData(record.event.payload);
    if (!data.ok) {
      return releaseFail(data.error.code, `${data.error.message} (event ${record.event.streamId}#${record.event.sequence})`, {
        subject: `${record.event.streamId}#${record.event.sequence}`,
      });
    }
    const payload = data.value;
    if (releaseId === '') releaseId = payload.releaseId;
    if (payload.releaseId !== releaseId) {
      return releaseFail('validation', `release event stream "${streamId}" mixes releases "${releaseId}" and "${payload.releaseId}"`, {
        subject: streamId,
      });
    }
    switch (payload.kind) {
      case 'checklist-derived':
        derived = { checklistId: payload.checklistId, checklistDigest: payload.checklistDigest, itemCount: payload.itemCount };
        break;
      case 'item-completed':
        completedItems.push({
          itemId: payload.itemId,
          checkKind: payload.checkKind,
          evidenceDigest: payload.evidenceDigest,
          completedAt: payload.completedAt,
          completedBy: payload.completedBy,
        });
        break;
      case 'readiness-evaluated':
        evaluation = {
          verdict: payload.verdict,
          completeItems: payload.completeItems,
          totalItems: payload.totalItems,
          evaluationDigest: payload.evaluationDigest,
        };
        break;
      case 'release-published':
        published = {
          manifestId: payload.manifestId,
          manifestDigest: payload.manifestDigest,
          revision: payload.revision,
          label: payload.label,
        };
        break;
    }
  }

  const last = sorted[sorted.length - 1]!;
  return {
    ok: true,
    value: {
      releaseId,
      streamId,
      eventCount: sorted.length,
      lastSequence: last.event.sequence,
      derived,
      completedItems,
      evaluation,
      published,
    },
  };
}
