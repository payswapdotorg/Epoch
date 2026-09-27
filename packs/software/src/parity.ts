/**
 * COMPILE-TIME PACK PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036).
 *
 * This file pins structural compatibility between the software-pack
 * shapes and the sibling kernel/experience vocabularies WITHOUT adding
 * runtime dependencies beyond the W027 runtime-dependency policy
 * (@epoch/solution-delivery, @epoch/action-protocol,
 * @epoch/agent-protocol, @epoch/world-model, @epoch/tenancy, and zod
 * only):
 *
 * - the software profile IS the W036 `SolutionPackProfile` type
 *   (DP1.0: a pack INSTANTIATES the kernel profile schema, never a
 *   second profile authority);
 * - the mirrored confidence-method vocabulary is TYPE-EQUAL to the W006
 *   evidence `ConfidenceMethod` grammar (verification descriptors are
 *   evidence-shaped);
 * - the entity-binding type keys are TYPE-EQUAL to the W002 world-model
 *   `TypeKey` grammar (bindings reference world entity kinds, they never
 *   define new authorities);
 * - the constraint-descriptor policy bindings are TYPE-EQUAL to the W004
 *   `PolicyBinding` shape (constraint descriptors specialize the
 *   policy-contract grammar);
 * - the capability-dependency ids are TYPE-EQUAL to the W007
 *   `CapabilityId` grammar (a pack may request kernel capability
 *   classes);
 * - the rendered deploy proposal IS the W003 `ActionProposal` type (the
 *   authority seam: deployment actions leave the pack as typed
 *   proposals only).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { SolutionPackProfile } from '@epoch/solution-delivery';
import type { ActionProposal } from '@epoch/action-protocol';
import type { ConfidenceMethod } from '@epoch/evidence';
import type { TypeKey } from '@epoch/world-model';
import type { PolicyBinding } from '@epoch/policy-contracts';
import type { CapabilityId } from '@epoch/capability-registry';
import type { ConstraintPolicyBinding } from './constraints';
import type { PackConfidenceMethod } from './verification';
import type { EntityBinding } from './entities';
import type { renderDeployProposal } from './deployment';
import type { SOFTWARE_CAPABILITY_DEPENDENCIES } from './profile';

/** The software profile instantiates the W036 pack-profile type. */
export type ProfileParity = Expect<
  Equals<ReturnType<typeof import('./profile').softwarePackProfile>, SolutionPackProfile>
>;

/** Verification descriptors carry the W006 confidence-method grammar. */
export type ConfidenceMethodParity = Expect<Equals<PackConfidenceMethod, ConfidenceMethod>>;

/** Entity bindings carry the W002 world-model type-key grammar. */
export type EntityTypeKeyParity = Expect<Equals<EntityBinding['entityTypeKey'], TypeKey>>;

/** Constraint descriptors carry the W004 policy-binding grammar (property parity). */
export type PolicyBindingIdParity = Expect<
  Equals<ConstraintPolicyBinding['constraintId'], PolicyBinding['constraintId']>
>;

/** Constraint descriptor version pins carry the W004 semver grammar (property parity). */
export type PolicyBindingVersionParity = Expect<
  Equals<ConstraintPolicyBinding['constraintVersion'], PolicyBinding['constraintVersion']>
>;

/** Capability dependencies carry the W007 capability-id grammar. */
export type CapabilityDependencyParity = Expect<
  Equals<(typeof SOFTWARE_CAPABILITY_DEPENDENCIES)[number], CapabilityId>
>;

/** The rendered deploy proposal IS the W003 action proposal (the authority seam). */
export type DeployProposalParity = Expect<
  Equals<Extract<Awaited<ReturnType<typeof renderDeployProposal>>, { ok: true }>['value'], ActionProposal>
>;
