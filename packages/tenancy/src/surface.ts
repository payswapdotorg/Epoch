/**
 * The tenancy schema surface registry: every data type published at the
 * `@epoch/tenancy` ownership boundary, paired with its zod schema (W009
 * publishes its versioned contract surface inside the package; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ProjectIdSchema,
  Sha256DigestSchema,
  TenancyNodeKindSchema,
  TenancyNodeIdSchema,
  TenancyNodeRecordSchema,
  TenancyNodeSchema,
  TenancyRecordVersionSchema,
  TenancySnapshotSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the tenancy contract v1. */
export const TENANCY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ProjectId', schema: ProjectIdSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'TenancyNode', schema: TenancyNodeSchema },
  { type: 'TenancyNodeId', schema: TenancyNodeIdSchema },
  { type: 'TenancyNodeKind', schema: TenancyNodeKindSchema },
  { type: 'TenancyNodeRecord', schema: TenancyNodeRecordSchema },
  { type: 'TenancyRecordVersion', schema: TenancyRecordVersionSchema },
  { type: 'TenancySnapshot', schema: TenancySnapshotSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'WorkspaceId', schema: WorkspaceIdSchema },
];
