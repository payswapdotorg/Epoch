/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W006 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  ProvenanceActivity,
  ProvenanceAgent,
  ProvenanceAgentKind,
  ProvenanceEntity,
  ProvenanceGraph,
  ProvenanceRelation,
  ProvenanceStatement,
} from './types';
import type {
  ProvenanceActivitySchema,
  ProvenanceAgentKindSchema,
  ProvenanceAgentSchema,
  ProvenanceEntitySchema,
  ProvenanceGraphSchema,
  ProvenanceRelationSchema,
  ProvenanceStatementSchema,
  ProvenanceVersionSchema,
} from './schema';

export type ProvenanceSchemaSync = [
  Expect<Equals<z.infer<typeof ProvenanceVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof ProvenanceAgentKindSchema>, ProvenanceAgentKind>>,
  Expect<Equals<z.infer<typeof ProvenanceRelationSchema>, ProvenanceRelation>>,
  Expect<Equals<z.infer<typeof ProvenanceAgentSchema>, ProvenanceAgent>>,
  Expect<Equals<z.infer<typeof ProvenanceActivitySchema>, ProvenanceActivity>>,
  Expect<Equals<z.infer<typeof ProvenanceEntitySchema>, ProvenanceEntity>>,
  Expect<Equals<z.infer<typeof ProvenanceStatementSchema>, ProvenanceStatement>>,
  Expect<Equals<z.infer<typeof ProvenanceGraphSchema>, ProvenanceGraph>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type ProvenanceLiteralSync = [
  Expect<
    Equals<ProvenanceAgentKind, 'person' | 'organization' | 'software' | 'hardware' | 'system'>
  >,
  Expect<
    Equals<
      ProvenanceRelation,
      | 'was-generated-by'
      | 'used'
      | 'was-associated-with'
      | 'was-attributed-to'
      | 'was-derived-from'
      | 'acted-on-behalf-of'
    >
  >,
];
