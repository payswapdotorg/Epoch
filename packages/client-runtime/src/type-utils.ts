/**
 * Compile-time assertion helpers (the W002 type-sync pattern).
 */
/** Strictest type identity: distinguishes optionality, readonly, unions. */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless `T` is `true`. */
export type Expect<T extends true> = T;
