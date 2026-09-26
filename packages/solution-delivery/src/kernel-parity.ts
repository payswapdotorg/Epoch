/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028).
 *
 * This file pins structural compatibility between the solution-delivery
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W036 runtime-dependency policy:
 * @epoch/agent-protocol, @epoch/tenancy, and zod only):
 *
 * - `DeliveryEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (delivery lifecycle events are append-only typed
 *   events over the W010 event shapes — the `delivery:*` payload
 *   namespace);
 * - `EvidenceReference['digest']` is TYPE-EQUAL to the W006
 *   exact-revision digest grammar and to the W006 verification run's
 *   produced-evidence digest element (evidence is exact-revision
 *   addressable by canonical SHA-256);
 * - `WorldEntityReference['entityId']` is TYPE-EQUAL to the W002
 *   world-model `EntityId` (world references are the world grammar,
 *   never a mirror);
 * - `ConstraintReference['constraintId']` is TYPE-EQUAL to the W004
 *   constraint-language authored-constraint id (constraints are the
 *   constraint engine's authority);
 * - `ConfidenceState['method']` is TYPE-EQUAL to the W006 evidence
 *   confidence-method grammar (delivery confidence is evidence-shaped).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { DeliveryEventContent } from './events';
import type { EvidenceReference, WorldEntityReference, ConstraintReference } from './solution';
import type { ConfidenceState } from './uncertainty';
import type { EventContent, EventActor } from '@epoch/event-log';
import type { ExactRevisionRef, ConfidenceMethod } from '@epoch/evidence';
import type { Run } from '@epoch/verification';
import type { EntityId } from '@epoch/world-model';
import type { AuthoredConstraint } from '@epoch/constraint-language';

/** Delivery events are W010 event shapes, structurally (W010 parity). */
export type DeliveryEventParity = Expect<Equals<DeliveryEventContent, EventContent>>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** Evidence references carry the W006 exact-revision digest grammar. */
export type EvidenceDigestParity = Expect<
  Equals<EvidenceReference['digest'], ExactRevisionRef['digest']>
>;

/** Verification runs and delivery records share the evidence digest grammar. */
export type VerificationEvidenceParity = Expect<
  Equals<EvidenceReference['digest'], Run['producedEvidence'][number]>
>;

/** World references carry the W002 world-model entity grammar. */
export type WorldEntityIdParity = Expect<Equals<WorldEntityReference['entityId'], EntityId>>;

/** Constraint references carry the W004 constraint id grammar. */
export type ConstraintIdParity = Expect<
  Equals<ConstraintReference['constraintId'], AuthoredConstraint['id']>
>;

/** Delivery confidence methods are the W006 evidence confidence grammar. */
export type ConfidenceMethodParity = Expect<
  Equals<ConfidenceState['method'], ConfidenceMethod>
>;
