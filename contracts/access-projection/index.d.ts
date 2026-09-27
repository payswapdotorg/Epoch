/**
 * Epoch Access Projection v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/access-projection` ownership boundary (Work Order W041). It
 * is self-contained: no imports, no runtime code, no vendor/brand/Aurum
 * vocabulary. The runtime implementation lives in
 * `@epoch/access-projection` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's
 * zod-inferred types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (USL1.0 / architecture lock rule 12): the authorization
 * DECISION is @epoch/authorization's (W009); the canonical records are
 * @epoch/solution-delivery's (W036); tenancy is @epoch/tenancy's. This
 * surface is the least-privilege PROJECTION layer: it consumes sealed
 * decisions and canonical records, and it never re-implements them and
 * never creates a second authority. Projections cite canonical objects
 * OPAQUELY (id + content digest — the W011 projected-reference
 * convention, mirrored here without an import: the boundary rules
 * forbid kernel->experience edges).
 *
 * NOTE: the `CanonicalRecord` union (objectClass-tagged sealed W036
 * records) stays on the IN-PACKAGE full surface
 * (packages/access-projection/schemas) — it embeds the W036 record
 * shapes, which downstream consumers bind to via
 * contracts/solution-delivery, not via re-declaration here.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published access-projection contract surface. */
export type AccessProjectionContractVersion = '1.0.0';

/** The projection actions (distinct policy rows; view is the baseline). */
export type ProjectionAction = 'view' | 'export' | 'share';

/** The canonical W036 object classes a policy can project. */
export type ObjectClass =
  | 'program-of-work'
  | 'delivery-record'
  | 'solution-version'
  | 'distinction-record';

/** The principal kinds a projection subject can have (W001 identity vocabulary). */
export type ProjectionPrincipalKind = 'human' | 'agent' | 'service';

/** The evidence-scope modes (which evidence references stay visible). */
export type EvidenceScopeMode = 'all' | 'listed' | 'none';

/** The visibility modes of the commercial/supplier sections. */
export type SectionVisibility = 'visible' | 'hidden';

/** The redaction classes (why a field became a RedactionMarker). */
export type RedactionClass =
  | 'commercial-sensitive'
  | 'supplier-sensitive'
  | 'evidence-scoped'
  | 'principal-identifying'
  | 'policy-scoped'
  | 'task-scoped';

/** The lifecycle states of one projection policy revision. */
export type PolicyStatus = 'active' | 'retired';

/** The access-projection lifecycle event discriminators (the open namespace). */
export type AccessProjectionEventDiscriminator =
  | 'access-projection:policy-registered'
  | 'access-projection:record-admitted'
  | 'access-projection:projection-released'
  | 'access-projection:projection-denied'
  | 'access-projection:audit-recorded'
  | 'access-projection:state-projected';

/** The audit outcome of one projection decision. */
export type AuditOutcome = 'released' | 'denied';

// ---------------------------------------------------------------------------
// Neutral primitives (opaque, provider-neutral id grammars).
// ---------------------------------------------------------------------------

/** One canonical JSON value (the shared protocol grammar). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** Canonical UTC timestamp with exactly 3 fractional digits. */
export type Timestamp = string;

/** Opaque tenant id: `tenant:<slug>`. */
export type TenantId = string;

/** Opaque principal id: `principal:<slug>` (the W009 identity grammar). */
export type PrincipalId = string;

/** One projection policy id: `policy:<slug>`. */
export type PolicyId = string;

/** One principal role id: `role:<slug>` (caller vocabulary). */
export type RoleId = string;

/** One agent task class: `task-class:<slug>`. */
export type AgentTaskClass = string;

/** One audit record id: `audit:<16 hex chars>` (derived, deterministic). */
export type AuditRecordId = string;

/** One access-projection stream id: `stream:access-<slug>`. */
export type AccessStreamId = string;

/** One principal id inside access-projection records (the W009 grammar). */
export type AccessPrincipalId = string;

/** One field-path template: dot-separated keys, `[]` = any array index. */
export type FieldPathTemplate = string;

/** A positive safe integer (1-based revisions and binding indexes). */
export type PositiveInteger = number;

// ---------------------------------------------------------------------------
// Scope filters (applied AFTER the field walk).
// ---------------------------------------------------------------------------

/** The evidence scope: all, none, or a sorted minimum-necessary digest allowlist. */
export type EvidenceScope =
  | { readonly mode: 'all' }
  | { readonly mode: 'none' }
  | { readonly mode: 'listed'; readonly allowedDigests: string[] };

/** One governed section visibility: visible or hidden. */
export type SectionVisibilityValue = SectionVisibility;

/** The scope filters of one policy binding. */
export type ScopeFilters = {
  readonly evidence: EvidenceScope;
  readonly commercial: SectionVisibility;
  readonly supplier: SectionVisibility;
};

/** One redaction rule: the redaction class carried by a struck field-path template. */
export type RedactionRule = {
  readonly fieldPath: string;
  readonly redactionClass: RedactionClass;
};

// ---------------------------------------------------------------------------
// Projection policies (policy is DATA).
// ---------------------------------------------------------------------------

/** The selector of one policy row: principal kind plus exactly one of (role, task class). */
export type BindingSelector =
  | { readonly principalKind: 'human'; readonly role: RoleId }
  | { readonly principalKind: 'service'; readonly role: RoleId }
  | {
      readonly principalKind: 'agent';
      readonly role?: RoleId | undefined;
      readonly agentTaskClass?: AgentTaskClass | undefined;
    };

/** One projection policy row: selector x object class -> actions/allowlist/scopes/redaction. */
export type PolicyBinding = {
  readonly selector: BindingSelector;
  readonly objectClass: ObjectClass;
  readonly allowedActions: ProjectionAction[];
  readonly fieldAllowlist: FieldPathTemplate[];
  readonly redactionRules: RedactionRule[];
  readonly defaultRedactionClass: RedactionClass;
  readonly scopeFilters: ScopeFilters;
};

/** The subject of one projection (principal id + kind + role/task class). */
export type ProjectionSubject = {
  readonly principalId: PrincipalId;
  readonly principalKind: ProjectionPrincipalKind;
  readonly role?: RoleId | undefined;
  readonly agentTaskClass?: AgentTaskClass | undefined;
};

/** Reference to the exact projection-policy revision a projection cites. */
export type PolicyRevisionRef = {
  readonly policyId: PolicyId;
  readonly revision: PositiveInteger;
  readonly policyDigest: Sha256Hex;
};

/** The immutable content of one projection policy revision. */
export type ProjectionPolicyContent = {
  readonly schema: 'epoch.access-projection.policy';
  readonly schemaVersion: 1;
  readonly policyId: PolicyId;
  readonly revision: PositiveInteger;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly status: PolicyStatus;
  readonly bindings: PolicyBinding[];
};

/** Published projection policy revision: content plus its SHA-256 content digest. */
export type SealedProjectionPolicy = {
  readonly schema: 'epoch.access-projection.policy';
  readonly schemaVersion: 1;
  readonly policyId: PolicyId;
  readonly revision: PositiveInteger;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly status: PolicyStatus;
  readonly bindings: PolicyBinding[];
  readonly contentDigest: Sha256Hex;
};

/** One agent task projection context (narrows to the task object scope). */
export type TaskProjectionContext = {
  readonly taskClass: AgentTaskClass;
  readonly workPackageIds: string[];
  readonly activityIds: string[];
};

// ---------------------------------------------------------------------------
// Authorized projections (released-by-reference + redaction markers).
// ---------------------------------------------------------------------------

/** The policy clause behind one redaction (policy revision + binding row). */
export type PolicyClauseRef = {
  readonly policyId: PolicyId;
  readonly revision: PositiveInteger;
  readonly bindingIndex: PositiveInteger;
};

/** One redaction marker: field path + policy clause + redaction class (never the value). */
export type RedactionMarker = {
  readonly kind: 'redacted';
  readonly path: string;
  readonly clause: PolicyClauseRef;
  readonly redactionClass: RedactionClass;
};

/** One released field: the walk path and the canonical value, BY REFERENCE. */
export type ReleasedField = {
  readonly kind: 'released';
  readonly path: string;
  readonly value: unknown;
};

/** One projection entry: a released field or a typed redaction marker. */
export type ProjectionEntry = ReleasedField | RedactionMarker;

/** The immutable content of one authorized projection. */
export type AuthorizedProjectionContent = {
  readonly schema: 'epoch.access-projection.projection';
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: Sha256Hex;
  readonly policyRef: PolicyRevisionRef;
  readonly decisionDigest: Sha256Hex;
  readonly subject: ProjectionSubject;
  readonly action: ProjectionAction;
  readonly taskContext?: TaskProjectionContext | undefined;
  readonly entries: ProjectionEntry[];
  readonly projectedAt: Timestamp;
  readonly projectedBy: PrincipalId;
};

/** Published authorized projection: content plus its SHA-256 content digest. */
export type SealedAuthorizedProjection = {
  readonly schema: 'epoch.access-projection.projection';
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: Sha256Hex;
  readonly policyRef: PolicyRevisionRef;
  readonly decisionDigest: Sha256Hex;
  readonly subject: ProjectionSubject;
  readonly action: ProjectionAction;
  readonly taskContext?: TaskProjectionContext | undefined;
  readonly entries: ProjectionEntry[];
  readonly projectedAt: Timestamp;
  readonly projectedBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The projection audit trail.
// ---------------------------------------------------------------------------

/** The provenance block of one audit record (the W006/W036 convention). */
export type AuditProvenance = {
  readonly kind: 'observed' | 'reported' | 'derived' | 'assumed' | 'imported' | 'unknown';
  readonly sourceRef?: string | undefined;
  readonly actor?: PrincipalId | undefined;
};

/** The scope summary one audit record carries. */
export type AppliedScopes = {
  readonly evidenceMode: EvidenceScopeMode;
  readonly allowedEvidenceCount: number;
  readonly commercial: SectionVisibility;
  readonly supplier: SectionVisibility;
};

/** The immutable content of one projection audit record. */
export type ProjectionAuditContent = {
  readonly schema: 'epoch.access-projection.audit';
  readonly schemaVersion: 1;
  readonly auditId: AuditRecordId;
  readonly tenantId: TenantId;
  readonly principalId: PrincipalId;
  readonly subject: ProjectionSubject;
  readonly policyRef: PolicyRevisionRef;
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: Sha256Hex;
  readonly decisionDigest: Sha256Hex;
  readonly action: ProjectionAction;
  readonly outcome: AuditOutcome;
  readonly denialCode?: string | undefined;
  readonly fieldsReleased: string[];
  readonly fieldsRedacted: string[];
  readonly appliedScopes: AppliedScopes;
  readonly evaluationKey: Sha256Hex;
  readonly provenance: AuditProvenance;
  readonly projectedAt: Timestamp;
};

/** Published projection audit record: content plus its SHA-256 content digest. */
export type SealedProjectionAudit = {
  readonly schema: 'epoch.access-projection.audit';
  readonly schemaVersion: 1;
  readonly auditId: AuditRecordId;
  readonly tenantId: TenantId;
  readonly principalId: PrincipalId;
  readonly subject: ProjectionSubject;
  readonly policyRef: PolicyRevisionRef;
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: Sha256Hex;
  readonly decisionDigest: Sha256Hex;
  readonly action: ProjectionAction;
  readonly outcome: AuditOutcome;
  readonly denialCode?: string | undefined;
  readonly fieldsReleased: string[];
  readonly fieldsRedacted: string[];
  readonly appliedScopes: AppliedScopes;
  readonly evaluationKey: Sha256Hex;
  readonly provenance: AuditProvenance;
  readonly projectedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Events (the W010 event shapes).
// ---------------------------------------------------------------------------

/** One access-projection event sequence number (1-based, contiguous per stream). */
export type AccessProjectionEventSequence = number;

/** Causal parent of an access-projection event (an earlier event in the same stream). */
export type AccessProjectionCausalParent = {
  readonly streamId: AccessStreamId;
  readonly sequence: AccessProjectionEventSequence;
};

/** Typed event payload: namespaced discriminator plus opaque JSON data. */
export type AccessProjectionEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** Immutable content of one access-projection lifecycle event (the W010 shape). */
export type AccessProjectionEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: AccessStreamId;
  readonly sequence: AccessProjectionEventSequence;
  readonly tenantId: TenantId;
  readonly actor: AccessPrincipalId;
  readonly causalParent: AccessProjectionCausalParent | null;
  readonly payload: AccessProjectionEventPayload;
  readonly occurredAt: Timestamp;
};

/** Published access-projection event: content plus its SHA-256 content digest. */
export type SealedAccessProjectionEvent = {
  readonly schemaVersion: 1;
  readonly streamId: AccessStreamId;
  readonly sequence: AccessProjectionEventSequence;
  readonly tenantId: TenantId;
  readonly actor: AccessPrincipalId;
  readonly causalParent: AccessProjectionCausalParent | null;
  readonly payload: AccessProjectionEventPayload;
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};
