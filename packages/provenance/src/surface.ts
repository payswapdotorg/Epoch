/**
 * The provenance schema surface registry: every data type published at the
 * `@epoch/provenance` ownership boundary, paired with its zod schema
 * (W006 publishes its versioned contract surface inside the package; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ProvenanceActivitySchema,
  ProvenanceAgentKindSchema,
  ProvenanceAgentSchema,
  ProvenanceEntitySchema,
  ProvenanceGraphSchema,
  ProvenanceRelationSchema,
  ProvenanceStatementSchema,
  ProvenanceVersionSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the provenance contract v1. */
export const PROVENANCE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ProvenanceActivity', schema: ProvenanceActivitySchema },
  { type: 'ProvenanceAgent', schema: ProvenanceAgentSchema },
  { type: 'ProvenanceAgentKind', schema: ProvenanceAgentKindSchema },
  { type: 'ProvenanceEntity', schema: ProvenanceEntitySchema },
  { type: 'ProvenanceGraph', schema: ProvenanceGraphSchema },
  { type: 'ProvenanceGraphVersion', schema: ProvenanceVersionSchema },
  { type: 'ProvenanceRelation', schema: ProvenanceRelationSchema },
  { type: 'ProvenanceStatement', schema: ProvenanceStatementSchema },
];
