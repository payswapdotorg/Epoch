/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the W036 pattern;
 * the frozen runtime dependency policy of this adapter is
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/action-protocol,
 * @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the adapter's neutral
 * shapes and the sibling kernel vocabularies WITHOUT runtime edges:
 *
 * - the W002-convention observation mirrors are TYPE-EQUAL to the
 *   world-model contract types (statement, provenance, actor, evidence
 *   reference, confidence, validity) — projected observations are
 *   world-model-shaped, never a competing surface;
 * - the source reference is TYPE-EQUAL to the W006 `ExactRevisionRef`
 *   (the exact-revision digest discipline);
 * - the authority-decision outcome vocabulary is TYPE-EQUAL to the W022
 *   action-policy `PolicyDecisionOutcome` (allow / deny /
 *   requires-approval — one vocabulary, mirrored structurally);
 * - the registration manifests' capability metadata is structurally
 *   compatible with the W007 registry manifest surface (assignable;
 *   equality is impossible because the registry surface is wider);
 * - the W007 adapter descriptor and binding pin are the REAL SDK types
 *   (imported at runtime — no parity needed, a direct edge).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type {
  WorkspaceConfidence,
  WorkspaceEvidenceRef,
  WorkspaceProvenance,
  WorkspaceSourceRef,
  WorkspaceStatement,
  WorkspaceValidity,
  AuthorityDecisionRecord,
} from './types';
import type { DerivedCapabilityRegistration } from './registration';
import type { CapabilityManifest, CapabilityRegistration } from '@epoch/capability-registry';
import type { ExactRevisionRef } from '@epoch/evidence';
import type {
  AssertionStatement,
  Confidence,
  EvidenceRef,
  Provenance,
  Validity,
} from '@epoch/world-model';
import type { PolicyDecisionOutcome } from '@epoch/action-policy';

/** Observation statements carry the W002 assertion-statement grammar. */
export type StatementParity = Expect<Equals<WorkspaceStatement, AssertionStatement>>;

/** Observation provenance is the W002 provenance grammar. */
export type ProvenanceParity = Expect<Equals<WorkspaceProvenance, Provenance>>;

/** The observation actor reference is the W002 actor grammar. */
export type EvidenceRefParity = Expect<Equals<WorkspaceEvidenceRef, EvidenceRef>>;

/** Observation confidence is the W002 confidence grammar. */
export type ConfidenceParity = Expect<Equals<WorkspaceConfidence, Confidence>>;

/** Observation validity is the W002 validity grammar. */
export type ValidityParity = Expect<Equals<WorkspaceValidity, Validity>>;

/** The source reference is the W006 exact-revision grammar. */
export type SourceRefParity = Expect<Equals<WorkspaceSourceRef, ExactRevisionRef>>;

/** The authority-decision outcome vocabulary is the W022 outcome vocabulary. */
export type DecisionOutcomeParity = Expect<
  Equals<AuthorityDecisionRecord['outcome'], PolicyDecisionOutcome>
>;

/** Derived registration manifests are structurally registrable (W007). */
export type ManifestAssignable = Expect<
  DerivedCapabilityRegistration['manifest'] extends CapabilityManifest ? true : false
>;

/** The registration envelope shape is the W007 registration envelope shape. */
export type RegistrationAssignable = Expect<
  DerivedCapabilityRegistration extends CapabilityRegistration ? true : false
>;
