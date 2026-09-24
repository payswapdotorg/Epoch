import type {
  ActorRef,
  Assertion,
  AssertionId,
  AssertionInput,
  DecisionScopeSpec,
  Entity,
  EntityId,
  EntityTypeDefinition,
  ExternalMapping,
  Instant,
  Relation,
  RelationTypeDefinition,
  RetractionInput,
  TaskSufficientWorld,
  TypeKey,
  WorldEvent,
  WorldEventType,
  WorldSnapshot,
  WorldStatistics,
} from '@epoch/world-contracts';
import { canonicalJson } from '../canonical';
import { WorldModelError, issuesToDetails } from '../errors';
import { deepFreeze } from '../immutable';
import { sha256Hex } from '../sha256';
import {
  ActorRefSchema,
  AssertionInputSchema,
  ExternalMappingSchema,
  InstantSchema,
  RetractionInputSchema,
  WorldSnapshotSchema,
} from '../schema';
import { systemClock, type Clock } from '../clock';
import { WORLD_CONTRACTS_VERSION, WORLD_MODEL_SCHEMA_NAME, WORLD_MODEL_SYSTEM_ACTOR_ID } from '../version';
import { entityKey, relationKey, statementKey } from './keys';
import {
  entityHistoryAt,
  materializeAllEntities,
  materializeAllRelations,
  materializeEntityAt,
  materializeRelationAt,
  relationHistoryAt,
} from './materialize';
import { resolveKeyAt } from './reconcile';
import { TypeRegistry } from './registry';
import { decisionScopeAt } from './sufficiency';
import { WorldStore } from './store';

/**
 * The Canonical World Model — the Epoch semantic authority.
 *
 * A typed property/relationship graph whose every state change is an
 * attributed, confidence-carrying, temporally-valid assertion, with full
 * append-only history, point-in-time reconstruction, deterministic
 * serialization, and epistemic (task-sufficiency) queries.
 *
 * Authority model (architecture-lock rules 1-2):
 * - this class is the ONLY writer of durable world state (in-memory store
 *   + serializable snapshots);
 * - every semantic write (`applyAssertion` / `retractAssertion`) requires
 *   provenance — unattributed writes are structurally impossible;
 * - every value handed to readers is deep-frozen — agents and views are
 *   read-only participants;
 * - external standards map INTO the model as pure data
 *   (`registerExternalMapping`); no provider semantics enter kernel types.
 *
 * Agents propose through the action protocol (W003/W022); the world model
 * ingests authoritative statements through this surface.
 */

export interface WorldModelOptions {
  /** Deterministic-clock injection point (tests, replay). */
  readonly clock?: Clock;
}

export interface EntityFilter {
  readonly type?: TypeKey;
}

export interface RelationFilter {
  readonly type?: TypeKey;
  readonly ofEntity?: EntityId;
}

export interface EventFilter {
  /** Exclude events with sequence <= this value. */
  readonly sinceSequence?: number;
  readonly type?: WorldEventType;
}

/** A point-in-time, read-only projection of the world. */
export interface WorldReadView {
  readonly at: Instant;
  getEntity(entityId: EntityId): Entity | null;
  getRelation(relation: { type: TypeKey; source: EntityId; target: EntityId }): Relation | null;
  listEntities(filter?: EntityFilter): readonly Entity[];
  listRelations(filter?: RelationFilter): readonly Relation[];
  resolveAssertion(key: string): Assertion | null;
  entityHistory(entityId: EntityId): readonly Assertion[];
  relationHistory(relationType: TypeKey, source: EntityId, target: EntityId): readonly Assertion[];
  decisionScope(spec: DecisionScopeSpec): TaskSufficientWorld;
}

const SYSTEM_ACTOR: ActorRef = deepFreeze({ id: WORLD_MODEL_SYSTEM_ACTOR_ID, role: 'system' });

export class WorldModel {
  private constructor(
    private readonly store: WorldStore,
    private readonly clock: Clock,
  ) {}

  /** Create an empty world with the builtin `core:` vocabulary registered. */
  static create(options: WorldModelOptions = {}): WorldModel {
    const clock = options.clock ?? systemClock;
    const store = new WorldStore();
    store.appendEvent({ type: 'world-created', at: clock(), actor: SYSTEM_ACTOR, subject: 'world' });
    return new WorldModel(store, clock);
  }

  /**
   * Restore a world from a snapshot. Validates the envelope, the contract
   * version, the deterministic ordering invariants, the integrity digest,
   * the core vocabulary, and every derived key and cross-reference before
   * rebuilding the store. Tampered snapshots are rejected (WM_INTEGRITY).
   * Loading emits no new events — restored history is exact.
   */
  static fromSnapshot(snapshot: WorldSnapshot, options: WorldModelOptions = {}): WorldModel {
    if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new WorldModelError('WM_SCHEMA', 'snapshot must be a world snapshot object');
    }
    const loose = snapshot as { schema?: unknown; version?: unknown };
    if (loose.schema !== WORLD_MODEL_SCHEMA_NAME || loose.version !== WORLD_CONTRACTS_VERSION) {
      throw new WorldModelError(
        'WM_VERSION_MISMATCH',
        `snapshot schema/version mismatch: expected ${WORLD_MODEL_SCHEMA_NAME}/${WORLD_CONTRACTS_VERSION}, received ${String(loose.schema)}/${String(loose.version)}`,
      );
    }
    const parsed = WorldSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      throw new WorldModelError('WM_SCHEMA', 'malformed world snapshot', issuesToDetails(parsed.error.issues));
    }
    const data = deepFreeze(parsed.data);
    const { digest, ...content } = data;
    const computed = sha256Hex(canonicalJson(content));
    if (computed !== digest) {
      throw new WorldModelError(
        'WM_INTEGRITY',
        `snapshot digest mismatch: expected ${digest}, computed ${computed}`,
      );
    }

    const store = new WorldStore();
    restoreCoreVocabulary(store, data.entityTypes, data.relationTypes);
    restoreEntityTypes(store, data.entityTypes);
    restoreRelationTypes(store, data.relationTypes);
    restoreExternalMappings(store, data.externalMappings);
    restoreHistory(store, data.assertions, data.events);
    store.sequence = data.sequence;
    return new WorldModel(store, options.clock ?? systemClock);
  }

  // -------------------------------------------------------------------------
  // Ontology registration (kernel-side declarations)
  // -------------------------------------------------------------------------

  registerEntityType(definition: EntityTypeDefinition, actor?: ActorRef): EntityTypeDefinition {
    const stored = this.store.registry.registerEntityType(definition);
    this.store.appendEvent({
      type: 'entity-type-registered',
      at: this.clock(),
      actor: parseActor(actor),
      subject: stored.key,
      detail: { origin: stored.origin ?? 'extension' },
    });
    return stored;
  }

  registerRelationType(definition: RelationTypeDefinition, actor?: ActorRef): RelationTypeDefinition {
    const stored = this.store.registry.registerRelationType(definition);
    this.store.appendEvent({
      type: 'relation-type-registered',
      at: this.clock(),
      actor: parseActor(actor),
      subject: stored.key,
      detail: { sourceType: stored.sourceType, targetType: stored.targetType },
    });
    return stored;
  }

  /**
   * Register a declared-external mapping of an external standard into
   * registered Epoch types. Pure data: the world model validates targets
   * and stores the mapping for lookup — it never executes mapping logic.
   * Concrete provider adapters (Git/IFC/MCP/FMI, ...) arrive in later Work
   * Orders and sit behind this surface.
   */
  registerExternalMapping(mapping: ExternalMapping, actor?: ActorRef): ExternalMapping {
    if (mapping !== null && typeof mapping === 'object' && mapping.standard === 'epoch') {
      throw new WorldModelError('WM_AUTHORITY', "standard 'epoch' is reserved for the kernel");
    }
    const parsed = ExternalMappingSchema.safeParse(mapping);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid external mapping', issuesToDetails(parsed.error.issues));
    }
    const value = parsed.data;
    if (this.store.externalMappings.has(value.id)) {
      throw new WorldModelError('WM_CONFLICT', `external mapping '${value.id}' is already registered`);
    }
    for (const entityMapping of value.entityTypes) {
      if (this.store.registry.getEntityType(entityMapping.target) === null) {
        throw new WorldModelError(
          'WM_NOT_FOUND',
          `external mapping '${value.id}' targets unknown entity type '${entityMapping.target}'`,
        );
      }
    }
    for (const relationMapping of value.relationTypes) {
      if (this.store.registry.getRelationType(relationMapping.target) === null) {
        throw new WorldModelError(
          'WM_NOT_FOUND',
          `external mapping '${value.id}' targets unknown relation type '${relationMapping.target}'`,
        );
      }
    }
    this.store.externalMappings.set(value.id, deepFreeze(value));
    this.store.appendEvent({
      type: 'external-mapping-registered',
      at: this.clock(),
      actor: parseActor(actor),
      subject: value.id,
      detail: { standard: value.standard },
    });
    return value;
  }

  getExternalMapping(id: string): ExternalMapping | null {
    return this.store.externalMappings.get(id) ?? null;
  }

  listExternalMappings(): readonly ExternalMapping[] {
    return Object.freeze([...this.store.externalMappings.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
  }

  // -------------------------------------------------------------------------
  // Authority-gated semantic writes (provenance is mandatory)
  // -------------------------------------------------------------------------

  /**
   * State an assertion — the unit of stated truth. Validates the full
   * input (schema + ontology + endpoints + provenance links), assigns the
   * monotonic sequence/id, applies explicit supersession when requested,
   * appends audit events, and returns the immutable assertion record.
   */
  applyAssertion(input: AssertionInput): Assertion {
    const parsed = AssertionInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid assertion input', issuesToDetails(parsed.error.issues));
    }
    const value = parsed.data;
    const at = value.at ?? this.clock();
    this.validateStatement(value.statement, at);
    for (const derivedId of value.provenance.derivedFrom ?? []) {
      if (!this.store.assertions.has(derivedId)) {
        throw new WorldModelError(
          'WM_NOT_FOUND',
          `provenance derives from unknown assertion '${derivedId}'`,
        );
      }
    }

    const key = statementKey(value.statement);
    let superseded: Assertion | undefined;
    if (value.supersedes !== undefined) {
      const target = this.store.assertions.get(value.supersedes);
      if (target === undefined) {
        throw new WorldModelError('WM_NOT_FOUND', `cannot supersede unknown assertion '${value.supersedes}'`);
      }
      if (target.key !== key) {
        throw new WorldModelError(
          'WM_CONFLICT',
          `supersession target '${target.id}' addresses a different reconciliation key`,
        );
      }
      if (target.status !== 'live') {
        throw new WorldModelError(
          'WM_CONFLICT',
          `only live assertions can be superseded; '${target.id}' is ${target.status}`,
        );
      }
      superseded = target;
    }

    const sequence = this.store.nextSequence();
    const record: Assertion = deepFreeze({
      id: `ass-${sequence}`,
      key,
      statement: value.statement,
      status: 'live',
      sequence,
      assertedAt: at,
      provenance: value.provenance,
      confidence: value.confidence,
      ...(value.validity !== undefined ? { validity: value.validity } : {}),
      ...(value.supersedes !== undefined ? { supersedes: value.supersedes } : {}),
    });
    this.store.indexAssertion(record);
    if (superseded !== undefined) {
      this.store.replaceAssertion(
        deepFreeze({ ...superseded, status: 'superseded', supersededBy: record.id }),
      );
    }

    this.store.appendEvent({
      type: 'assertion-applied',
      at,
      actor: value.provenance.actor,
      subject: record.id,
      detail: { key, statementKind: value.statement.kind, ...(superseded !== undefined ? { supersedes: superseded.id } : {}) },
    });
    if (superseded !== undefined) {
      this.store.appendEvent({
        type: 'assertion-superseded',
        at,
        actor: value.provenance.actor,
        subject: superseded.id,
        detail: { by: record.id },
      });
    }
    return record;
  }

  /**
   * Retract a live assertion — a tombstone with retained history, never a
   * deletion. The subject reconciliation key falls back to the next live
   * assertion (if any) from the retraction instant onward.
   */
  retractAssertion(input: RetractionInput): Assertion {
    const parsed = RetractionInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid retraction input', issuesToDetails(parsed.error.issues));
    }
    const value = parsed.data;
    const target = this.store.assertions.get(value.assertionId);
    if (target === undefined) {
      throw new WorldModelError('WM_NOT_FOUND', `cannot retract unknown assertion '${value.assertionId}'`);
    }
    if (target.status !== 'live') {
      throw new WorldModelError(
        'WM_CONFLICT',
        `only live assertions can be retracted; '${target.id}' is ${target.status}`,
      );
    }
    const at = value.at ?? this.clock();
    const record: Assertion = deepFreeze({
      ...target,
      status: 'retracted',
      retractedAt: at,
      retractionReason: value.reason,
    });
    this.store.replaceAssertion(record);
    this.store.appendEvent({
      type: 'assertion-retracted',
      at,
      actor: value.provenance.actor,
      subject: record.id,
      detail: { reason: value.reason },
    });
    return record;
  }

  // -------------------------------------------------------------------------
  // Reads (immutable views)
  // -------------------------------------------------------------------------

  getAssertion(id: AssertionId): Assertion | null {
    return this.store.assertions.get(id) ?? null;
  }

  getEntity(entityId: EntityId, at?: Instant): Entity | null {
    return materializeEntityAt(this.store, entityId, this.instantOrNow(at));
  }

  getRelation(relation: { type: TypeKey; source: EntityId; target: EntityId }, at?: Instant): Relation | null {
    return materializeRelationAt(this.store, relationKey(relation.type, relation.source, relation.target), this.instantOrNow(at));
  }

  listEntities(filter?: EntityFilter, at?: Instant): readonly Entity[] {
    return Object.freeze(materializeAllEntities(this.store, this.instantOrNow(at), filter?.type));
  }

  listRelations(filter?: RelationFilter, at?: Instant): readonly Relation[] {
    return Object.freeze(materializeAllRelations(this.store, this.instantOrNow(at), filter));
  }

  /** Generic escape hatch: the live assertion resolving a reconciliation key. */
  resolveAssertion(key: string, at?: Instant): Assertion | null {
    return resolveKeyAt(this.store, key, this.instantOrNow(at));
  }

  /** Every assertion ever made about one entity (existence + properties), in sequence order. */
  entityHistory(entityId: EntityId): readonly Assertion[] {
    return Object.freeze(entityHistoryAt(this.store, entityId));
  }

  /** Every assertion ever made against one relation triple, in sequence order. */
  relationHistory(relationType: TypeKey, source: EntityId, target: EntityId): readonly Assertion[] {
    return Object.freeze(relationHistoryAt(this.store, relationType, source, target));
  }

  /** The append-only event log (audit trail), optionally filtered. */
  events(filter?: EventFilter): readonly WorldEvent[] {
    const all = this.store.events;
    if (filter === undefined) {
      return Object.freeze([...all]);
    }
    return Object.freeze(
      all.filter(
        (event) =>
          (filter.sinceSequence === undefined || event.sequence > filter.sinceSequence) &&
          (filter.type === undefined || event.type === filter.type),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Temporal projection
  // -------------------------------------------------------------------------

  /** A point-in-time read-only view of the world. */
  asOf(at: Instant): WorldReadView {
    const parsed = InstantSchema.safeParse(at);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid instant for asOf', issuesToDetails(parsed.error.issues));
    }
    return makeReadView(this.store, at);
  }

  // -------------------------------------------------------------------------
  // Epistemic queries (task-sufficient reconstruction)
  // -------------------------------------------------------------------------

  decisionScope(spec: DecisionScopeSpec): TaskSufficientWorld {
    return decisionScopeAt(this.store, spec, this.clock());
  }

  // -------------------------------------------------------------------------
  // Serialization (deterministic, versioned, digest-protected)
  // -------------------------------------------------------------------------

  /** Deterministic full-history snapshot with sha-256 integrity digest. */
  serialize(): WorldSnapshot {
    const content = {
      schema: WORLD_MODEL_SCHEMA_NAME,
      version: WORLD_CONTRACTS_VERSION,
      sequence: this.store.sequence,
      entityTypes: this.store.registry.listEntityTypes(),
      relationTypes: this.store.registry.listRelationTypes(),
      externalMappings: [...this.store.externalMappings.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
      assertions: [...this.store.assertions.values()].sort((a, b) => a.sequence - b.sequence),
      events: [...this.store.events],
    };
    const digest = sha256Hex(canonicalJson(content));
    return deepFreeze({ ...content, digest });
  }

  /** Canonical JSON form of the snapshot content (the exact-revision identity). */
  canonicalContent(): string {
    const { digest: _digest, ...content } = this.serialize();
    void _digest;
    return canonicalJson(content);
  }

  /** sha-256 digest of the canonical snapshot content. */
  digest(): string {
    return sha256Hex(this.canonicalContent());
  }

  statistics(at?: Instant): WorldStatistics {
    const effectiveAt = this.instantOrNow(at);
    const records = [...this.store.assertions.values()];
    const stats: WorldStatistics = deepFreeze({
      sequence: this.store.sequence,
      entityCount: materializeAllEntities(this.store, effectiveAt).length,
      relationCount: materializeAllRelations(this.store, effectiveAt).length,
      assertionCount: records.length,
      liveAssertionCount: records.filter((record) => record.status === 'live').length,
      supersededAssertionCount: records.filter((record) => record.status === 'superseded').length,
      retractedAssertionCount: records.filter((record) => record.status === 'retracted').length,
      eventCount: this.store.events.length,
      entityTypeCount: this.store.registry.listEntityTypes().length,
      relationTypeCount: this.store.registry.listRelationTypes().length,
      externalMappingCount: this.store.externalMappings.size,
      contractsVersion: WORLD_CONTRACTS_VERSION,
    });
    return stats;
  }

  // -------------------------------------------------------------------------

  private instantOrNow(at?: Instant): Instant {
    return at ?? this.clock();
  }

  private validateStatement(statement: AssertionInput['statement'], at: Instant): void {
    switch (statement.kind) {
      case 'entity': {
        if (this.store.registry.getEntityType(statement.entityType) === null) {
          throw new WorldModelError('WM_NOT_FOUND', `unknown entity type '${statement.entityType}'`);
        }
        this.store.registry.validateProperties(statement.properties ?? {}, 'entity', statement.entityType);
        return;
      }
      case 'entity-property': {
        const existence = resolveKeyAt(this.store, entityKey(statement.entityId), at);
        if (existence === null || existence.statement.kind !== 'entity') {
          throw new WorldModelError(
            'WM_NOT_FOUND',
            `entity '${statement.entityId}' does not exist at the asserted instant`,
          );
        }
        this.store.registry.validateProperties(
          { [statement.property]: statement.value },
          'entity',
          existence.statement.entityType,
        );
        return;
      }
      case 'relation': {
        const relationType = this.store.registry.getRelationType(statement.relationType);
        if (relationType === null) {
          throw new WorldModelError('WM_NOT_FOUND', `unknown relation type '${statement.relationType}'`);
        }
        const source = this.resolveEndpoint(statement.source, at, 'source');
        const target = this.resolveEndpoint(statement.target, at, 'target');
        if (!this.store.registry.isEntityAssignable(source, relationType.sourceType)) {
          throw new WorldModelError(
            'WM_TYPE_MISMATCH',
            `relation '${statement.relationType}' requires source assignable to '${relationType.sourceType}'; got '${source}'`,
          );
        }
        if (!this.store.registry.isEntityAssignable(target, relationType.targetType)) {
          throw new WorldModelError(
            'WM_TYPE_MISMATCH',
            `relation '${statement.relationType}' requires target assignable to '${relationType.targetType}'; got '${target}'`,
          );
        }
        this.store.registry.validateProperties(statement.properties ?? {}, 'relation', statement.relationType);
        return;
      }
    }
  }

  private resolveEndpoint(entityId: EntityId, at: Instant, role: 'source' | 'target'): TypeKey {
    const existence = resolveKeyAt(this.store, entityKey(entityId), at);
    if (existence === null || existence.statement.kind !== 'entity') {
      throw new WorldModelError(
        'WM_NOT_FOUND',
        `relation ${role} entity '${entityId}' does not exist at the asserted instant`,
      );
    }
    return existence.statement.entityType;
  }
}

function parseActor(actor?: ActorRef): ActorRef {
  if (actor === undefined) return SYSTEM_ACTOR;
  const parsed = ActorRefSchema.safeParse(actor);
  if (!parsed.success) {
    throw new WorldModelError('WM_VALIDATION', 'invalid actor reference', issuesToDetails(parsed.error.issues));
  }
  return parsed.data;
}

function makeReadView(store: WorldStore, at: Instant): WorldReadView {
  const view: WorldReadView = {
    at,
    getEntity: (entityId) => materializeEntityAt(store, entityId, at),
    getRelation: (relation) =>
      materializeRelationAt(store, relationKey(relation.type, relation.source, relation.target), at),
    listEntities: (filter) => Object.freeze(materializeAllEntities(store, at, filter?.type)),
    listRelations: (filter) => Object.freeze(materializeAllRelations(store, at, filter)),
    resolveAssertion: (key) => resolveKeyAt(store, key, at),
    entityHistory: (entityId) => Object.freeze(entityHistoryAt(store, entityId)),
    relationHistory: (relationType, source, target) =>
      Object.freeze(relationHistoryAt(store, relationType, source, target)),
    decisionScope: (spec) => decisionScopeAt(store, spec, at),
  };
  return deepFreeze(view);
}

// ---------------------------------------------------------------------------
// Snapshot restore helpers (integrity-checked)
// ---------------------------------------------------------------------------

function restoreCoreVocabulary(
  store: WorldStore,
  entityTypes: readonly EntityTypeDefinition[],
  relationTypes: readonly RelationTypeDefinition[],
): void {
  const canonicalEntity = new Map(store.registry.listEntityTypes().map((def) => [def.key, TypeRegistry.canonicalDefinition(def)]));
  const canonicalRelation = new Map(store.registry.listRelationTypes().map((def) => [def.key, TypeRegistry.canonicalDefinition(def)]));
  for (const definition of entityTypes) {
    if (definition.key.startsWith('core:')) {
      const expected = canonicalEntity.get(definition.key);
      if (expected === undefined || TypeRegistry.canonicalDefinition(definition) !== expected) {
        throw new WorldModelError('WM_INTEGRITY', `core vocabulary entity type '${definition.key}' does not match the kernel definition`);
      }
    }
  }
  for (const definition of relationTypes) {
    if (definition.key.startsWith('core:')) {
      const expected = canonicalRelation.get(definition.key);
      if (expected === undefined || TypeRegistry.canonicalDefinition(definition) !== expected) {
        throw new WorldModelError('WM_INTEGRITY', `core vocabulary relation type '${definition.key}' does not match the kernel definition`);
      }
    }
  }
}

function restoreEntityTypes(store: WorldStore, entityTypes: readonly EntityTypeDefinition[]): void {
  const pending = entityTypes.filter((definition) => !definition.key.startsWith('core:'));
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < pending.length; ) {
      const definition = pending[i];
      const parentReady =
        definition.extends === undefined || store.registry.getEntityType(definition.extends) !== null;
      if (parentReady) {
        store.registry.registerEntityType(definition);
        pending.splice(i, 1);
        progress = true;
      } else {
        i += 1;
      }
    }
  }
  if (pending.length > 0) {
    throw new WorldModelError(
      'WM_INTEGRITY',
      `snapshot entity types have unresolvable inheritance: ${pending.map((definition) => definition.key).join(', ')}`,
    );
  }
}

function restoreRelationTypes(store: WorldStore, relationTypes: readonly RelationTypeDefinition[]): void {
  for (const definition of relationTypes) {
    if (definition.key.startsWith('core:')) continue;
    store.registry.registerRelationType(definition);
  }
}

function restoreExternalMappings(store: WorldStore, mappings: readonly ExternalMapping[]): void {
  for (const mapping of mappings) {
    store.externalMappings.set(mapping.id, mapping);
  }
}

function restoreHistory(store: WorldStore, assertions: readonly Assertion[], events: readonly WorldEvent[]): void {
  if (events.length === 0 || events[0].type !== 'world-created' || events[0].sequence !== 1) {
    throw new WorldModelError('WM_INTEGRITY', 'snapshot event log must start with world-created (sequence 1)');
  }
  const eventIds = new Set(events.map((event) => event.id));
  if (eventIds.size !== events.length) {
    throw new WorldModelError('WM_INTEGRITY', 'snapshot contains duplicate event ids');
  }
  const ids = new Set(assertions.map((record) => record.id));
  if (ids.size !== assertions.length) {
    throw new WorldModelError('WM_INTEGRITY', 'snapshot contains duplicate assertion ids');
  }
  for (const record of assertions) {
    if (statementKey(record.statement) !== record.key) {
      throw new WorldModelError('WM_INTEGRITY', `assertion '${record.id}' carries a reconciliation key that does not match its statement`);
    }
    if (record.supersedes !== undefined && !ids.has(record.supersedes)) {
      throw new WorldModelError('WM_INTEGRITY', `assertion '${record.id}' supersedes unknown assertion '${record.supersedes}'`);
    }
    if (record.supersededBy !== undefined && !ids.has(record.supersededBy)) {
      throw new WorldModelError('WM_INTEGRITY', `assertion '${record.id}' is superseded by unknown assertion '${record.supersededBy}'`);
    }
    if (record.supersededBy !== undefined) {
      const superseder = assertions.find((candidate) => candidate.id === record.supersededBy);
      if (superseder?.supersedes !== record.id) {
        throw new WorldModelError('WM_INTEGRITY', `supersession link between '${record.id}' and '${record.supersededBy}' is not bidirectional`);
      }
    }
    for (const derivedId of record.provenance.derivedFrom ?? []) {
      if (!ids.has(derivedId)) {
        throw new WorldModelError('WM_INTEGRITY', `assertion '${record.id}' derives from unknown assertion '${derivedId}'`);
      }
    }
  }
  for (const record of assertions) {
    store.indexAssertion(record);
  }
  for (const event of events) {
    store.events.push(event);
  }
}
