/**
 * @epoch/world-contracts — published contract surface of the Epoch
 * Canonical World Model (Work Order W002).
 *
 * TYPES ONLY: this module has no runtime footprint and no dependencies. It
 * is consumed via the tsconfig path mapping `@epoch/world-contracts` (see
 * README.md) and re-exported by the kernel package `@epoch/world-model`,
 * which also ships the runtime zod validators proven equivalent to these
 * types at compile time and the JSON Schema documents proven equivalent to
 * the validators by the contract-sync test.
 */
export type * from './version';
export type * from './primitives';
export type * from './confidence';
export type * from './provenance';
export type * from './validity';
export type * from './entity';
export type * from './relation';
export type * from './assertion';
export type * from './event';
export type * from './ingestion';
export type * from './query';
export type * from './snapshot';
export type * from './statistics';
