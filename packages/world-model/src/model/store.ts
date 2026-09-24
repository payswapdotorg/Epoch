import type {
  ActorRef,
  Assertion,
  AssertionId,
  EntityId,
  ExternalMapping,
  Instant,
  JsonObject,
  WorldEvent,
  WorldEventType,
} from '@epoch/world-contracts';
import { deepFreeze } from '../immutable';
import { parseKey } from './keys';
import { TypeRegistry } from './registry';

/**
 * The internal mutable world store. Owned exclusively by the WorldModel
 * authority — nothing outside this package ever sees it. All records put
 * into the store are deep-frozen value objects; lifecycle transitions are
 * copy-on-write.
 */
export class WorldStore {
  readonly registry = new TypeRegistry();
  readonly externalMappings = new Map<string, ExternalMapping>();
  readonly assertions = new Map<AssertionId, Assertion>();
  /** Reconciliation key -> assertion ids in append (sequence) order. */
  readonly byKey = new Map<string, AssertionId[]>();
  readonly events: WorldEvent[] = [];
  sequence = 0;

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  appendEvent(input: {
    type: WorldEventType;
    at: Instant;
    actor: ActorRef;
    subject: string;
    detail?: JsonObject;
  }): WorldEvent {
    const event: WorldEvent = {
      id: `evt-${this.nextSequence()}`,
      sequence: this.sequence,
      type: input.type,
      at: input.at,
      actor: input.actor,
      subject: input.subject,
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
    };
    this.events.push(deepFreeze(event));
    return event;
  }

  indexAssertion(record: Assertion): void {
    this.assertions.set(record.id, record);
    const ids = this.byKey.get(record.key);
    if (ids === undefined) {
      this.byKey.set(record.key, [record.id]);
    } else {
      ids.push(record.id);
    }
  }

  /** Copy-on-write lifecycle update of an existing record (same id). */
  replaceAssertion(record: Assertion): void {
    this.assertions.set(record.id, record);
  }

  /** All entity ids that have ever had an entity assertion. */
  entityIds(): readonly EntityId[] {
    const ids = new Set<EntityId>();
    for (const key of this.byKey.keys()) {
      const parsed = parseKey(key);
      if (parsed !== null && parsed[0] === 'entity') {
        ids.add(parsed[1]);
      }
    }
    return [...ids].sort();
  }

  /** All relation reconciliation keys. */
  relationKeys(): readonly string[] {
    const keys: string[] = [];
    for (const key of this.byKey.keys()) {
      const parsed = parseKey(key);
      if (parsed !== null && parsed[0] === 'rel') {
        keys.push(key);
      }
    }
    return keys.sort();
  }

  /** All property reconciliation keys of one entity. */
  propertyKeysOf(entityId: EntityId): readonly string[] {
    const keys: string[] = [];
    for (const key of this.byKey.keys()) {
      const parsed = parseKey(key);
      if (parsed !== null && parsed[0] === 'prop' && parsed[1] === entityId) {
        keys.push(key);
      }
    }
    return keys.sort();
  }
}
