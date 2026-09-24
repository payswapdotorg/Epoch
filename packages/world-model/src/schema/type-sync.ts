import type {
  ActorRef,
  Assertion,
  AssertionInput,
  AssertionStatement,
  AssertionStatus,
  Cardinality,
  Confidence,
  ConfidenceDistribution,
  ConfidenceMethod,
  DecisionScopeSpec,
  Entity,
  EntityTypeDefinition,
  EvidenceRef,
  ExternalEntityTypeMapping,
  ExternalMapping,
  ExternalRelationTypeMapping,
  InformationGap,
  IntervalBias,
  JsonObject,
  JsonValue,
  PropertyBag,
  PropertyName,
  PropertySpec,
  PropertyType,
  Provenance,
  Relation,
  RelationTypeDefinition,
  ResolvedAssertion,
  RetractionInput,
  TaskSufficientWorld,
  TypeKey,
  TypeOrigin,
  Validity,
  WorldEvent,
  WorldEventType,
  WorldSnapshot,
  WorldSnapshotContent,
  WorldStatistics,
  ActorRole,
  EvidenceKind,
  InformationGapKind,
} from '@epoch/world-contracts';
import type { z } from 'zod';
import type { Equal, Expect } from '../type-utils';
import type {
  ActorRefSchema,
  AssertionInputSchema,
  AssertionSchema,
  AssertionStatementSchema,
  AssertionStatusSchema,
  ConfidenceDistributionSchema,
  ConfidenceSchema,
  DecisionScopeSpecSchema,
  EntitySchema,
  EntityTypeDefinitionSchema,
  EvidenceRefSchema,
  ExternalEntityTypeMappingSchema,
  ExternalMappingSchema,
  ExternalRelationTypeMappingSchema,
  InformationGapSchema,
  JsonObjectSchema,
  JsonValueSchema,
  PropertyBagSchema,
  PropertyNameSchema,
  PropertySpecSchema,
  ProvenanceSchema,
  RelationSchema,
  RelationTypeDefinitionSchema,
  ResolvedAssertionSchema,
  RetractionInputSchema,
  TaskSufficientWorldSchema,
  TypeKeySchema,
  ValiditySchema,
  WorldEventSchema,
  WorldEventTypeSchema,
  WorldSnapshotContentSchema,
  WorldSnapshotSchema,
  WorldStatisticsSchema,
  EntityIdSchema,
  InstantSchema,
} from './index';

/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W002
 * contract-sync guarantee).
 *
 * Every exported alias below compiles ONLY while the zod validators in this
 * package infer exactly the published contract types from
 * `@epoch/world-contracts`. If either side drifts, `tsc --noEmit` fails
 * with "Type 'false' does not satisfy the constraint 'true'" pointing at
 * the drifted pair. The JSON-Schema half of the guarantee is enforced at
 * test time (test/contracts-sync.test.ts).
 */

export type PrimitivesSync = [
  Expect<Equal<z.infer<typeof InstantSchema>, string>>,
  Expect<Equal<z.infer<typeof EntityIdSchema>, string>>,
  Expect<Equal<z.infer<typeof TypeKeySchema>, TypeKey>>,
  Expect<Equal<z.infer<typeof PropertyNameSchema>, PropertyName>>,
  Expect<Equal<z.infer<typeof JsonValueSchema>, JsonValue>>,
  Expect<Equal<z.infer<typeof JsonObjectSchema>, JsonObject>>,
  Expect<Equal<z.infer<typeof PropertyBagSchema>, PropertyBag>>,
];

export type ConfidenceSync = [
  Expect<Equal<z.infer<typeof ConfidenceDistributionSchema>, ConfidenceDistribution>>,
  Expect<Equal<z.infer<typeof ConfidenceSchema>, Confidence>>,
];

export type ProvenanceSync = [
  Expect<Equal<z.infer<typeof ActorRefSchema>, ActorRef>>,
  Expect<Equal<z.infer<typeof EvidenceRefSchema>, EvidenceRef>>,
  Expect<Equal<z.infer<typeof ProvenanceSchema>, Provenance>>,
];

export type ValiditySync = Expect<Equal<z.infer<typeof ValiditySchema>, Validity>>;

export type EntitySync = [
  Expect<Equal<z.infer<typeof PropertySpecSchema>, PropertySpec>>,
  Expect<Equal<z.infer<typeof EntityTypeDefinitionSchema>, EntityTypeDefinition>>,
  Expect<Equal<z.infer<typeof EntitySchema>, Entity>>,
];

export type RelationSync = [
  Expect<Equal<z.infer<typeof RelationTypeDefinitionSchema>, RelationTypeDefinition>>,
  Expect<Equal<z.infer<typeof RelationSchema>, Relation>>,
];

export type AssertionSync = [
  Expect<Equal<z.infer<typeof AssertionStatementSchema>, AssertionStatement>>,
  Expect<Equal<z.infer<typeof AssertionStatusSchema>, AssertionStatus>>,
  Expect<Equal<z.infer<typeof AssertionSchema>, Assertion>>,
  Expect<Equal<z.infer<typeof AssertionInputSchema>, AssertionInput>>,
  Expect<Equal<z.infer<typeof RetractionInputSchema>, RetractionInput>>,
];

export type EventSync = [
  Expect<Equal<z.infer<typeof WorldEventTypeSchema>, WorldEventType>>,
  Expect<Equal<z.infer<typeof WorldEventSchema>, WorldEvent>>,
];

export type IngestionSync = [
  Expect<Equal<z.infer<typeof ExternalEntityTypeMappingSchema>, ExternalEntityTypeMapping>>,
  Expect<Equal<z.infer<typeof ExternalRelationTypeMappingSchema>, ExternalRelationTypeMapping>>,
  Expect<Equal<z.infer<typeof ExternalMappingSchema>, ExternalMapping>>,
];

export type QuerySync = [
  Expect<Equal<z.infer<typeof DecisionScopeSpecSchema>, DecisionScopeSpec>>,
  Expect<Equal<z.infer<typeof InformationGapSchema>, InformationGap>>,
  Expect<Equal<z.infer<typeof ResolvedAssertionSchema>, ResolvedAssertion>>,
  Expect<Equal<z.infer<typeof TaskSufficientWorldSchema>, TaskSufficientWorld>>,
];

export type SnapshotSync = [
  Expect<Equal<z.infer<typeof WorldSnapshotContentSchema>, WorldSnapshotContent>>,
  Expect<Equal<z.infer<typeof WorldSnapshotSchema>, WorldSnapshot>>,
];

export type StatisticsSync = Expect<Equal<z.infer<typeof WorldStatisticsSchema>, WorldStatistics>>;

/** String-literal unions are additionally pinned member-for-member. */
export type LiteralSync = [
  Expect<Equal<ActorRole, 'human' | 'agent' | 'system' | 'external-provider' | 'sensor' | 'importer'>>,
  Expect<Equal<EvidenceKind, 'document' | 'measurement' | 'observation' | 'computation' | 'assertion' | 'external' | 'other'>>,
  Expect<Equal<ConfidenceMethod, 'stated' | 'measured' | 'estimated' | 'derived' | 'imported'>>,
  Expect<Equal<IntervalBias, 'none' | 'low' | 'high'>>,
  Expect<Equal<PropertyType, 'string' | 'number' | 'integer' | 'boolean' | 'json'>>,
  Expect<Equal<TypeOrigin, 'core' | 'extension'>>,
  Expect<Equal<Cardinality, 'one-one' | 'one-many' | 'many-one' | 'many-many'>>,
  Expect<Equal<InformationGapKind, 'absent-entity' | 'low-confidence' | 'missing-property' | 'unsupported-claim'>>,
];
