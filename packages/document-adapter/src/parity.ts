/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W028 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in
 * src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  DocumentAdapterError,
  DocumentAdapterIssue,
  DocumentContent,
  DocumentDescriptor,
  DocumentFieldLocator,
  ExtractionCandidate,
  ExtractionStageKind,
  ParsedDocument,
  ParsedMappingRow,
  PropertyMapping,
  ProvisionalAdapterDefinition,
  ProvisionalRegistrationPlan,
  StageEvidenceChain,
  StageEvidenceLink,
  StageRunContext,
  TenantScope,
  TrustEscalationOp,
} from './types';
import type {
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
  StageEvidenceChainSchema,
  StageEvidenceLinkSchema,
  StageRunContextSchema,
  TenantScopeSchema,
  TrustEscalationOpSchema,
} from './schema';
import type { DocumentAdapterErrorSchema as DocumentAdapterErrorSchemaFromErrors } from './errors';

export type DocumentAdapterSchemaSync = [
  Expect<Equals<z.infer<typeof TenantScopeSchema>, TenantScope>>,
  Expect<Equals<z.infer<typeof DocumentContentSchema>, DocumentContent>>,
  Expect<Equals<z.infer<typeof DocumentDescriptorSchema>, DocumentDescriptor>>,
  Expect<Equals<z.infer<typeof StageRunContextSchema>, StageRunContext>>,
  Expect<Equals<z.infer<typeof PropertyMappingSchema>, PropertyMapping>>,
  Expect<Equals<z.infer<typeof ParsedMappingRowSchema>, ParsedMappingRow>>,
  Expect<Equals<z.infer<typeof ParsedDocumentSchema>, ParsedDocument>>,
  Expect<Equals<z.infer<typeof DocumentFieldLocatorSchema>, DocumentFieldLocator>>,
  Expect<Equals<z.infer<typeof ExtractionCandidateSchema>, ExtractionCandidate>>,
  Expect<Equals<z.infer<typeof StageEvidenceLinkSchema>, StageEvidenceLink>>,
  Expect<Equals<z.infer<typeof StageEvidenceChainSchema>, StageEvidenceChain>>,
  Expect<Equals<z.infer<typeof ProvisionalRegistrationPlanSchema>, ProvisionalRegistrationPlan>>,
  Expect<Equals<z.infer<typeof ProvisionalAdapterDefinitionSchema>, ProvisionalAdapterDefinition>>,
  Expect<Equals<z.infer<typeof DocumentAdapterErrorSchemaFromErrors>, DocumentAdapterError>>,
  Expect<Equals<z.infer<typeof DocumentAdapterIssueSchema>, DocumentAdapterIssue>>,
  Expect<Equals<z.infer<typeof ExtractionStageKindSchema>, ExtractionStageKind>>,
  Expect<Equals<z.infer<typeof TrustEscalationOpSchema>, TrustEscalationOp>>,
];
