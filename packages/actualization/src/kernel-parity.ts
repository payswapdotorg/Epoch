/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/
 * W036/W037/W038).
 *
 * This file pins structural compatibility between the actualization
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W039 runtime-dependency policy:
 * @epoch/solution-delivery, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `ActualizationEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (actualization lifecycle events are append-only typed
 *   events over the W010 event shapes — the `actualization:*` payload
 *   namespace);
 * - `ObservationReference` is TYPE-EQUAL to @epoch/procurement's
 *   supplier-delivery `ObservationReference` (the W037 receipt linkage
 *   grammar — W037 receipts and W039 actualization fold the SAME
 *   observation references);
 * - the lineage commitment-node record id is TYPE-EQUAL to
 *   @epoch/procurement's `CommitmentReference['recordId']` grammar (the
 *   W037 commitment-reference discipline);
 * - `CalibrationConfidence['method']` is TYPE-EQUAL to the W006 evidence
 *   confidence-method grammar (calibration confidence is
 *   evidence-shaped);
 * - the W036 measure/subject/uncertainty grammars are composed at
 *   RUNTIME (genuine dependencies — no parity needed, they are the same
 *   objects).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests
 * (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { ActualizationEventContent } from './events';
import type { ObservationReference } from './primitives';
import type { CalibrationConfidence } from './calibration';
import type { LineageNodeRef } from './lineage';
import type { EventContent, EventActor } from '@epoch/event-log';
import type { ObservationReference as ProcurementObservationReference, CommitmentReference } from '@epoch/procurement';
import type { ConfidenceMethod } from '@epoch/evidence';

/** Actualization events are W010 event shapes, structurally (W010 parity). */
export type ActualizationEventParity = Expect<
  Equals<ActualizationEventContent, EventContent>
>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** The W037 supplier-delivery observation reference is the SAME grammar here. */
export type ProcurementObservationReferenceParity = Expect<
  Equals<ObservationReference, ProcurementObservationReference>
>;

/** The lineage commitment node carries the W037 commitment record-id grammar. */
export type CommitmentNodeParity = Expect<
  Equals<Extract<LineageNodeRef, { kind: 'commitment' }>['recordId'], CommitmentReference['recordId']>
>;

/** Calibration confidence methods are the W006 evidence confidence grammar. */
export type CalibrationConfidenceMethodParity = Expect<
  Equals<CalibrationConfidence['method'], ConfidenceMethod>
>;
