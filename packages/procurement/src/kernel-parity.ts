/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036).
 *
 * This file pins structural compatibility between the procurement shapes
 * and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W037 runtime-dependency policy:
 * @epoch/solution-delivery, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `ProcurementEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (procurement lifecycle events are append-only typed
 *   events over the W010 event shapes — the open `procurement:`
 *   payload namespace);
 * - the mirrored stream/actor grammars are pattern-equal to the W010
 *   grammars (the W009 identity grammar underneath);
 * - the commitment reference digest is TYPE-EQUAL to the W036
 *   sealed-distinction content digest grammar (procurement LINKS W036
 *   commitment records by exact revision);
 * - the lead-time observation semantics vocabulary is the W036
 *   Prediction/Est distinction subset (typed references, never
 *   collapsed);
 * - the constraint-evaluation reference digest is TYPE-EQUAL to the
 *   shared SHA-256 grammar (the W004 policy-evaluation document is
 *   content-addressed by the same exact-revision discipline);
 * - the composed `UncertaintyState` is TYPE-EQUAL to W036's (runtime
 *   composition over the solution-delivery kernel).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { ProcurementEventContent } from './events';
import type { LeadTimeObservation } from './quote';
import type { CommitmentReference } from './commitment';
import type { ConstraintEvaluationReference } from './substitution';
import type { EventContent } from '@epoch/event-log';
import type { SealedDistinctionRecord, UncertaintyState, SemanticDistinctionKind } from '@epoch/solution-delivery';
import type { CompositeDecision } from '@epoch/policy-contracts';
import type { Sha256Hex } from '@epoch/agent-protocol';

/** Procurement events are W010 event shapes, structurally (W010 parity). */
export type ProcurementEventParity = Expect<Equals<ProcurementEventContent, EventContent>>;

/** Commitment references carry the W036 exact-revision digest grammar. */
export type CommitmentDigestParity = Expect<
  Equals<CommitmentReference['contentDigest'], SealedDistinctionRecord['contentDigest']>
>;

/** Lead-time semantics are the W036 Prediction/Estimate distinction subset. */
export type LeadTimeSemanticsParity = Expect<
  Equals<LeadTimeObservation['semantics'], Extract<SemanticDistinctionKind, 'prediction' | 'estimate'>>
>;

/** Lead-time observations carry the W036 uncertainty state (composed). */
export type LeadTimeUncertaintyParity = Expect<
  Equals<LeadTimeObservation['uncertainty'], UncertaintyState>
>;

/** Constraint-evaluation references carry the shared SHA-256 grammar. */
export type ConstraintEvaluationDigestParity = Expect<
  Equals<ConstraintEvaluationReference['evaluationDigest'], Sha256Hex>
>;

/** The W004 composite decision is the referenced evaluation shape. */
export type ConstraintEvaluationShapeRef = CompositeDecision;
