import type { WorldContractsVersion, WorldModelSchemaName } from '@epoch/world-contracts';

/**
 * Runtime mirrors of the contract version pins
 * (contracts/world/src/version.ts).
 *
 * These constants are TYPED by the contract literal types, so bumping the
 * contract version is a compile-time break here until this file, the zod
 * literal schemas and the published JSON Schemas are updated together.
 */
export const WORLD_CONTRACTS_VERSION: WorldContractsVersion = '1.0.0';
export const WORLD_MODEL_SCHEMA_NAME: WorldModelSchemaName = 'epoch.world-model';

/**
 * The reserved actor used for world-model system events (world creation).
 * Domain assertions always carry the acting party's provenance.
 */
export const WORLD_MODEL_SYSTEM_ACTOR_ID = 'system:world-model';
