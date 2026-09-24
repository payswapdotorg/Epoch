import type { Confidence } from './confidence';
import type { Provenance } from './provenance';
import type {
  AssertionId,
  EntityId,
  Instant,
  JsonValue,
  PropertyBag,
  PropertyName,
  TypeKey,
} from './primitives';
import type { Validity } from './validity';

/**
 * Assertions — the unit of stated truth in the Canonical World Model.
 *
 * The graph is assertion-driven: entities, their property values, and
 * relations exist because assertions state them. Assertions retain source
 * (provenance), timestamp, confidence and validity, and are reconciled by
 * the model (latest-wins with full history, plus explicit supersession).
 * History is never silently discarded — superseded and retracted
 * assertions remain addressable and are carried in snapshots.
 */

/** What an assertion states. Discriminated by `kind`. */
export type AssertionStatement =
  | {
      /** Establishes (a new epoch of) an entity with a type and initial properties. */
      readonly kind: 'entity';
      readonly entityId: EntityId;
      readonly entityType: TypeKey;
      readonly properties?: PropertyBag | undefined;
    }
  | {
      /** States the value of one property of an entity. */
      readonly kind: 'entity-property';
      readonly entityId: EntityId;
      readonly property: PropertyName;
      readonly value: JsonValue;
    }
  | {
      /** Establishes a typed relation between two existing entities. */
      readonly kind: 'relation';
      readonly relationType: TypeKey;
      readonly source: EntityId;
      readonly target: EntityId;
      readonly properties?: PropertyBag | undefined;
    };

/** Lifecycle status of an assertion record. */
export type AssertionStatus = 'live' | 'superseded' | 'retracted';

/**
 * An assertion record. Lifecycle fields (`status`, `supersededBy`,
 * `retractedAt`, `retractionReason`) are maintained by the world model
 * authority via copy-on-write; records are immutable once published to
 * readers.
 */
export interface Assertion {
  readonly id: AssertionId;
  /** Reconciliation key (opaque, deterministically derived from the statement). */
  readonly key: string;
  readonly statement: AssertionStatement;
  readonly status: AssertionStatus;
  /** Monotonic sequence position of this record in the world history. */
  readonly sequence: number;
  readonly assertedAt: Instant;
  readonly provenance: Provenance;
  readonly confidence: Confidence;
  readonly validity?: Validity | undefined;
  /** Explicit supersession target (this assertion replaces that one). */
  readonly supersedes?: AssertionId | undefined;
  /** Set when a later assertion explicitly supersedes this one. */
  readonly supersededBy?: AssertionId | undefined;
  readonly retractedAt?: Instant | undefined;
  readonly retractionReason?: string | undefined;
}

/**
 * Authority-gated write input for stating an assertion. Provenance and
 * confidence are mandatory — unattributed writes are structurally
 * impossible. `at` may backdate an assertion (the reconciliation engine is
 * temporal), and `supersedes` requests explicit supersession of a live
 * assertion addressing the same reconciliation key.
 */
export interface AssertionInput {
  readonly statement: AssertionStatement;
  readonly provenance: Provenance;
  readonly confidence: Confidence;
  readonly validity?: Validity | undefined;
  readonly supersedes?: AssertionId | undefined;
  readonly at?: Instant | undefined;
}

/**
 * Authority-gated write input for retracting a live assertion. Retraction
 * is a tombstone with retained history, not a deletion.
 */
export interface RetractionInput {
  readonly assertionId: AssertionId;
  readonly reason: string;
  readonly provenance: Provenance;
  readonly at?: Instant | undefined;
}
