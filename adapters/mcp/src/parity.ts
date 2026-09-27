/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the W036 pattern;
 * the frozen runtime dependency policy of this adapter is
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/action-protocol,
 * @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the adapter's neutral
 * shapes and the sibling kernel vocabularies WITHOUT runtime edges:
 *
 * - the authority-decision outcome vocabulary is TYPE-EQUAL to the W022
 *   action-policy `PolicyDecisionOutcome` (allow / deny /
 *   requires-approval — one vocabulary, mirrored structurally);
 * - the evaluation verdict + justification shapes are TYPE-EQUAL to the
 *   W007 SDK evaluator payload mirror (which itself parity-pins the W005
 *   evaluation contract — one chain, no drift);
 * - the registration manifests' capability metadata is structurally
 *   compatible with the W007 registry manifest surface;
 * - the W007 adapter descriptor and binding pin are the REAL SDK types
 *   (imported at runtime — no parity needed, a direct edge);
 * - the W003 action proposals are the REAL action-protocol types
 *   (imported at runtime — no parity needed, a direct edge).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index. It is compiled by this package's
 * own `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type {
  AuthorityDecisionRecord,
  InvocationEvaluation,
} from './types';
import type { DerivedCapabilityRegistration } from './registration';
import type { ToolCapabilityRegistration } from './discovery';
import type { CapabilityManifest, CapabilityRegistration } from '@epoch/capability-registry';
import type { PolicyDecisionOutcome } from '@epoch/action-policy';
import type { EvaluatorResponsePayload } from '@epoch/adapter-sdk';

/** The authority-decision outcome vocabulary is the W022 outcome vocabulary. */
export type DecisionOutcomeParity = Expect<
  Equals<AuthorityDecisionRecord['outcome'], PolicyDecisionOutcome>
>;

/** The evaluation verdict surface mirrors the W007 evaluator payload (the W005 chain). */
export type VerdictParity = Expect<
  Equals<InvocationEvaluation['verdict'], EvaluatorResponsePayload['verdict']>
>;

/** The evaluation justification surface mirrors the W007 evaluator payload. */
export type JustificationParity = Expect<
  Equals<InvocationEvaluation['justification'], EvaluatorResponsePayload['justification']>
>;

/** Derived adapter registration manifests are structurally registrable (W007). */
export type ManifestAssignable = Expect<
  DerivedCapabilityRegistration['manifest'] extends CapabilityManifest ? true : false
>;

/** The adapter registration envelope shape is the W007 registration envelope shape. */
export type RegistrationAssignable = Expect<
  DerivedCapabilityRegistration extends CapabilityRegistration ? true : false
>;

/** Derived per-tool registration manifests are structurally registrable (W007). */
export type ToolManifestAssignable = Expect<
  ToolCapabilityRegistration['manifest'] extends CapabilityManifest ? true : false
>;

/** The per-tool registration envelope shape is the W007 registration envelope shape. */
export type ToolRegistrationAssignable = Expect<
  ToolCapabilityRegistration extends CapabilityRegistration ? true : false
>;
