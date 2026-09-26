/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the simulation-fabric
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricIdempotencyKey,
  FabricPrincipalId,
  FabricRunEntry,
  IdempotencyRecord,
  RunTransition,
  SealedSimulationResult,
  SealedSimulationEvent,
  SimulationEventContent,
  SimulationEventPayload,
  SimulationEventSequence,
  SimulationCausalParent,
  SimulationFabricSnapshot,
  SimulationRun,
  SimulationRunId,
  SimulationRunState,
} from './types';
import type {
  CapabilityBindingRefSchema,
  FabricIdempotencyKeySchema,
  FabricPrincipalIdSchema,
  FabricRunEntrySchema,
  IdempotencyRecordSchema,
  RunTransitionSchema,
  SealedSimulationResultSchema,
  SimulationFabricSnapshotSchema,
  SimulationRunIdSchema,
  SimulationRunSchema,
  SimulationRunStateSchema,
} from './schema';
import type {
  SealedSimulationEventSchema,
  SimulationCausalParentSchema,
  SimulationEventContentSchema,
  SimulationEventPayloadSchema,
  SimulationEventSequenceSchema,
} from './events';

export type SimulationFabricSchemaSync = [
  Expect<Equals<z.infer<typeof SimulationRunIdSchema>, SimulationRunId>>,
  Expect<Equals<z.infer<typeof FabricPrincipalIdSchema>, FabricPrincipalId>>,
  Expect<Equals<z.infer<typeof FabricIdempotencyKeySchema>, FabricIdempotencyKey>>,
  Expect<Equals<z.infer<typeof CapabilityBindingRefSchema>, CapabilityBindingRef>>,
  Expect<Equals<z.infer<typeof RunTransitionSchema>, RunTransition>>,
  Expect<Equals<z.infer<typeof SimulationRunStateSchema>, SimulationRunState>>,
  Expect<Equals<z.infer<typeof SealedSimulationResultSchema>, SealedSimulationResult>>,
  Expect<Equals<z.infer<typeof SimulationRunSchema>, SimulationRun>>,
  Expect<Equals<z.infer<typeof IdempotencyRecordSchema>, IdempotencyRecord>>,
  Expect<Equals<z.infer<typeof FabricRunEntrySchema>, FabricRunEntry>>,
  Expect<Equals<z.infer<typeof SimulationFabricSnapshotSchema>, SimulationFabricSnapshot>>,
];

/** The mirrored W010 event shapes are type-identical to the mirror types. */
export type SimulationEventSchemaSync = [
  Expect<Equals<z.infer<typeof SimulationEventSequenceSchema>, SimulationEventSequence>>,
  Expect<Equals<z.infer<typeof SimulationCausalParentSchema>, SimulationCausalParent>>,
  Expect<Equals<z.infer<typeof SimulationEventPayloadSchema>, SimulationEventPayload>>,
  Expect<Equals<z.infer<typeof SimulationEventContentSchema>, SimulationEventContent>>,
  Expect<Equals<z.infer<typeof SealedSimulationEventSchema>, SealedSimulationEvent>>,
];

/** Result/error surface shape sanity. */
export type SimulationFabricResultSync = [
  Expect<
    Equals<
      ExecutionOutcome['disposition'],
      'executed' | 'replayed-result'
    >
  >,
  Expect<Equals<SimulationRun['states'][number], SimulationRunState>>,
];
