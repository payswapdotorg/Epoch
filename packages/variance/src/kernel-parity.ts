/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/
 * W036/W037/W038/W039-actualization).
 *
 * This file pins structural compatibility between the variance shapes
 * and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the frozen W039 runtime-dependency policy:
 * @epoch/agent-protocol, @epoch/tenancy, and zod only):
 *
 * - `MeasureValue` is TYPE-EQUAL to the W036 `Measure` grammar
 *   (re-exported by @epoch/execution-tracking, a declared devDep) — the
 *   measure-value space is a structural mirror, never a divergent
 *   grammar;
 * - `VarianceConfidence` is TYPE-EQUAL to the W036 `ConfidenceState`
 *   (via the execution-tracking re-export of `UncertaintyState`) —
 *   variance confidence is evidence-shaped;
 * - the compared-line reference record-id grammars are TYPE-EQUAL to the
 *   W037 procurement commitment reference grammar (the exact-revision
 *   discipline);
 * - the W038 issue-id grammar covers the attribution cause references
 *   (change/delay/rework/defect/blocker are W038 issue records).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests
 * (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { MeasureValue, ComparedLineRef } from './primitives';
import type { VarianceConfidence } from './variance';
import type { CauseRef } from './attribution';
import type { Measure, UncertaintyState } from '@epoch/execution-tracking';
import type { CommitmentReference, ObservationReference } from '@epoch/procurement';

/** The measure-value mirror is the W036 measure grammar, structurally. */
export type MeasureValueParity = Expect<Equals<MeasureValue, Measure>>;

/** The variance confidence mirror is the W036 confidence state, structurally. */
export type VarianceConfidenceParity = Expect<
  Equals<VarianceConfidence, UncertaintyState['confidence']>
>;

/** The compared-line commitment reference carries the W037 grammar. */
export type CommitmentLineParity = Expect<
  Equals<
    Extract<ComparedLineRef, { kind: 'commitment' }>['recordId'],
    CommitmentReference['recordId']
  >
>;

/** The compared-line actual reference carries the W037 observation-ref digest grammar. */
export type ActualLineDigestParity = Expect<
  Equals<Extract<ComparedLineRef, { kind: 'actual' }>['contentDigest'], ObservationReference['contentDigest']>
>;

/** The issue-record cause references carry the W038 issue-id kinds (string ids). */
export type IssueCauseKindParity = Expect<
  Equals<Extract<CauseRef, { causeKind: 'issue-record' }>['recordId'], string>
>;
