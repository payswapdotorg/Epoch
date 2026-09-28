/**
 * The progressive-scene schema surface registry: every data type
 * published at the `packages/progressive-scene/schemas` boundary,
 * paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`): every entry is exported from the
 * package index, and every entry has an emitted JSON Schema file listed
 * in `schemas/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { Sha256HexSchema, LadderIdSchema, RungIndexSchema } from './primitives';
import {
  ProgressiveSceneErrorCodeSchema,
  ProgressiveSceneProtocolVersionSchema,
  ReductionStageKindSchema,
} from './version';
import { SceneUsageSchema } from './estimates';
import {
  PrimitiveSubstitutionSchema,
  RungReductionSchema,
} from './reduce';
import {
  LadderRungSchema,
  ProgressiveSceneLadderContentSchema,
  ProgressiveSceneLadderSchema,
  SceneFitSchema,
} from './ladder';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  /** The published type name (kebab-cased into its schema file). */
  readonly type: string;
  /** The zod schema of the type. */
  readonly schema: ZodType;
}

/** The complete published data-type surface of @epoch/progressive-scene. */
export const PROGRESSIVE_SCENE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'LadderId', schema: LadderIdSchema },
  { type: 'LadderRung', schema: LadderRungSchema },
  { type: 'PrimitiveSubstitution', schema: PrimitiveSubstitutionSchema },
  { type: 'ProgressiveSceneErrorCode', schema: ProgressiveSceneErrorCodeSchema },
  { type: 'ProgressiveSceneLadder', schema: ProgressiveSceneLadderSchema },
  { type: 'ProgressiveSceneLadderContent', schema: ProgressiveSceneLadderContentSchema },
  { type: 'ProgressiveSceneProtocolVersion', schema: ProgressiveSceneProtocolVersionSchema },
  { type: 'ReductionStageKind', schema: ReductionStageKindSchema },
  { type: 'RungIndex', schema: RungIndexSchema },
  { type: 'RungReduction', schema: RungReductionSchema },
  { type: 'SceneFit', schema: SceneFitSchema },
  { type: 'SceneUsage', schema: SceneUsageSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
];
