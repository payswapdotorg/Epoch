/**
 * @epoch/document-adapter — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider/vendor semantics cannot enter kernel types through the
 * document door (same policy as the W006/W007/W009/W011 kernels). Every
 * exported schema is part of the published surface emitted under
 * `schemas/`.
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  QualifiedTypeReferenceSchema,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { CapabilityCategorySchema, CapabilityOriginSchema } from '@epoch/capability-registry';
import {
  DOCUMENT_FORMATS,
  PROPERTY_NAME_PATTERN,
  SEMANTIC_TYPE_KEY_PATTERN,
  SOURCE_PATH_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  PROJECT_ID_PATTERN,
  TRUST_ESCALATION_OPS,
} from './version';

/** Proof-grade digest: lowercase hex SHA-256, exactly 64 characters. */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 digest as lowercase hex — the exact-revision address form. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'urn:epoch:document-adapter:sha256-digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Version discriminator for serialized document-adapter documents (v1). */
export const DocumentRecordVersionSchema = z.literal(1).meta({
  id: 'urn:epoch:document-adapter:record-version',
  title: 'DocumentRecordVersion',
  description: 'Version discriminator carried by every serialized document-adapter document (currently 1).',
});

/** Opaque tenant id: `tenant:<slug>` (W009 grammar). */
export const TenantIdSchema = z
  .string()
  .regex(TENANT_ID_PATTERN, 'must be a tenant id of the form "tenant:<slug>"')
  .meta({
    id: 'urn:epoch:document-adapter:tenant-id',
    title: 'TenantId',
    description: 'Opaque tenant identity: "tenant:" followed by a lowercase slug.',
  });

/** Opaque workspace id: `workspace:<slug>` (W009 grammar). */
export const WorkspaceIdSchema = z
  .string()
  .regex(WORKSPACE_ID_PATTERN, 'must be a workspace id of the form "workspace:<slug>"')
  .meta({
    id: 'urn:epoch:document-adapter:workspace-id',
    title: 'WorkspaceId',
    description: 'Opaque workspace identity: "workspace:" followed by a lowercase slug.',
  });

/** Opaque project id: `project:<slug>` (W009 grammar). */
export const ProjectIdSchema = z
  .string()
  .regex(PROJECT_ID_PATTERN, 'must be a project id of the form "project:<slug>"')
  .meta({
    id: 'urn:epoch:document-adapter:project-id',
    title: 'ProjectId',
    description: 'Opaque project identity: "project:" followed by a lowercase slug.',
  });

/** Tenant scoping of documents, candidates, and evidence (R12). */
export const TenantScopeSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:tenant-scope',
    title: 'TenantScope',
    description: 'Tenant scoping: owning tenant plus optional workspace/project narrowing.',
  });

/** The supported deterministic document forms (closed vocabulary). */
export const DocumentFormatSchema = z.enum(DOCUMENT_FORMATS).meta({
  id: 'urn:epoch:document-adapter:document-format',
  title: 'DocumentFormat',
  description: 'Deterministic document form: structured-text or structured-json (real formats are future adapters).',
});

/** One derivation stage of the provisional pipeline. */
export const ExtractionStageKindSchema = z
  .enum(['uploaded', 'parsed', 'candidates-extracted', 'review-pending', 'provisional'])
  .meta({
    id: 'urn:epoch:document-adapter:extraction-stage-kind',
    title: 'ExtractionStageKind',
    description: 'Derivation stage: uploaded, parsed, candidates-extracted, review-pending, provisional (terminal).',
  });

/** One always-denied trust-escalation operation. */
export const TrustEscalationOpSchema = z.enum(TRUST_ESCALATION_OPS).meta({
  id: 'urn:epoch:document-adapter:trust-escalation-op',
  title: 'TrustEscalationOp',
  description: 'Trust-escalation operation that is always denied for document-derived mappings: certify, execute, grant-capability.',
});

/** Opaque document artifact identity: `doc:` + 64 hex (content-derived). */
export const DocumentIdSchema = z
  .string()
  .regex(/^doc:[0-9a-f]{64}$/, 'must be a document id of the form "doc:<sha256-hex>"')
  .meta({
    id: 'urn:epoch:document-adapter:document-id',
    title: 'DocumentId',
    description: 'Opaque, content-derived document artifact identity: "doc:" + 64 lowercase hex characters.',
  });

/** Opaque candidate identity: `cand:` + 64 hex (content-derived). */
export const CandidateIdSchema = z
  .string()
  .regex(/^cand:[0-9a-f]{64}$/, 'must be a candidate id of the form "cand:<sha256-hex>"')
  .meta({
    id: 'urn:epoch:document-adapter:candidate-id',
    title: 'CandidateId',
    description: 'Opaque, content-derived mapping-candidate identity: "cand:" + 64 lowercase hex characters.',
  });

/** Opaque provisional-definition identity: `docmap:` + 64 hex. */
export const DefinitionIdSchema = z
  .string()
  .regex(/^docmap:[0-9a-f]{64}$/, 'must be a definition id of the form "docmap:<sha256-hex>"')
  .meta({
    id: 'urn:epoch:document-adapter:definition-id',
    title: 'DefinitionId',
    description: 'Opaque, content-derived provisional-definition identity: "docmap:" + 64 lowercase hex characters.',
  });

/** W002 semantic type key: `namespace:name` (lowercase segments). */
export const SemanticTypeKeySchema = z
  .string()
  .regex(SEMANTIC_TYPE_KEY_PATTERN, "must be a W002 semantic type key of the form 'namespace:name' with lowercase segments")
  .meta({
    id: 'urn:epoch:document-adapter:semantic-type-key',
    title: 'SemanticTypeKey',
    description: 'W002 world-model semantic namespace type key (namespace:name); the core namespace is reserved for kernel vocabulary.',
  });

/** Document field locator source path (stable identifier grammar). */
export const SourcePathSchema = z
  .string()
  .regex(SOURCE_PATH_PATTERN, 'must be a stable document field identifier (letter first, then letters/digits/._-)')
  .meta({
    id: 'urn:epoch:document-adapter:source-path',
    title: 'SourcePath',
    description: 'Stable identifier of a document field inside a typed document form.',
  });

/** Document property name (source and semantic sides). */
export const PropertyNameSchema = z
  .string()
  .regex(PROPERTY_NAME_PATTERN, 'must be a short stable property identifier')
  .meta({
    id: 'urn:epoch:document-adapter:property-name',
    title: 'PropertyName',
    description: 'Document property name (source and semantic sides), W002 property-name grammar.',
  });

/** The typed document bytes: one content shape per format. */
export const DocumentContentSchema = z
  .discriminatedUnion('format', [
    z
      .strictObject({
        format: z.literal('structured-text'),
        text: z.string().min(1),
      })
      .readonly(),
    z
      .strictObject({
        format: z.literal('structured-json'),
        json: JsonValueSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'urn:epoch:document-adapter:document-content',
    title: 'DocumentContent',
    description: 'Typed document bytes: structured-text (UTF-8 text) or structured-json (JSON value).',
  });

/** Content-addressed, format-typed, tenant-scoped document descriptor. */
export const DocumentDescriptorSchema = z
  .strictObject({
    schemaVersion: DocumentRecordVersionSchema,
    tenantScope: TenantScopeSchema,
    digest: Sha256DigestSchema,
    format: DocumentFormatSchema,
    byteLength: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:document-descriptor',
    title: 'DocumentDescriptor',
    description: 'Content-addressed (SHA-256 over canonical bytes), format-typed, tenant-scoped document descriptor.',
  });

/** Host-supplied run context for stage evidence emission (zero wall-clock in src). */
export const StageRunContextSchema = z
  .strictObject({
    runId: z.string().min(1).max(256),
    actorId: z.string().min(1).max(256),
    methodId: z.string().min(1).max(256).optional(),
    observedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:stage-run-context',
    title: 'StageRunContext',
    description: 'Host-supplied run identity and observation instant for stage evidence emission.',
  });

/** One property-level mapping: document property -> semantic property. */
export const PropertyMappingSchema = z
  .strictObject({
    sourceProperty: PropertyNameSchema,
    semanticProperty: PropertyNameSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:property-mapping',
    title: 'PropertyMapping',
    description: 'One property-level mapping from a document property onto a semantic property.',
  });

/** One parsed mapping row of the typed mapping-table form. */
export const ParsedMappingRowSchema = z
  .strictObject({
    sourcePath: SourcePathSchema,
    semanticTarget: SemanticTypeKeySchema,
    propertyMappings: z.array(PropertyMappingSchema).readonly(),
    declaredConfidence: z.number().min(0).max(1).optional(),
    capabilityRef: QualifiedTypeReferenceSchema.optional(),
    line: z.number().int().min(1).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:parsed-mapping-row',
    title: 'ParsedMappingRow',
    description: 'One parsed mapping row: source path, W002 semantic target, property mappings, optional confidence/capability reference.',
  });

/** The normalized typed view of a parsed document. */
export const ParsedDocumentSchema = z
  .strictObject({
    schemaVersion: DocumentRecordVersionSchema,
    descriptor: DocumentDescriptorSchema,
    canonicalBytes: z.string(),
    rows: z.array(ParsedMappingRowSchema).min(1).readonly(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:parsed-document',
    title: 'ParsedDocument',
    description: 'Normalized typed view of a parsed mapping-table document: descriptor, canonical bytes, mapping rows.',
  });

/** Where a candidate was found in the document. */
export const DocumentFieldLocatorSchema = z
  .discriminatedUnion('format', [
    z
      .strictObject({
        format: z.literal('structured-text'),
        sourcePath: SourcePathSchema,
        line: z.number().int().min(1),
      })
      .readonly(),
    z
      .strictObject({
        format: z.literal('structured-json'),
        sourcePath: SourcePathSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'urn:epoch:document-adapter:document-field-locator',
    title: 'DocumentFieldLocator',
    description: 'Document field locator: format, stable source path, and (text form) 1-based line.',
  });

/** A typed mapping candidate (pure projection, content-addressed). */
export const ExtractionCandidateSchema = z
  .strictObject({
    schemaVersion: DocumentRecordVersionSchema,
    candidateId: CandidateIdSchema,
    documentDigest: Sha256DigestSchema,
    tenantScope: TenantScopeSchema,
    locator: DocumentFieldLocatorSchema,
    semanticTarget: SemanticTypeKeySchema,
    propertyMappings: z.array(PropertyMappingSchema).readonly(),
    declaredConfidence: z.number().min(0).max(1).optional(),
    capabilityRef: QualifiedTypeReferenceSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:extraction-candidate',
    title: 'ExtractionCandidate',
    description: 'Typed mapping candidate derived deterministically from a content-addressed document: field locator onto W002 semantic target.',
  });

/** One link of the stage evidence chain. */
export const StageEvidenceLinkSchema = z
  .strictObject({
    stage: ExtractionStageKindSchema,
    evidenceDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:stage-evidence-link',
    title: 'StageEvidenceLink',
    description: 'One stage evidence link: derivation stage plus the content address of its W006 evidence record.',
  });

/** The ordered stage evidence chain anchored to a document digest. */
export const StageEvidenceChainSchema = z
  .strictObject({
    schemaVersion: DocumentRecordVersionSchema,
    documentDigest: Sha256DigestSchema,
    tenantScope: TenantScopeSchema,
    stages: z.array(StageEvidenceLinkSchema).min(1).readonly(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:stage-evidence-chain',
    title: 'StageEvidenceChain',
    description: 'Ordered stage evidence chain: a prefix of the derivation pipeline, every link a W006 evidence record anchored to the document digest.',
  });

/** Contract reference shape (W007 vocabulary, re-declared locally for the strict surface). */
const ContractReferenceSchema = z
  .strictObject({
    contractId: z.string().min(1).max(256),
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .readonly();

/** The W007 source-category registration plan of a provisional mapping. */
export const ProvisionalRegistrationPlanSchema = z
  .strictObject({
    capabilityId: z
      .string()
      .regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'must be a dot-namespaced qualified capability id'),
    category: CapabilityCategorySchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a semver core version'),
    origin: CapabilityOriginSchema,
    contracts: z.array(ContractReferenceSchema).readonly(),
    attestationDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:provisional-registration-plan',
    title: 'ProvisionalRegistrationPlan',
    description: 'W007 source-category registration plan: derived plans carry category source and origin provisional-document-derived; the policy is enforced at build time.',
  });

/** The PROVISIONAL adapter definition (terminal lifecycle, full provenance). */
export const ProvisionalAdapterDefinitionSchema = z
  .strictObject({
    schemaVersion: DocumentRecordVersionSchema,
    definitionId: DefinitionIdSchema,
    tenantScope: TenantScopeSchema,
    documentDigest: Sha256DigestSchema,
    candidate: ExtractionCandidateSchema,
    evidenceChain: StageEvidenceChainSchema,
    registration: ProvisionalRegistrationPlanSchema,
    lifecycle: z.literal('provisional'),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:provisional-adapter-definition',
    title: 'ProvisionalAdapterDefinition',
    description: 'Provisional adapter definition: the mapping candidate with complete five-stage evidence provenance and its W007 registration plan; terminal lifecycle.',
  });

/** One flattened validation issue (dotted path + message; "$" = root). */
export const DocumentAdapterIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:document-adapter:document-adapter-issue',
    title: 'DocumentAdapterIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });
