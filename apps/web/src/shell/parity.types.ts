// COMPILE-TIME PARITY with the merged upstream contract surfaces (verified
// by `tsc --noEmit`; the @epoch/authorization W004-parity precedent).
//
// The shell-owned structural mirrors in src/shell/version.ts must be
// IDENTICAL to the upstream vocabularies under the strictest TypeScript
// type-equality check. If an upstream contract ever evolves incompatibly,
// THIS file fails typecheck and the drift surfaces immediately. Type-only
// imports: the web app has NO runtime dependency on these packages
// (devDependencies only, the Tech Lead W014 dependency pin).
import type { PrincipalKind, PrincipalLifecycleState } from '@epoch/identity';
import type { DenialCode, PrincipalStatus as AuthorizationPrincipalStatus } from '@epoch/authorization';
import type { ExperienceGraphKind } from '@epoch/experience-protocol';
import type {
  ExperienceGraphKind as ShellExperienceGraphKind,
  NavigationDenialCode,
  PrincipalKind as ShellPrincipalKind,
  PrincipalStatus as ShellPrincipalStatus,
} from './version';

/** Strict type equality (the kernel type-utils discipline). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Compile-time assertion helper. */
type Expect<T extends true> = T;

// --- @epoch/identity (W009) ---------------------------------------------------

/** The shell principal-kind vocabulary equals @epoch/identity's. */
export type PrincipalKindParity = Expect<Equals<ShellPrincipalKind, PrincipalKind>>;

/** The shell principal-status vocabulary equals @epoch/identity's lifecycle states. */
export type PrincipalStatusParity = Expect<Equals<ShellPrincipalStatus, PrincipalLifecycleState>>;

// --- @epoch/authorization (W009) ----------------------------------------------

/** The shell principal-status vocabulary equals @epoch/authorization's status projection. */
export type AuthorizationStatusParity = Expect<
  Equals<ShellPrincipalStatus, AuthorizationPrincipalStatus>
>;

/** The mirrored navigation denial codes are @epoch/authorization denial codes. */
export type MirroredDenialSubsetParity = Expect<
  Equals<
    ('cross-tenant-denied' | 'unauthenticated-principal' | 'inactive-principal') extends DenialCode
      ? true
      : false,
    true
  >
>;

/** The navigation denial vocabulary is exactly the shell-owned + mirrored codes. */
export type NavigationDenialParity = Expect<
  Equals<
    NavigationDenialCode,
    | 'unknown-route'
    | 'malformed-route'
    | 'insufficient-permissions'
    | 'cross-tenant-denied'
    | 'unauthenticated-principal'
    | 'inactive-principal'
  >
>;

// --- @epoch/experience-protocol (W011) ----------------------------------------

/** The shell Experience Graph kinds equal @epoch/experience-protocol's. */
export type ExperienceGraphKindParity = Expect<
  Equals<ShellExperienceGraphKind, ExperienceGraphKind>
>;
