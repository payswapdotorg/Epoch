/**
 * Compile-time type-equality utilities (the house Expect/Equals pair —
 * the W002/W006/W007 parity precedent, deliberately duplicated per
 * package because the adapters share NO runtime coupling).
 */

/** True when A and B are the same type (mutual assignability). */
export type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Compile-time assertion: the expression must be true. */
export type Expect<T extends true> = T;
