/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036).
 *
 * This file pins structural compatibility between the simulation-fabric
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W021 runtime-dependency policy:
 * @epoch/simulation-protocol, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `SimulationEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (simulation lifecycle events are append-only typed
 *   events over the W010 event shapes — the `simulation:*` payload
 *   namespace; the W036 delivery-event mirror precedent);
 * - `CapabilityBindingRef` fields are TYPE-EQUAL to the W007 capability
 *   registration vocabularies (capability id, semver version, and the
 *   manifest digest — the registration's content address): runs bind
 *   capability registrations by typed opaque reference, never structural
 *   copies;
 * - `SimulationRun['runDigest']`, `SimulationRunState['stateDigest']` and
 *   `SealedSimulationResult['resultDigest']` are TYPE-EQUAL to the W006
 *   evidence exact-revision digest grammar, and the sealed result digest
 *   is TYPE-EQUAL to the W006 verification run's produced-evidence
 *   element (fabric artifacts are exact-revision addressable evidence);
 * - the fabric's `tenant-isolation-rejected` rejection carries the same
 *   expected/encountered tenant fields the @epoch/authorization kernel
 *   uses for its cross-tenant denial (identity != tenancy !=
 *   authorization; the fabric enforces the tenancy boundary and the
 *   authorization kernel expresses the same boundary in decisions).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { SimulationEventContent } from './events';
import type {
  CapabilityBindingRef,
  SealedSimulationResult,
  SimulationRun,
  SimulationRunState,
} from './types';
import type { EventContent } from '@epoch/event-log';
import type { CapabilityId, CapabilityRecord, CapabilityVersion } from '@epoch/capability-registry';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { Run } from '@epoch/verification';
import type { TenantId as AuthorizationTenantId } from '@epoch/authorization';

/** Simulation events are W010 event shapes, structurally (W010 parity). */
export type SimulationEventParity = Expect<Equals<SimulationEventContent, EventContent>>;

/** Capability binding references carry the W007 capability vocabularies. */
export type CapabilityIdParity = Expect<
  Equals<CapabilityBindingRef['capabilityId'], CapabilityId>
>;
export type CapabilityVersionParity = Expect<
  Equals<CapabilityBindingRef['version'], CapabilityVersion>
>;

/** The binding's registration digest IS the W007 registration content address. */
export type RegistrationDigestParity = Expect<
  Equals<CapabilityBindingRef['registrationDigest'], CapabilityRecord['manifestDigest']>
>;

/** Fabric digests carry the W006 exact-revidence digest grammar. */
export type RunDigestEvidenceParity = Expect<
  Equals<SimulationRun['runDigest'], ExactRevisionRef['digest']>
>;
export type StateDigestEvidenceParity = Expect<
  Equals<SimulationRunState['stateDigest'], ExactRevisionRef['digest']>
>;

/** Sealed results are evidence-grade: the W006 verification run grammar. */
export type ResultDigestVerificationParity = Expect<
  Equals<SealedSimulationResult['resultDigest'], Run['producedEvidence'][number]>
>;

/** The tenant-isolation scope carries the authorization kernel's tenant grammar. */
export type TenantScopeAuthorizationParity = Expect<
  Equals<SimulationRun['tenantId'], AuthorizationTenantId>
>;
