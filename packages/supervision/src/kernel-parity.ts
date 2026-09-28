/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/
 * W036/W037/W038).
 *
 * This file pins structural compatibility between the supervision shapes
 * and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W043 runtime-dependency policy:
 * @epoch/solution-delivery, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `SupervisionEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (supervision lifecycle events are append-only typed
 *   events over the W010 event shapes — the `supervision:*` payload
 *   namespace);
 * - `ProvenanceSource['contentDigest']` is TYPE-EQUAL to the W006
 *   exact-revision digest grammar (finding provenance is
 *   exact-revision addressable by canonical SHA-256);
 * - `ExecutionIssueSummary` is FIELD-EQUAL to the REAL W038 sealed
 *   issue record on every mirrored field (recordId, tenantId,
 *   solutionId, issueKind, severity, impact, raisedAt, contentDigest —
 *   the summary adds only the folded resolutionState the W038
 *   foldIssues derives);
 * - `LeadTimeSourceRecord` is FIELD-EQUAL to the REAL W037 lead-time
 *   observation on (recordId, contentDigest) — the exact-revision
 *   Prediction/Estimate reference supervision resolves;
 * - `SupervisionThresholds` consumes the W036 non-negative-decimal
 *   grammar (exact decimal arithmetic, never floats).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { SupervisionEventContent } from './events';
import type { ProvenanceSource } from './provenance';
import type { ExecutionIssueSummary, LeadTimeSourceRecord } from './inputs';
import type { EventContent, EventActor } from '@epoch/event-log';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { SealedIssueRecord } from '@epoch/execution-tracking';
import type { LeadTimeObservation } from '@epoch/procurement';

/** Supervision events are W010 event shapes, structurally (W010 parity). */
export type SupervisionEventParity = Expect<Equals<SupervisionEventContent, EventContent>>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** Finding provenance sources carry the W006 exact-revision digest grammar. */
export type ProvenanceDigestParity = Expect<
  Equals<ProvenanceSource['contentDigest'], ExactRevisionRef['digest']>
>;

/** The W038 sealed issue record: field-for-field identity on every mirrored field. */
export type IssueSummaryRecordIdParity = Expect<
  Equals<ExecutionIssueSummary['recordId'], SealedIssueRecord['recordId']>
>;
export type IssueSummaryTenantParity = Expect<
  Equals<ExecutionIssueSummary['tenantId'], SealedIssueRecord['tenantId']>
>;
export type IssueSummarySolutionParity = Expect<
  Equals<ExecutionIssueSummary['solutionId'], SealedIssueRecord['solutionId']>
>;
export type IssueSummaryKindParity = Expect<
  Equals<ExecutionIssueSummary['issueKind'], SealedIssueRecord['issueKind']>
>;
export type IssueSummarySeverityParity = Expect<
  Equals<ExecutionIssueSummary['severity'], SealedIssueRecord['severity']>
>;
export type IssueSummaryImpactParity = Expect<
  Equals<ExecutionIssueSummary['impact'], SealedIssueRecord['impact']>
>;
export type IssueSummaryRaisedAtParity = Expect<
  Equals<ExecutionIssueSummary['raisedAt'], SealedIssueRecord['raisedAt']>
>;
export type IssueSummaryDigestParity = Expect<
  Equals<ExecutionIssueSummary['contentDigest'], SealedIssueRecord['contentDigest']>
>;

/** The W038 fold derives exactly the three resolution states the summary mirrors. */
export type IssueSummaryResolutionStateParity = Expect<
  Equals<
    ExecutionIssueSummary['resolutionState'],
    'open' | 'resolved' | 'dismissed'
  >
>;

/** The W037 lead-time observation: identity on the exact-revision reference fields. */
export type LeadTimeRecordIdParity = Expect<
  Equals<LeadTimeSourceRecord['recordId'], LeadTimeObservation['recordId']>
>;
export type LeadTimeDigestParity = Expect<
  Equals<LeadTimeSourceRecord['contentDigest'], LeadTimeObservation['contentDigest']>
>;
