import type { Assertion } from './assertion';
import type { EntityTypeDefinition } from './entity';
import type { ExternalMapping } from './ingestion';
import type { RelationTypeDefinition } from './relation';
import type { WorldEvent } from './event';
import type { WorldContractsVersion, WorldModelSchemaName } from './version';

/**
 * Snapshots — the deterministic, versioned, serializable form of a world.
 *
 * A snapshot carries the FULL history (all assertions with their lifecycle
 * state, the complete event log, all registered types and external
 * mappings) so that nothing is ever silently discarded. The `digest` is a
 * SHA-256 hash over the canonical JSON form of the content (every field
 * except `digest` itself); `WorldModel.fromSnapshot` recomputes and
 * verifies it, rejecting tampered snapshots.
 *
 * Determinism: collections are ordered canonically (types by key, mappings
 * by id, assertions and events by sequence) and canonical JSON sorts object
 * keys, so equal histories produce byte-identical serializations.
 */

/** The full historical content of a world snapshot. */
export interface WorldSnapshotContent {
  readonly schema: WorldModelSchemaName;
  readonly version: WorldContractsVersion;
  /** Last consumed global sequence number. */
  readonly sequence: number;
  readonly entityTypes: readonly EntityTypeDefinition[];
  readonly relationTypes: readonly RelationTypeDefinition[];
  readonly externalMappings: readonly ExternalMapping[];
  /** Every assertion ever applied, ordered by sequence. */
  readonly assertions: readonly Assertion[];
  /** The complete append-only event log, ordered by sequence. */
  readonly events: readonly WorldEvent[];
}

/** A world snapshot with its integrity digest. */
export interface WorldSnapshot extends WorldSnapshotContent {
  /** SHA-256 hex digest of the canonical JSON form of the content. */
  readonly digest: string;
}
