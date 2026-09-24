/**
 * The simulation-protocol schema surface registry: every data type
 * published at the in-package `contracts/` boundary, paired with its zod
 * schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import {
  SimulationMessageKindSchema,
  SimulationProtocolVersionSchema,
} from './version';
import {
  FidelityProfileSchema,
  ReproducibilityProfileSchema,
  SeedPolicySchema,
  SimulatorIdSchema,
  ValidityDomainSchema,
} from './contract';
import { SimulatorRegistrationSchema } from './registration';
import {
  SimulatorReferenceSchema,
  SimulationInvocationRequestSchema,
} from './invocation';
import {
  CompletedSimulationResultSchema,
  FailedSimulationResultSchema,
  InvocationReferenceSchema,
  SimulationFailureCodeSchema,
  SimulationFailureSchema,
  SimulationOutcomeSchema,
  SimulationResultSchema,
  SimulationResultStatusSchema,
} from './result';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of simulation protocol v1. */
export const SIMULATION_PROTOCOL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'CompletedSimulationResult', schema: CompletedSimulationResultSchema },
  { type: 'FailedSimulationResult', schema: FailedSimulationResultSchema },
  { type: 'FidelityProfile', schema: FidelityProfileSchema },
  { type: 'InvocationReference', schema: InvocationReferenceSchema },
  { type: 'ReproducibilityProfile', schema: ReproducibilityProfileSchema },
  { type: 'SeedPolicy', schema: SeedPolicySchema },
  { type: 'SimulationFailure', schema: SimulationFailureSchema },
  { type: 'SimulationFailureCode', schema: SimulationFailureCodeSchema },
  { type: 'SimulationInvocationRequest', schema: SimulationInvocationRequestSchema },
  { type: 'SimulationMessageKind', schema: SimulationMessageKindSchema },
  { type: 'SimulationOutcome', schema: SimulationOutcomeSchema },
  { type: 'SimulationProtocolVersion', schema: SimulationProtocolVersionSchema },
  { type: 'SimulationResult', schema: SimulationResultSchema },
  { type: 'SimulationResultStatus', schema: SimulationResultStatusSchema },
  { type: 'SimulatorId', schema: SimulatorIdSchema },
  { type: 'SimulatorReference', schema: SimulatorReferenceSchema },
  { type: 'SimulatorRegistration', schema: SimulatorRegistrationSchema },
  { type: 'ValidityDomain', schema: ValidityDomainSchema },
];
