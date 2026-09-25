// COMPILE-TIME PARITY with the frozen W004 policy-contracts shapes and
// the sibling W009 packages (verified by `tsc --noEmit`).
//
// The @epoch/authorization types that MEET those contracts must be
// IDENTICAL to them under the strictest TypeScript type-equality check.
// If a frozen contract ever evolves incompatibly, THIS file fails
// typecheck and the drift surfaces immediately. Type-only imports: the
// package has NO runtime dependency on these packages (devDependencies
// only, the W006 evidence -> W002 world-model precedent).
import type {
  PolicyPrecedenceTier,
  PolicyTarget,
} from '@epoch/policy-contracts';
import type { PrincipalLifecycleState } from '@epoch/identity';
import type { TenancyNodeKind } from '@epoch/tenancy';
import type { Equals, Expect } from '../src/type-utils';
import type {
  AuthorizationPolicyTarget,
  PrincipalStatus,
} from '../src/index';

// --- W004 policy-contracts ---------------------------------------------------

/** The policy-target projection is EXACTLY the W004 PolicyTarget shape. */
export type PolicyTargetParity = Expect<
  Equals<AuthorizationPolicyTarget, PolicyTarget>
>;

// --- @epoch/tenancy (structural, NO runtime coupling) ------------------------

/** The tenancy organizational kinds that policy tiers address are exactly the W004 tiers. */
export type PolicyTierParity = Expect<
  Equals<Extract<TenancyNodeKind, PolicyPrecedenceTier>, PolicyPrecedenceTier>
>;

// --- @epoch/identity (structural, NO runtime coupling) -----------------------

/** The principal-status facts equal the @epoch/identity lifecycle states. */
export type PrincipalStatusParity = Expect<
  Equals<PrincipalStatus, PrincipalLifecycleState>
>;
