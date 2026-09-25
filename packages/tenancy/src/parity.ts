/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009 tenancy
 * contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { Equals, Expect } from './type-utils';
import type { TenancyNodeKind } from './version';
import type {
  PlatformId,
  ProjectId,
  ScenarioId,
  SealedTenancyNode,
  TenancyError,
  TenancyIssue,
  TenancyMembership,
  TenancyNode,
  TenancyNodeId,
  TenancyResult,
  TenancySnapshot,
  TenantId,
  WorkspaceId,
  WorldId,
  EvidenceId,
} from './types';
import type {
  PlatformIdSchema,
  ProjectIdSchema,
  ScenarioIdSchema,
  SealedTenancyNodeSchema,
  TenancyNodeKindSchema,
  TenancyNodeIdSchema,
  TenancyNodeSchema,
  TenancyRecordVersionSchema,
  TenancySnapshotSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
  WorldIdSchema,
  EvidenceIdSchema,
} from './schema';
import type { TENANCY_RECORD_VERSION } from './version';

export type TenancySchemaSync = [
  Expect<Equals<z.infer<typeof TenancyRecordVersionSchema>, typeof TENANCY_RECORD_VERSION>>,
  Expect<Equals<z.infer<typeof TenancyNodeKindSchema>, TenancyNodeKind>>,
  Expect<Equals<z.infer<typeof TenancyNodeIdSchema>, TenancyNodeId>>,
  Expect<Equals<z.infer<typeof TenancyNodeSchema>, TenancyNode>>,
  Expect<Equals<z.infer<typeof SealedTenancyNodeSchema>, SealedTenancyNode>>,
  Expect<Equals<z.infer<typeof TenancySnapshotSchema>, TenancySnapshot>>,
  Expect<Equals<z.infer<typeof PlatformIdSchema>, PlatformId>>,
  Expect<Equals<z.infer<typeof TenantIdSchema>, TenantId>>,
  Expect<Equals<z.infer<typeof WorkspaceIdSchema>, WorkspaceId>>,
  Expect<Equals<z.infer<typeof ProjectIdSchema>, ProjectId>>,
  Expect<Equals<z.infer<typeof WorldIdSchema>, WorldId>>,
  Expect<Equals<z.infer<typeof ScenarioIdSchema>, ScenarioId>>,
  Expect<Equals<z.infer<typeof EvidenceIdSchema>, EvidenceId>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type TenancyLiteralSync = [
  Expect<
    Equals<
      z.infer<typeof TenancyNodeKindSchema>,
      'platform' | 'tenant' | 'workspace' | 'project' | 'world' | 'scenario' | 'evidence'
    >
  >,
  Expect<
    Equals<
      TenancyError['code'],
      | 'validation'
      | 'unknown-node'
      | 'unknown-parent'
      | 'duplicate-node'
      | 'hierarchy-escape'
      | 'cycle'
      | 'cross-tenant-reference'
      | 'digest-mismatch'
    >
  >,
];

/** Result/error surface shape sanity. */
export type TenancyResultSync = [
  Expect<Equals<TenancyIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<SealedTenancyNode['digest'], Sha256Hex>>,
  Expect<
    Equals<
      TenancyResult<string>,
      | { readonly ok: true; readonly value: string }
      | { readonly ok: false; readonly error: TenancyError }
    >
  >,
  Expect<Equals<TenancyMembership['nodeId'], TenancyNodeId>>,
  Expect<Equals<TenancyMembership['platformId'], PlatformId>>,
];
