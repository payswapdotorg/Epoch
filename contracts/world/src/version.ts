/**
 * Contract versioning for the Epoch Canonical World Model.
 *
 * This module pins the version of the world contract surface. The literal
 * types below are the single source of truth for the contract version; the
 * kernel package (`@epoch/world-model`) holds runtime constants typed by
 * them, so a version bump fails compilation until every runtime mirror is
 * updated, and the JSON Schema `$id`s published under `schemas/` embed the
 * same version (enforced by the contract-sync test).
 */

/**
 * The world contract version. Semver-shaped, but expressed as an exact
 * literal so that serialized forms and the kernel runtime constants are
 * compile-time pinned to one value.
 */
export type WorldContractsVersion = '1.0.0';

/**
 * The schema discriminator written into every serialized form produced by
 * the world model.
 */
export type WorldModelSchemaName = 'epoch.world-model';

/**
 * The versioned envelope shared by every serialized world artifact.
 */
export interface VersionedEnvelope {
  readonly schema: WorldModelSchemaName;
  readonly version: WorldContractsVersion;
}
