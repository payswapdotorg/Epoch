/**
 * Runtime validators (zod) for the world contract types.
 *
 * These schemas are the executable form of `@epoch/world-contracts`:
 * - compile-time equivalence with the contract types is proven in
 *   `./type-sync.ts`;
 * - JSON Schema documents published under `contracts/world/schemas/` are
 *   proven byte-equivalent to `z.toJSONSchema()` of these schemas by
 *   `test/contracts-sync.test.ts`.
 */

export * from './primitives';
export * from './confidence';
export * from './provenance';
export * from './validity';
export * from './entity';
export * from './relation';
export * from './assertion';
export * from './event';
export * from './ingestion';
export * from './query';
export * from './snapshot';
export * from './statistics';
export type * from './type-sync';
