/**
 * The tenancy schema surface registry: every data type published at the
 * `@epoch/tenancy` ownership boundary, paired with its zod schema (W009
 * publishes its versioned contract surface inside the package, following
 * the W007 `@epoch/capability-registry` / W008 `@epoch/extension-sdk`
 * conventions; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  PlatformIdSchema,
  ProjectIdSchema,
  ScenarioIdSchema,
  SealedTenancyNodeSchema,
  Sha256DigestSchema,
  TenancyNodeIdSchema,
  TenancyNodeKindSchema,
  TenancyNodeSchema,
  TenancyRecordVersionSchema,
  TenancySnapshotSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
  WorldIdSchema,
  EvidenceIdSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the tenancy contract v1. */
export const TENANCY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'EvidenceId', schema: EvidenceIdSchema },
  { type: 'PlatformId', schema: PlatformIdSchema },
  { type: 'ProjectId', schema: ProjectIdSchema },
  { type: 'ScenarioId', schema: ScenarioIdSchema },
  { type: 'SealedTenancyNode', schema: SealedTenancyNodeSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'TenancyNode', schema: TenancyNodeSchema },
  { type: 'TenancyNodeId', schema: TenancyNodeIdSchema },
  { type: 'TenancyNodeKind', schema: TenancyNodeKindSchema },
  { type: 'TenancyRecordVersion', schema: TenancyRecordVersionSchema },
  { type: 'TenancySnapshot', schema: TenancySnapshotSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'WorkspaceId', schema: WorkspaceIdSchema },
  { type: 'WorldId', schema: WorldIdSchema },
];
