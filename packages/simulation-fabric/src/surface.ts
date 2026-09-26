/**
 * The simulation-fabric schema surface registry: every data type
 * published at the `@epoch/simulation-fabric` ownership boundary, paired
 * with its zod schema (W021 publishes its versioned contract surface
 * inside the package, the W007/W009/W010/W020 convention; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  CapabilityBindingRefSchema,
  FabricIdempotencyKeySchema,
  FabricPrincipalIdSchema,
  FabricRunEntrySchema,
  IdempotencyRecordSchema,
  RunTransitionCauseSchema,
  RunTransitionSchema,
  SealedSimulationResultSchema,
  SimulationEventDiscriminatorSchema,
  SimulationFabricRecordVersionSchema,
  SimulationFabricSnapshotSchema,
  SimulationJobIdSchema,
  SimulationRunIdSchema,
  SimulationRunSchema,
  SimulationRunStateSchema,
  SimulationRunStatusSchema,
} from './schema';
import {
  SimulationCausalParentSchema,
  SimulationEventContentSchema,
  SimulationEventPayloadSchema,
  SimulationEventSequenceSchema,
  SealedSimulationEventSchema,
} from './events';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the simulation fabric contract v1. */
export const SIMULATION_FABRIC_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'CapabilityBindingRef', schema: CapabilityBindingRefSchema },
  { type: 'FabricIdempotencyKey', schema: FabricIdempotencyKeySchema },
  { type: 'FabricPrincipalId', schema: FabricPrincipalIdSchema },
  { type: 'FabricRunEntry', schema: FabricRunEntrySchema },
  { type: 'IdempotencyRecord', schema: IdempotencyRecordSchema },
  { type: 'RunTransition', schema: RunTransitionSchema },
  { type: 'RunTransitionCause', schema: RunTransitionCauseSchema },
  { type: 'SealedSimulationEvent', schema: SealedSimulationEventSchema },
  { type: 'SealedSimulationResult', schema: SealedSimulationResultSchema },
  { type: 'SimulationCausalParent', schema: SimulationCausalParentSchema },
  { type: 'SimulationEventContent', schema: SimulationEventContentSchema },
  { type: 'SimulationEventDiscriminator', schema: SimulationEventDiscriminatorSchema },
  { type: 'SimulationEventPayload', schema: SimulationEventPayloadSchema },
  { type: 'SimulationEventSequence', schema: SimulationEventSequenceSchema },
  { type: 'SimulationFabricRecordVersion', schema: SimulationFabricRecordVersionSchema },
  { type: 'SimulationFabricSnapshot', schema: SimulationFabricSnapshotSchema },
  { type: 'SimulationJobId', schema: SimulationJobIdSchema },
  { type: 'SimulationRun', schema: SimulationRunSchema },
  { type: 'SimulationRunId', schema: SimulationRunIdSchema },
  { type: 'SimulationRunState', schema: SimulationRunStateSchema },
  { type: 'SimulationRunStatus', schema: SimulationRunStatusSchema },
];
