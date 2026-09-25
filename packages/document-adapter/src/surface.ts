/**
 * The document-adapter schema surface registry: every data type
 * published at the `@epoch/document-adapter` ownership boundary, paired
 * with its zod schema (W028 publishes its versioned contract surface
 * inside the package; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  DocumentAdapterIssueSchema,
  DocumentContentSchema,
  DocumentDescriptorSchema,
  DocumentFieldLocatorSchema,
  ExtractionCandidateSchema,
  ExtractionStageKindSchema,
  ParsedDocumentSchema,
  ParsedMappingRowSchema,
  PropertyMappingSchema,
  ProvisionalAdapterDefinitionSchema,
  ProvisionalRegistrationPlanSchema,
  SemanticTypeKeySchema,
  StageEvidenceChainSchema,
  StageEvidenceLinkSchema,
  StageRunContextSchema,
  TenantScopeSchema,
  TrustEscalationOpSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the document-adapter contract v1. */
export const DOCUMENT_ADAPTER_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'DocumentAdapterIssue', schema: DocumentAdapterIssueSchema },
  { type: 'DocumentContent', schema: DocumentContentSchema },
  { type: 'DocumentDescriptor', schema: DocumentDescriptorSchema },
  { type: 'DocumentFieldLocator', schema: DocumentFieldLocatorSchema },
  { type: 'ExtractionCandidate', schema: ExtractionCandidateSchema },
  { type: 'ExtractionStageKind', schema: ExtractionStageKindSchema },
  { type: 'ParsedDocument', schema: ParsedDocumentSchema },
  { type: 'ParsedMappingRow', schema: ParsedMappingRowSchema },
  { type: 'PropertyMapping', schema: PropertyMappingSchema },
  { type: 'ProvisionalAdapterDefinition', schema: ProvisionalAdapterDefinitionSchema },
  { type: 'ProvisionalRegistrationPlan', schema: ProvisionalRegistrationPlanSchema },
  { type: 'SemanticTypeKey', schema: SemanticTypeKeySchema },
  { type: 'StageEvidenceChain', schema: StageEvidenceChainSchema },
  { type: 'StageEvidenceLink', schema: StageEvidenceLinkSchema },
  { type: 'StageRunContext', schema: StageRunContextSchema },
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'TrustEscalationOp', schema: TrustEscalationOpSchema },
];
