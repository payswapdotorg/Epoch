import type { Instant, JsonObject } from './primitives';
import type { ActorRef } from './provenance';

/**
 * World events — the append-only temporal history of the world.
 *
 * Every state change in the world model is an event. Events carry the
 * global monotonic `sequence`, the acting `actor`, an opaque `subject`
 * (assertion id, type key, mapping id, or `world`), and an optional
 * machine-readable `detail` object. Point-in-time state is reconstructed
 * from assertions and events together; the event log is also the audit
 * trail (requirement R17).
 */

export type WorldEventType =
  | 'world-created'
  | 'entity-type-registered'
  | 'relation-type-registered'
  | 'external-mapping-registered'
  | 'assertion-applied'
  | 'assertion-superseded'
  | 'assertion-retracted';

export interface WorldEvent {
  readonly id: string;
  readonly sequence: number;
  readonly type: WorldEventType;
  readonly at: Instant;
  readonly actor: ActorRef;
  readonly subject: string;
  readonly detail?: JsonObject | undefined;
}
