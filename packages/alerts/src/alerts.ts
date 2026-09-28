/**
 * ALERT RECORDS as append-only REVISION CHAINS (the W043 pin):
 *
 * - IDEMPOTENT DEDUPLICATION: re-evaluating the SAME finding state
 *   under the SAME policy produces the SEALED PRIOR alert (the typed
 *   `duplicate` admission echoes the prior record — no new revision, no
 *   state change);
 * - STATE TRANSITIONS (due -> late -> blocked -> ...) produce NEW
 *   append-only revisions carrying `previousRevisionDigest` (the W023
 *   version-chain convention) — never mutations;
 * - RESOLUTION appends a terminal revision (remediated /
 *   false-positive / withdrawn); raising against a resolved chain is a
 *   typed `lifecycle-conflict` (a recurring finding ships as a NEW
 *   alert identity — history is never rewritten);
 * - every revision references the EXACT finding digest + policy digest
 *   it was evaluated under (deterministic replay).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  AlertIdSchema,
  AlertsPrincipalIdSchema,
  FindingClassTokenSchema,
  FindingIdMirrorSchema,
  SubjectKindTokenSchema,
} from './primitives';
import {
  ALERT_RECORD_SCHEMA_NAME,
  ALERT_RESOLUTION_KINDS,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERTS_RECORD_VERSION,
  FINDING_STATES,
} from './version';
import type { AlertResolutionKind, AlertSeverity, AlertStatus, FindingState } from './version';
import type { SealedEscalationPolicy } from './policy';
import { resolvePolicyRule } from './policy';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { AlertsResult } from './errors';

// --------------------------------------------------------------------------------
// The finding summary input (the supervision finding projected for
// alerts — parity-pinned at the service boundary).
// --------------------------------------------------------------------------------

/** One supervision finding projected for alert processing. */
export const AlertFindingSummarySchema = z
  .strictObject({
    findingId: FindingIdMirrorSchema,
    findingDigest: z.string().regex(/^[0-9a-f]{64}$/),
    findingClass: FindingClassTokenSchema,
    findingStatus: z.enum(FINDING_STATES),
    subjectKind: SubjectKindTokenSchema,
    subjectId: z.string().min(1).max(256),
    title: z.string().min(1).max(256),
    detectedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'AlertFindingSummary',
    title: 'AlertFindingSummary',
    description:
      'One supervision finding projected for alert processing: identity, exact digest, class token, status driver, subject anchor, title, and detection instant.',
  });

/** One alert finding summary. */
export type AlertFindingSummary = z.infer<typeof AlertFindingSummarySchema>;

// --------------------------------------------------------------------------------
// The alert record.
// --------------------------------------------------------------------------------

/** The immutable content of one alert revision (everything except the digest). */
export const AlertRecordContentSchema = z
  .strictObject({
    schema: z.literal(ALERT_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    alertId: AlertIdSchema,
    tenantId: TenantIdSchema,
    revision: z.number().int().min(1),
    previousRevisionDigest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    findingId: FindingIdMirrorSchema,
    findingDigest: z.string().regex(/^[0-9a-f]{64}$/),
    findingClass: FindingClassTokenSchema,
    findingStatus: z.enum(FINDING_STATES),
    subjectKind: SubjectKindTokenSchema,
    subjectId: z.string().min(1).max(256),
    severity: z.enum(ALERT_SEVERITIES),
    policyId: z.string().regex(/^alert-policy:[a-z0-9][a-z0-9-]{0,58}$/),
    policyDigest: z.string().regex(/^[0-9a-f]{64}$/),
    status: z.enum(ALERT_STATUSES),
    title: z.string().min(1).max(256),
    raisedAt: TimestampSchema,
    raisedBy: AlertsPrincipalIdSchema,
    escalatedAt: TimestampSchema.optional(),
    escalationLevel: z.number().int().min(1).optional(),
    resolvedAt: TimestampSchema.optional(),
    resolvedBy: AlertsPrincipalIdSchema.optional(),
    resolutionKind: z.enum(ALERT_RESOLUTION_KINDS).optional(),
  })
  .readonly()
  .superRefine((alert, ctx) => {
    if (alert.revision === 1 && alert.previousRevisionDigest !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'the first revision of an alert chain carries no previousRevisionDigest',
        path: ['previousRevisionDigest'],
      });
    }
    if (alert.revision > 1 && alert.previousRevisionDigest === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'an appended revision must reference the digest of the revision it extends',
        path: ['previousRevisionDigest'],
      });
    }
    if (alert.status === 'escalated') {
      if (alert.escalatedAt === undefined || alert.escalationLevel === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'an escalated revision must carry escalatedAt and escalationLevel',
          path: ['status'],
        });
      }
    }
    if (alert.status === 'resolved') {
      if (alert.resolvedAt === undefined || alert.resolvedBy === undefined || alert.resolutionKind === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a resolved revision must carry resolvedAt, resolvedBy and resolutionKind',
          path: ['status'],
        });
      }
    }
    if (alert.status !== 'resolved' && alert.resolutionKind !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a resolved revision carries a resolutionKind',
        path: ['resolutionKind'],
      });
    }
  })
  .meta({
    id: 'AlertRecordContent',
    title: 'AlertRecordContent',
    description:
      'The immutable content of one alert revision: identity, tenant scope, the exact finding/policy digests it was evaluated under, the mapped severity, the lifecycle status, and the chain link to the previous revision.',
  });

/** One alert record content. */
export type AlertRecordContent = z.infer<typeof AlertRecordContentSchema>;

/** The SEALED alert revision: content plus its SHA-256 content digest. */
export const SealedAlertRecordSchema = z
  .strictObject({
    schema: z.literal(ALERT_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    alertId: AlertIdSchema,
    tenantId: TenantIdSchema,
    revision: z.number().int().min(1),
    previousRevisionDigest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    findingId: FindingIdMirrorSchema,
    findingDigest: z.string().regex(/^[0-9a-f]{64}$/),
    findingClass: FindingClassTokenSchema,
    findingStatus: z.enum(FINDING_STATES),
    subjectKind: SubjectKindTokenSchema,
    subjectId: z.string().min(1).max(256),
    severity: z.enum(ALERT_SEVERITIES),
    policyId: z.string().regex(/^alert-policy:[a-z0-9][a-z0-9-]{0,58}$/),
    policyDigest: z.string().regex(/^[0-9a-f]{64}$/),
    status: z.enum(ALERT_STATUSES),
    title: z.string().min(1).max(256),
    raisedAt: TimestampSchema,
    raisedBy: AlertsPrincipalIdSchema,
    escalatedAt: TimestampSchema.optional(),
    escalationLevel: z.number().int().min(1).optional(),
    resolvedAt: TimestampSchema.optional(),
    resolvedBy: AlertsPrincipalIdSchema.optional(),
    resolutionKind: z.enum(ALERT_RESOLUTION_KINDS).optional(),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedAlertRecord',
    title: 'SealedAlertRecord',
    description:
      'The sealed alert revision: immutable content plus its SHA-256 content digest (exact-revision addressing of one alert-chain revision).',
  });

/** One sealed alert record. */
export type SealedAlertRecord = z.infer<typeof SealedAlertRecordSchema>;

/** Compute the content digest of an alert revision content. */
export function computeAlertRecordDigest(content: AlertRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Verify a sealed alert revision: schema + digest recomputation. */
export function verifySealedAlertRecord(sealed: unknown): AlertsResult<SealedAlertRecord> {
  const parsed = SealedAlertRecordSchema.safeParse(sealed);
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
        message: 'sealed alert revision digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: `${parsed.data.alertId}#r${parsed.data.revision}`,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The idempotent raise (duplicate = sealed prior record).
// --------------------------------------------------------------------------------

/** The typed outcome of one raise attempt. */
export type AlertRaiseOutcome =
  | { readonly admission: 'raised'; readonly alert: SealedAlertRecord }
  | { readonly admission: 'duplicate'; readonly alert: SealedAlertRecord };

/** Options of one raise attempt. */
export interface RaiseAlertOptions {
  readonly alertId: string;
  readonly tenantId: string;
  readonly summary: AlertFindingSummary;
  readonly policy: SealedEscalationPolicy;
  readonly raisedAt: string;
  readonly raisedBy: string;
}

/**
 * RAISE (or re-evaluate) one alert against its revision chain:
 *
 * - empty chain -> revision 1 (status `raised`);
 * - head carries the SAME finding digest under the SAME policy ->
 *   `duplicate`: the sealed prior record (idempotent — no state
 *   change);
 * - head carries a DIFFERENT finding digest (a status transition) ->
 *   a NEW appended revision (revision + 1, `previousRevisionDigest` =
 *   head digest);
 * - head is RESOLVED -> typed `lifecycle-conflict` (a resolved chain
 *   does not reopen; a recurring finding ships as a new alert
 *   identity);
 * - cross-tenant chains are `tenant-isolation-rejected` (R12).
 */
export function raiseAlert(
  chain: readonly SealedAlertRecord[],
  options: RaiseAlertOptions,
): AlertsResult<AlertRaiseOutcome> {
  const head = chain.length > 0 ? chain[chain.length - 1]! : null;
  if (head !== null && head.tenantId !== options.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `alert chain "${head.alertId}" belongs to tenant "${head.tenantId}" but the raise is scoped to "${options.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: options.tenantId,
        encounteredTenantId: head.tenantId,
        subject: head.alertId,
      },
    };
  }
  if (head !== null && head.findingId !== options.summary.findingId) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `alert chain "${head.alertId}" watches finding "${head.findingId}" — it cannot re-evaluate finding "${options.summary.findingId}" (one chain watches one finding identity)`,
        referenceKind: 'finding',
        referenceId: options.summary.findingId,
      },
    };
  }
  const decision = resolvePolicyRule(
    options.policy,
    options.summary.findingClass,
    options.summary.findingStatus,
  );
  const content: AlertRecordContent = {
    schema: ALERT_RECORD_SCHEMA_NAME,
    schemaVersion: ALERTS_RECORD_VERSION,
    alertId: options.alertId,
    tenantId: options.tenantId,
    revision: head === null ? 1 : head.revision + 1,
    previousRevisionDigest: head === null ? null : head.contentDigest,
    findingId: options.summary.findingId,
    findingDigest: options.summary.findingDigest,
    findingClass: options.summary.findingClass,
    findingStatus: options.summary.findingStatus,
    subjectKind: options.summary.subjectKind,
    subjectId: options.summary.subjectId,
    severity: decision.severity,
    policyId: options.policy.policyId,
    policyDigest: options.policy.contentDigest,
    status: 'raised',
    title: options.summary.title,
    raisedAt: options.raisedAt,
    raisedBy: options.raisedBy,
  };

  if (head !== null && head.status === 'resolved') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `alert chain "${head.alertId}" is resolved — a resolved chain does not reopen; a recurring finding ships as a new alert identity`,
        subjectId: head.alertId,
      },
    };
  }
  if (
    head !== null &&
    head.findingDigest === options.summary.findingDigest &&
    head.policyDigest === options.policy.contentDigest
  ) {
    return { ok: true, value: { admission: 'duplicate', alert: head } };
  }
  return {
    ok: true,
    value: {
      admission: 'raised',
      alert: { ...content, contentDigest: computeAlertRecordDigest(content) },
    },
  };
}

// --------------------------------------------------------------------------------
// Resolution + escalation revisions.
// --------------------------------------------------------------------------------

/** Options of one resolution. */
export interface ResolveAlertOptions {
  readonly resolvedAt: string;
  readonly resolvedBy: string;
  readonly resolutionKind: AlertResolutionKind;
}

/** Append the terminal RESOLVED revision to a chain. */
export function resolveAlert(
  chain: readonly SealedAlertRecord[],
  options: ResolveAlertOptions,
): AlertsResult<SealedAlertRecord> {
  const head = chain.length > 0 ? chain[chain.length - 1]! : null;
  if (head === null) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: 'an alert chain must exist before it can be resolved',
        referenceKind: 'alert-chain',
        referenceId: 'alert-chain',
      },
    };
  }
  if (head.status === 'resolved') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `alert chain "${head.alertId}" is already resolved — resolutions are terminal`,
        subjectId: head.alertId,
        resolutionKind: head.resolutionKind,
      },
    };
  }
  const content: AlertRecordContent = {
    schema: ALERT_RECORD_SCHEMA_NAME,
    schemaVersion: ALERTS_RECORD_VERSION,
    alertId: head.alertId,
    tenantId: head.tenantId,
    revision: head.revision + 1,
    previousRevisionDigest: head.contentDigest,
    findingId: head.findingId,
    findingDigest: head.findingDigest,
    findingClass: head.findingClass,
    findingStatus: head.findingStatus,
    subjectKind: head.subjectKind,
    subjectId: head.subjectId,
    severity: head.severity,
    policyId: head.policyId,
    policyDigest: head.policyDigest,
    status: 'resolved',
    title: head.title,
    raisedAt: head.raisedAt,
    raisedBy: head.raisedBy,
    resolvedAt: options.resolvedAt,
    resolvedBy: options.resolvedBy,
    resolutionKind: options.resolutionKind,
  };
  return { ok: true, value: { ...content, contentDigest: computeAlertRecordDigest(content) } };
}

/** Options of one escalation revision (applied AFTER a dispatched outcome). */
export interface EscalateAlertOptions {
  readonly escalatedAt: string;
  readonly escalationLevel: number;
}

/** Append an ESCALATED revision to a chain (the gateway authorized the escalation). */
export function escalateAlert(
  chain: readonly SealedAlertRecord[],
  options: EscalateAlertOptions,
): AlertsResult<SealedAlertRecord> {
  const head = chain.length > 0 ? chain[chain.length - 1]! : null;
  if (head === null) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: 'an alert chain must exist before it can be escalated',
        referenceKind: 'alert-chain',
        referenceId: 'alert-chain',
      },
    };
  }
  if (head.status === 'resolved') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `alert chain "${head.alertId}" is resolved — a resolved chain does not escalate`,
        subjectId: head.alertId,
        resolutionKind: head.resolutionKind,
      },
    };
  }
  const content: AlertRecordContent = {
    schema: ALERT_RECORD_SCHEMA_NAME,
    schemaVersion: ALERTS_RECORD_VERSION,
    alertId: head.alertId,
    tenantId: head.tenantId,
    revision: head.revision + 1,
    previousRevisionDigest: head.contentDigest,
    findingId: head.findingId,
    findingDigest: head.findingDigest,
    findingClass: head.findingClass,
    findingStatus: head.findingStatus,
    subjectKind: head.subjectKind,
    subjectId: head.subjectId,
    severity: head.severity,
    policyId: head.policyId,
    policyDigest: head.policyDigest,
    status: 'escalated',
    title: head.title,
    raisedAt: head.raisedAt,
    raisedBy: head.raisedBy,
    escalatedAt: options.escalatedAt,
    escalationLevel: options.escalationLevel,
  };
  return { ok: true, value: { ...content, contentDigest: computeAlertRecordDigest(content) } };
}

// --------------------------------------------------------------------------------
// The deterministic alert-chain fold (the projection input).
// --------------------------------------------------------------------------------

/** One row of the alert-chain fold. */
export interface AlertChainRow {
  readonly alertId: string;
  readonly revisionCount: number;
  readonly status: AlertStatus;
  readonly severity: AlertSeverity;
  readonly findingId: string;
  readonly findingStatus: FindingState;
  readonly raisedAt: string;
  readonly escalatedAt: string | null;
  readonly resolvedAt: string | null;
  readonly headDigest: string;
}

/** The deterministic alert-chain fold over every chain. */
export interface AlertChainFold {
  readonly chains: readonly AlertChainRow[];
  readonly counts: Readonly<Record<AlertStatus, number>>;
}

/**
 * Fold alert chains into their head projections: rows sorted by alertId
 * (input order never leaks); counts by head status.
 */
export function foldAlertChains(
  chains: readonly (readonly SealedAlertRecord[])[],
): AlertChainFold {
  const rows = chains
    .filter((chain) => chain.length > 0)
    .map((chain) => {
      const head = chain[chain.length - 1]!;
      return {
        alertId: head.alertId,
        revisionCount: chain.length,
        status: head.status,
        severity: head.severity,
        findingId: head.findingId,
        findingStatus: head.findingStatus,
        raisedAt: head.raisedAt,
        escalatedAt: head.escalatedAt ?? null,
        resolvedAt: head.resolvedAt ?? null,
        headDigest: head.contentDigest,
      } satisfies AlertChainRow;
    })
    .sort((a, b) => (a.alertId < b.alertId ? -1 : 1));
  const counts = { raised: 0, escalated: 0, resolved: 0 } as Record<AlertStatus, number>;
  for (const row of rows) {
    counts[row.status] += 1;
  }
  return { chains: rows, counts };
}
