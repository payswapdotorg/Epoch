/**
 * The renderer-adapters schema surface registry: every data type
 * published at the `packages/renderer-adapters/schemas` boundary,
 * paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`): every entry is exported from the
 * package index, and every entry has an emitted JSON Schema file listed
 * in `schemas/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { Sha256HexSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import {
  AdapterIdSchema,
  SelectionIdSchema,
  MountPlanIdSchema,
  AdapterStreamIdSchema,
  AdapterActorSchema,
  AdapterTenantIdSchema,
  AdapterTimestampSchema,
} from './primitives';
import {
  RendererAdaptersErrorCodeSchema,
  RendererAdaptersProtocolVersionSchema,
  RendererTechniqueSchema,
  TechniqueExecutionClassSchema,
  SelectionReasonSchema,
  EligibilityReasonSchema,
  AdapterEventDiscriminatorSchema,
} from './version';
import { RendererTechniqueRecordSchema } from './technique';
import {
  SelectionTraceEntrySchema,
  RendererAdapterSelectionContentSchema,
  RendererAdapterSelectionSchema,
} from './selection';
import {
  MountPlanStepSchema,
  RendererMountPlanContentSchema,
  RendererMountPlanSchema,
} from './plan';
import {
  AdapterEventSequenceSchema,
  AdapterCausalParentSchema,
  AdapterEventPayloadSchema,
  AdapterEventContentSchema,
  AdapterEventSchema,
  TechniqueSelectedDataSchema,
  MountPlannedDataSchema,
} from './events';
import { RendererAdaptersIssueSchema, RendererAdaptersErrorSchema } from './errors';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  /** The published type name (kebab-cased into its schema file). */
  readonly type: string;
  /** The zod schema of the type. */
  readonly schema: ZodType;
}

/** The complete published data-type surface of @epoch/renderer-adapters. */
export const RENDERER_ADAPTERS_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AdapterActor', schema: AdapterActorSchema },
  { type: 'AdapterCausalParent', schema: AdapterCausalParentSchema },
  { type: 'AdapterEvent', schema: AdapterEventSchema },
  { type: 'AdapterEventContent', schema: AdapterEventContentSchema },
  { type: 'AdapterEventDiscriminator', schema: AdapterEventDiscriminatorSchema },
  { type: 'AdapterEventPayload', schema: AdapterEventPayloadSchema },
  { type: 'AdapterEventSequence', schema: AdapterEventSequenceSchema },
  { type: 'AdapterId', schema: AdapterIdSchema },
  { type: 'AdapterStreamId', schema: AdapterStreamIdSchema },
  { type: 'AdapterTenantId', schema: AdapterTenantIdSchema },
  { type: 'AdapterTimestamp', schema: AdapterTimestampSchema },
  { type: 'EligibilityReason', schema: EligibilityReasonSchema },
  { type: 'MountPlanId', schema: MountPlanIdSchema },
  { type: 'MountPlanStep', schema: MountPlanStepSchema },
  { type: 'MountPlannedData', schema: MountPlannedDataSchema },
  { type: 'RendererAdapterSelection', schema: RendererAdapterSelectionSchema },
  { type: 'RendererAdapterSelectionContent', schema: RendererAdapterSelectionContentSchema },
  { type: 'RendererAdaptersError', schema: RendererAdaptersErrorSchema },
  { type: 'RendererAdaptersErrorCode', schema: RendererAdaptersErrorCodeSchema },
  { type: 'RendererAdaptersIssue', schema: RendererAdaptersIssueSchema },
  { type: 'RendererAdaptersProtocolVersion', schema: RendererAdaptersProtocolVersionSchema },
  { type: 'RendererMountPlan', schema: RendererMountPlanSchema },
  { type: 'RendererMountPlanContent', schema: RendererMountPlanContentSchema },
  { type: 'RendererTechnique', schema: RendererTechniqueSchema },
  { type: 'RendererTechniqueRecord', schema: RendererTechniqueRecordSchema },
  { type: 'SelectionId', schema: SelectionIdSchema },
  { type: 'SelectionReason', schema: SelectionReasonSchema },
  { type: 'SelectionTraceEntry', schema: SelectionTraceEntrySchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'TechniqueExecutionClass', schema: TechniqueExecutionClassSchema },
  { type: 'TechniqueSelectedData', schema: TechniqueSelectedDataSchema },
  { type: 'TenantScope', schema: TenantScopeSchema },
];
