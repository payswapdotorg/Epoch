/**
 * @epoch/world-model — the Canonical World Model (Epoch semantic authority).
 *
 * Public surface:
 * - the published contract types, re-exported from
 *   `@epoch/world-contracts` (types only — fully erased at runtime);
 * - the runtime zod validators for every contract type;
 * - the `WorldModel` authority class and its read views;
 * - deterministic serialization primitives (canonical JSON, sha-256).
 *
 * Layer: kernel (may be consumed by contracts/kernel/experience/pack/
 * service/app layers per the Epoch layer model).
 */
export type * from '@epoch/world-contracts';

export {
  WORLD_CONTRACTS_VERSION,
  WORLD_MODEL_SCHEMA_NAME,
  WORLD_MODEL_SYSTEM_ACTOR_ID,
} from './version';
export { WorldModelError, type WorldModelErrorCode } from './errors';
export { canonicalJson } from './canonical';
export { sha256Hex } from './sha256';
export { systemClock, type Clock } from './clock';
export { deepFreeze, deepClone } from './immutable';

export * from './schema';
export {
  WorldModel,
  type WorldModelOptions,
  type WorldReadView,
  type EntityFilter,
  type RelationFilter,
  type EventFilter,
} from './model/world-model';
export {
  entityKey,
  propertyKey,
  relationKey,
  statementKey,
  relationKeyId,
  parseKey,
} from './model/keys';
export { confidenceUpperBound } from './model/reconcile';
export { CORE_ENTITY_TYPES, CORE_RELATION_TYPES } from './model/core-vocabulary';
