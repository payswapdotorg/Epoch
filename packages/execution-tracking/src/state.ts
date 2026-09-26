/**
 * Work-package/activity STATE TRACKING (W038 pin): typed, sealed,
 * append-only state records referencing ProgramOfWork work packages and
 * activities by OPAQUE ID — never structural copies of W036 records.
 *
 * - State transitions (not-started/in-progress/completed/blocked and the
 *   domain-mappable equivalents, src/version.ts) are RECORDED EVENTS
 *   with provenance (cause, note, observed/recorded instants, principal,
 *   evidence links, uncertainty): `fromState` must match the subject's
 *   current folded state and `toState` must be a legal arc of the
 *   {@link TRACKING_TRANSITIONS} table — an illegal arc is a typed
 *   `lifecycle-conflict` (the tracking chain is append-only and never
 *   rewritten).
 * - The activity's SCHEDULE AUTHORITY STAYS in ProgramOfWork: tracking
 *   records carry NO schedule fields (planned/actual dates, progress
 *   fractions, predecessors/successors) — declaring one is the typed
 *   `authority-violation-rejected` (src/issues.ts pre-classifier).
 *   Tracking records OBSERVE, never re-schedule.
 * - Every record carries the mandatory uncertainty state.
 * - Determinism: records are admitted in canonical recordId order; the
 *   fold never depends on admission order.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { ActivityIdSchema, StateIdSchema } from './primitives';
import { UncertaintyStateSchema } from '@epoch/solution-delivery';
import {
  EXECUTION_TRACKING_RECORD_VERSION,
  TRACKING_STATES,
  TRACKING_TRANSITIONS,
  TRACKING_STATE_SCHEMA_NAME,
  type TrackingState,
} from './version';
import {
  FieldEvidenceLinkArraySchema,
  refineSortedEvidenceLinks,
} from './field-evidence';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

/** The subject of one tracking record: a work package, optionally narrowed to one activity. */
export const TrackingSubjectSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'TrackingSubject',
    title: 'TrackingSubject',
    description:
      'The subject of one tracking-state record: an opaque work-package id from the ProgramOfWork, optionally narrowed to one opaque activity id.',
  });

/** One tracking subject. */
export type TrackingSubject = z.infer<typeof TrackingSubjectSchema>;

/**
 * The immutable content of one tracking-state record (a recorded state
 * transition with provenance). The subject's implicit initial state is
 * `not-started`: the FIRST record of a subject transitions FROM
 * `not-started` (there is no null marker — the chain root is implicit,
 * and every record is reachable from it).
 */
export const TrackingStateRecordContentSchema = z
  .strictObject({
    schema: z.literal(TRACKING_STATE_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: StateIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    subject: TrackingSubjectSchema,
    fromState: z.enum(TRACKING_STATES),
    toState: z.enum(TRACKING_STATES),
    cause: z.string().min(1).max(256),
    note: z.string().max(2048).optional(),
    observedAt: TimestampSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    refineSortedEvidenceLinks(record.evidenceLinks, ctx, 'evidenceLinks');
    if (record.recordedAt < record.observedAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'recordedAt must not precede observedAt',
        path: ['recordedAt'],
      });
    }
    if (!TRACKING_TRANSITIONS[record.fromState].includes(record.toState)) {
      ctx.addIssue({
        code: 'custom',
        message: `illegal tracking transition ${record.fromState} -> ${record.toState}`,
        path: ['toState'],
      });
    }
  })
  .meta({
    id: 'TrackingStateRecordContent',
    title: 'TrackingStateRecordContent',
    description:
      'The immutable content of one tracking-state record: opaque subject, the observed state transition with provenance (cause, note, instants, principal), sorted field-evidence references, and the mandatory uncertainty state. NO schedule fields — the schedule authority stays in the ProgramOfWork.',
  });

/** The tracking-state transition leg (from -> to). */
export interface TrackingTransition {
  readonly from: TrackingState;
  readonly to: TrackingState;
}

/** One tracking-state record content. */
export type TrackingStateRecordContent = z.infer<typeof TrackingStateRecordContentSchema>;

/** The SEALED tracking-state record: content plus its SHA-256 content digest. */
export const SealedTrackingStateRecordSchema = z
  .strictObject({
    schema: z.literal(TRACKING_STATE_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: StateIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    subject: TrackingSubjectSchema,
    fromState: z.enum(TRACKING_STATES),
    toState: z.enum(TRACKING_STATES),
    cause: z.string().min(1).max(256),
    note: z.string().max(2048).optional(),
    observedAt: TimestampSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedTrackingStateRecord',
    title: 'SealedTrackingStateRecord',
    description:
      'The sealed tracking-state record: immutable state-transition content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed tracking-state record. */
export type SealedTrackingStateRecord = z.infer<typeof SealedTrackingStateRecordSchema>;

/** Compute the content digest of a tracking-state record content. */
export function computeTrackingStateRecordDigest(
  content: TrackingStateRecordContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid tracking-state record content into its published record. */
export function sealTrackingStateRecord(
  content: unknown,
): ExecutionResult<SealedTrackingStateRecord> {
  const parsed = TrackingStateRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed tracking-state record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedTrackingStateRecord(
  sealed: unknown,
): ExecutionResult<SealedTrackingStateRecord> {
  const parsed = SealedTrackingStateRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed tracking-state record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic tracking folds (the observation projection — never a schedule).
// --------------------------------------------------------------------------------

/** The canonical subject key of tracking records (`workPackageId` or `workPackageId|activityId`). */
export function trackingSubjectKey(subject: TrackingSubject): string {
  return subject.activityId === undefined
    ? subject.workPackageId
    : `${subject.workPackageId}|${subject.activityId}`;
}

/** One folded tracking state of a subject (the latest observed state). */
export interface TrackingStateProjection {
  readonly workPackageId: string;
  readonly activityId?: string | undefined;
  readonly state: TrackingState;
  readonly recordCount: number;
  readonly lastRecordId: string;
  readonly lastObservedAt: string;
}

/**
 * Fold tracking-state records into the per-subject CURRENT STATE. The
 * records of one subject form an append-only CHAIN rooted at the
 * implicit `not-started` initial state (each admission's `fromState`
 * must equal the subject's current state — the store enforces it), so
 * the fold WALKS the chain from `not-started` forward instead of
 * trusting recordId order; among structurally competing successors the
 * smallest recordId wins (deterministic). Subjects without records
 * project `not-started`. Rows sort by subject key.
 */
export function foldTrackingStates(
  records: readonly SealedTrackingStateRecord[],
): readonly TrackingStateProjection[] {
  const bySubject = new Map<string, SealedTrackingStateRecord[]>();
  for (const record of records) {
    const key = trackingSubjectKey(record.subject);
    bySubject.set(key, [...(bySubject.get(key) ?? []), record]);
  }
  const projections: TrackingStateProjection[] = [];
  for (const subjectRecords of bySubject.values()) {
    const sorted = [...subjectRecords].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
    const genesis = sorted.find(
      (record) => record.fromState === 'not-started' && record.toState !== 'not-started',
    ) ?? sorted.find((record) => record.fromState === 'not-started');
    if (genesis === undefined) {
      // No record transitions out of `not-started`: the subject is not-started.
      const first = sorted[0]!;
      projections.push({
        workPackageId: first.subject.workPackageId,
        activityId: first.subject.activityId,
        state: 'not-started',
        recordCount: 0,
        lastRecordId: '',
        lastObservedAt: '',
      });
      continue;
    }
    let current = genesis;
    let walked = 1;
    // Walk the chain: the successor's fromState === current toState.
    for (;;) {
      const successor = sorted
        .filter((record) => record.fromState === current.toState)
        .sort((a, b) => (a.recordId < b.recordId ? -1 : 1))[0];
      if (successor === undefined) break;
      current = successor;
      walked += 1;
    }
    projections.push({
      workPackageId: current.subject.workPackageId,
      activityId: current.subject.activityId,
      state: current.toState,
      recordCount: walked,
      lastRecordId: current.recordId,
      lastObservedAt: current.observedAt,
    });
  }
  return projections.sort((a, b) => (trackingSubjectKey(a) < trackingSubjectKey(b) ? -1 : 1));
}

/**
 * Derive the WORK-PACKAGE state from its activity states when no
 * work-package-level record exists: all activities completed ->
 * completed; any blocked -> blocked; any in-progress -> in-progress;
 * otherwise not-started (deterministic).
 */
export function deriveWorkPackageState(
  activityStates: readonly TrackingState[],
): TrackingState {
  if (activityStates.length === 0) return 'not-started';
  if (activityStates.every((state) => state === 'completed')) return 'completed';
  if (activityStates.some((state) => state === 'blocked')) return 'blocked';
  if (activityStates.some((state) => state === 'in-progress')) return 'in-progress';
  return 'not-started';
}

/**
 * The CURRENT tracking state of one subject given the existing records
 * (the chain-walking fold restricted to the subject; `not-started` when
 * none).
 */
export function currentTrackingState(
  records: readonly SealedTrackingStateRecord[],
  subject: TrackingSubject,
): TrackingState {
  const key = trackingSubjectKey(subject);
  const projection = foldTrackingStates(
    records.filter((record) => trackingSubjectKey(record.subject) === key),
  ).find(
    (candidate) =>
      candidate.workPackageId === subject.workPackageId &&
      candidate.activityId === subject.activityId,
  );
  return projection?.state ?? 'not-started';
}
