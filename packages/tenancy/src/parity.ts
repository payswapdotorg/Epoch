/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009 tenancy
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  TenancyIssue,
  TenancyNode,
  TenancyNodeKind,
  TenancyNodeId,
  TenancyNodeRecord,
  TenancySnapshot,
} from './types';
import type {
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
import type { Sha256Hex } from '@epoch/agent-protocol';

export type TenancySchemaSync = [
  Expect<Equals<z.infer<typeof TenancyRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof TenancyNodeKindSchema>, TenancyNodeKind>>,
  Expect<Equals<z.infer<typeof TenancyNodeIdSchema>, TenancyNodeId>>,
  Expect<Equals<z.infer<typeof TenantIdSchema>, string>>,
  Expect<Equals<z.infer<typeof WorkspaceIdSchema>, string>>,
  Expect<Equals<z.infer<typeof ProjectIdSchema>, string>>,
  Expect<Equals<z.infer<typeof TenancyNodeSchema>, TenancyNode>>,
  Expect<Equals<z.infer<typeof TenancyNodeRecordSchema>, TenancyNodeRecord>>,
  Expect<Equals<z.infer<typeof TenancySnapshotSchema>, TenancySnapshot>>,
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, Sha256Hex>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type TenancyLiteralSync = [
  Expect<
    Equals<
      TenancyNodeKind,
      'platform' | 'tenant' | 'workspace' | 'project' | 'world' | 'scenario' | 'evidence'
    >
  >,
];

/** Result/error surface shape sanity. */
export type TenancyResultSync = [
  Expect<Equals<TenancyIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<TenancyNodeRecord['nodeDigest'], Sha256Hex>>,
  Expect<Equals<TenancySnapshot['records'], readonly TenancyNodeRecord[]>>,
];
