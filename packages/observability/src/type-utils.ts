/**
 * Type-level test helpers (the W006/W009/W010/W036/W038/W043
 * convention): `Expect` forces the compiler to reject an un-evaluated
 * assertion; `Equals` proves mutual assignability + identity.
 */
export type Expect<T extends true> = T;
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false;
