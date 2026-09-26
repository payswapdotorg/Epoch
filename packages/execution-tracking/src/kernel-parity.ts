/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036/W037).
 *
 * This file pins structural compatibility between the execution-tracking
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W038 runtime-dependency policy:
 * @epoch/solution-delivery, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `ExecutionEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (execution lifecycle events are append-only typed
 *   events over the W010 event shapes — the `execution:*` payload
 *   namespace, one stream per work package);
 * - `FieldEvidenceLink['digest']` is TYPE-EQUAL to the W006
 *   exact-revision digest grammar and to the W036 verification run's
 *   produced-evidence digest element (field evidence references are
 *   exact-revision addressable by canonical SHA-256 — never payloads);
 * - `FieldCapture['measure']` is TYPE-EQUAL to the W036 `Measure` (the
 *   execution measure space IS the W036 measure space);
 * - `FieldCapture['uncertainty']` is TYPE-EQUAL to the W036
 *   `UncertaintyState` (the mandatory uncertainty state follows the W036
 *   distinction conventions);
 * - the W036 observation records this package produces through
 *   `sealDistinctionRecord` are TYPE-EQUAL to the store's observation
 *   array elements (kernel parity with the consumed authority);
 * - `ReconciliationApplicationResult['delivery']` is TYPE-EQUAL to the
 *   W036 `SealedDeliveryRecord` (reconciliation applies to the REAL
 *   delivery-facts authority).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { ExecutionEventContent } from './events';
import type { FieldEvidenceLink } from './field-evidence';
import type { FieldCapture } from './store';
import type { ReconciliationApplicationResult } from './reconciliation';
import { EXECUTION_TRACKING_CONTRACT_VERSION } from './version';
import type { EventContent, EventActor } from '@epoch/event-log';
import type { ExactRevisionRef, ConfidenceMethod } from '@epoch/evidence';
import type { Run } from '@epoch/verification';
import type { CapabilityContractReference } from '@epoch/capability-registry';
import type {
  Measure,
  UncertaintyState,
  SealedDeliveryRecord,
  ObservationRecord,
} from '@epoch/solution-delivery';

/** Execution events are W010 event shapes, structurally (W010 parity). */
export type ExecutionEventParity = Expect<Equals<ExecutionEventContent, EventContent>>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** Field evidence references carry the W006 exact-revision digest grammar. */
export type EvidenceDigestParity = Expect<
  Equals<FieldEvidenceLink['digest'], ExactRevisionRef['digest']>
>;

/** Verification runs and field evidence references share the digest grammar. */
export type VerificationEvidenceParity = Expect<
  Equals<FieldEvidenceLink['digest'], Run['producedEvidence'][number]>
>;

/** The execution measure space is the W036 measure space. */
export type MeasureParity = Expect<Equals<FieldCapture['measure'], Measure>>;

/** The mandatory uncertainty state follows the W036 distinction conventions. */
export type UncertaintyParity = Expect<Equals<FieldCapture['uncertainty'], UncertaintyState>>;

/** The store's observation records ARE the W036 sealed observation records. */
export type ObservationParity = Expect<
  Equals<import('./store').ExecutionTrackingStore['observations'][number], ObservationRecord>
>;

/** Reconciliation applies to the REAL W036 delivery-facts authority. */
export type DeliveryAuthorityParity = Expect<
  Equals<ReconciliationApplicationResult['delivery'], SealedDeliveryRecord>
>;

/** The confidence-method grammar on mirrored uncertainty is the W006 grammar. */
export type ConfidenceMethodParity = Expect<
  Equals<UncertaintyState['confidence']['method'], ConfidenceMethod>
>;

/** The published contract version satisfies the W007 SemverCore grammar (field-capture capabilities bind through the registry). */
export type CapabilityContractVersionParity = Expect<
  typeof EXECUTION_TRACKING_CONTRACT_VERSION extends CapabilityContractReference['contractVersion']
    ? true
    : false
>;
