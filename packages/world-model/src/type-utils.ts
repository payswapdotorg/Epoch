/**
 * Compile-time type equality helpers (internal).
 *
 * Used by `src/schema/type-sync.ts` to prove that the kernel's zod
 * validators infer EXACTLY the published contract types from
 * `@epoch/world-contracts` — the type-level half of the contract-sync
 * guarantee (the JSON-Schema half lives in the contract-sync test).
 */

/**
 * True when `X` and `Y` are the identical type (stricter than mutual
 * assignability; distinguishes readonly and optional differences).
 */
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/** Compile-time assertion: the type argument must be `true`. */
export type Expect<T extends true> = T;
