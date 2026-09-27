/**
 * Minimal type-level assertion helpers (the W036/W038 kernel-parity
 * pattern). Type-only; never imported by runtime code.
 */

/** Strictest type identity: distinguishes optionality, readonly, unions. */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
export type Expect<T extends true> = T;
