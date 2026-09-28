/**
 * The service-layer compile-time parity module (the W043 pin): the two
 * W043 kernels never link at runtime, so their shared vocabularies are
 * pinned HERE — the only W043 component that depends on both:
 *
 * - the finding-status driver grammar of @epoch/alerts is
 *   member-compatible with @epoch/supervision's FINDING_STATUSES (alert
 *   revisions are driven by the supervision statuses);
 * - every supervision finding-class token satisfies the alerts policy
 *   rule-key grammar (closed union -> neutral token);
 * - the service's finding -> AlertFindingSummary projection is total
 *   (every field the alerts input needs is carried by a finding);
 * - the alerts severities satisfy the supervision event payload
 *   grammar (closed union -> bounded neutral string), and so do the
 *   channel kinds, escalation outcome kinds and resolution kinds;
 * - the supervision finding-id grammar is identical to the alerts
 *   finding-id mirror grammar.
 *
 * Compiled by this package's `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests.
 */
import type { Equals, Expect, Extends } from './type-utils';
import type {
  AlertEscalatedData,
  AlertRaisedData,
  AlertResolvedData,
  AlertRevisedData,
  NotificationDispatchedData,
} from '@epoch/supervision';
import type { SealedSupervisionFinding, FindingClass as SupervisionFindingClass } from '@epoch/supervision';
import type { AlertFindingSummary, SealedAlertRecord } from '@epoch/alerts';

/** The finding-status vocabularies are member-compatible across the kernels. */
export type FindingStatusParity = Expect<
  Equals<AlertRevisedData['findingStatus'], SealedSupervisionFinding['status']>
>;

/** The finding-id grammar is identical to the alerts mirror grammar. */
export type FindingIdParity = Expect<
  Equals<AlertFindingSummary['findingId'], SealedSupervisionFinding['findingId']>
>;

/** The subject anchors project structurally. */
export type SubjectKindParity = Expect<
  Extends<SealedSupervisionFinding['subject']['subjectKind'], AlertFindingSummary['subjectKind']>
>;

/** The finding classes (closed union) satisfy the alerts policy key grammar. */
export type FindingClassTokenParity = Expect<
  Extends<SupervisionFindingClass, AlertFindingSummary['findingClass']>
>;

/** The service's finding -> summary projection is total (structural). */
export type FindingProjectionParity = Expect<
  Extends<
    {
      readonly findingId: SealedSupervisionFinding['findingId'];
      readonly findingDigest: SealedSupervisionFinding['contentDigest'];
      readonly findingClass: SupervisionFindingClass;
      readonly findingStatus: SealedSupervisionFinding['status'];
      readonly subjectKind: SealedSupervisionFinding['subject']['subjectKind'];
      readonly subjectId: SealedSupervisionFinding['subject']['subjectId'];
      readonly title: SealedSupervisionFinding['title'];
      readonly detectedAt: string;
    },
    AlertFindingSummary
  >
>;

/** The alerts severities satisfy the supervision event payload grammar. */
export type SeverityPayloadParity = Expect<
  Extends<SealedAlertRecord['severity'], AlertRaisedData['severity']>
>;

/** The escalation outcome kinds satisfy the event payload grammar. */
export type OutcomeKindPayloadParity = Expect<
  Extends<string, AlertEscalatedData['outcomeKind']>
>;

/** The resolution kinds satisfy the event payload grammar. */
export type ResolutionKindPayloadParity = Expect<
  Extends<string, AlertResolvedData['resolutionKind']>
>;

/** The channel kinds satisfy the notification-event payload grammar. */
export type ChannelKindPayloadParity = Expect<
  Extends<string, NotificationDispatchedData['channelKind']>
>;
