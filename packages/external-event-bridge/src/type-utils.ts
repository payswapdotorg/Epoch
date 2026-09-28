/**
 * Compile-time assertion helpers (the W007/W036 type-utils convention).
 * `Equals` is the strictest type identity (it distinguishes optionality,
 * readonly and union membership); `Expect` fails compilation unless its
 * argument is `true`.
 */

/** Strictest type identity: distinguishes optionality, readonly, unions. */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
export type Expect<T extends true> = T;
