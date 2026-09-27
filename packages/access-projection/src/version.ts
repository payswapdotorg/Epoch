/**
 * Access-projection contract versions and the closed vocabularies (W041).
 *
 * Identity != tenancy != authorization != policy (lock rule 12): this
 * package owns the PROJECTION layer only — which fields of a canonical,
 * already-authorized object a subject may see. The authorization DECISION
 * is @epoch/authorization's (W009); the canonical records are
 * @epoch/solution-delivery's (W036); tenancy scoping is @epoch/tenancy's
 * (W009). This kernel CONSUMES decisions and records; it never
 * re-implements any of them, and it never creates a second authority
 * (anything needing new lifecycle/schedule/delivery semantics is an
 * architecture question, not a field).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, IdP, cloud, ERP
 * or API surface. Roles, task classes, principals and tenants are OPAQUE
 * kind-prefixed slugs.
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * access-projection record is admitted only when its `schemaVersion`
 * equals {@link ACCESS_PROJECTION_RECORD_VERSION} exactly; skew surfaces
 * as a `validation` issue at path ["schemaVersion"].
 * {@link ACCESS_PROJECTION_CONTRACT_VERSION} versions the published
 * contract surface (schemas/ + the typed index export +
 * contracts/access-projection).
 */

/** Version of the published access-projection contract surface (schemas/ + types). */
export const ACCESS_PROJECTION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized access-projection record. */
export const ACCESS_PROJECTION_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized access-projection
 * event — MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION
 * (access-projection events are append-only typed events over the W010
 * event shapes, the open `access-projection:` payload namespace). The
 * runtime parity test asserts the constants are equal; a future W010
 * bump intentionally breaks that parity and surfaces here as a review
 * gate.
 */
export const ACCESS_PROJECTION_EVENT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// The projection action vocabulary (object/action-aware authorization).
// --------------------------------------------------------------------------------

/** The projection actions (distinct policy rows; view is the baseline). */
export const PROJECTION_ACTIONS = ['view', 'export', 'share'] as const;

/** One projection action. */
export type ProjectionAction = (typeof PROJECTION_ACTIONS)[number];

/** The action-kind prefix every W009 request over this kernel carries. */
export const ACCESS_ACTION_KIND_PREFIX = 'access-projection.' as const;

/** The action kinds of the W009 requests this kernel consumes. */
export const ACCESS_ACTION_KINDS = [
  'access-projection.view',
  'access-projection.export',
  'access-projection.share',
] as const;

/** One access-projection action kind (the W009 request grammar). */
export type AccessActionKind = (typeof ACCESS_ACTION_KINDS)[number];

/** The action of one action kind (`access-projection.view` -> `view`). */
export function actionOfActionKind(actionKind: string): ProjectionAction | null {
  if (!actionKind.startsWith(ACCESS_ACTION_KIND_PREFIX)) return null;
  const action = actionKind.slice(ACCESS_ACTION_KIND_PREFIX.length);
  return (PROJECTION_ACTIONS as readonly string[]).includes(action)
    ? (action as ProjectionAction)
    : null;
}

// --------------------------------------------------------------------------------
// Principal kinds (the W009/W001 identity vocabulary, mirrored and
// parity-pinned against @epoch/identity — humans, agents, and SERVICE
// principals: service-to-service projections follow the same two-stage
// path as human ones).
// --------------------------------------------------------------------------------

/** The principal kinds a projection subject can have. */
export const PROJECTION_PRINCIPAL_KINDS = ['human', 'agent', 'service'] as const;

/** One projection principal kind. */
export type ProjectionPrincipalKind = (typeof PROJECTION_PRINCIPAL_KINDS)[number];

// --------------------------------------------------------------------------------
// The canonical object classes (the W036 record families this kernel
// projects). The class set is CLOSED: each entry names the sealed W036
// record family whose schema drives the field walk.
// --------------------------------------------------------------------------------

/** The canonical W036 object classes a policy can project. */
export const OBJECT_CLASSES = [
  'program-of-work',
  'delivery-record',
  'solution-version',
  'distinction-record',
] as const;

/** One canonical object class. */
export type ObjectClass = (typeof OBJECT_CLASSES)[number];

/** The W036 record schema discriminator of one object class. */
export const OBJECT_CLASS_SCHEMA_NAMES: Readonly<Record<ObjectClass, string>> = {
  'program-of-work': 'epoch.solution-delivery.program-of-work',
  'delivery-record': 'epoch.solution-delivery.delivery-record',
  'solution-version': 'epoch.solution-delivery.solution-version',
  'distinction-record': 'epoch.solution-delivery.distinction-record',
};

// --------------------------------------------------------------------------------
// Scope sections and redaction classes.
// --------------------------------------------------------------------------------

/** The scope sections a projection policy can filter (after the field walk). */
export const SCOPE_SECTIONS = ['evidence', 'commercial', 'supplier'] as const;

/** One scope section. */
export type ScopeSection = (typeof SCOPE_SECTIONS)[number];

/** The evidence-scope modes (which evidence references stay visible). */
export const EVIDENCE_SCOPE_MODES = ['all', 'listed', 'none'] as const;

/** One evidence-scope mode. */
export type EvidenceScopeMode = (typeof EVIDENCE_SCOPE_MODES)[number];

/** The visibility modes of the commercial/supplier sections. */
export const SECTION_VISIBILITY_MODES = ['visible', 'hidden'] as const;

/** One section visibility mode. */
export type SectionVisibility = (typeof SECTION_VISIBILITY_MODES)[number];

/**
 * The redaction classes (why a field became a RedactionMarker). Every
 * class names a SCOPE or policy dimension, never a vendor or a person.
 */
export const REDACTION_CLASSES = [
  'commercial-sensitive',
  'supplier-sensitive',
  'evidence-scoped',
  'principal-identifying',
  'policy-scoped',
  'task-scoped',
] as const;

/** One redaction class. */
export type RedactionClass = (typeof REDACTION_CLASSES)[number];

/** The default redaction class of fields struck by the allowlist itself. */
export const DEFAULT_REDACTION_CLASS: RedactionClass = 'policy-scoped';

/** The redaction class of fields struck by the task object scope. */
export const TASK_REDACTION_CLASS: RedactionClass = 'task-scoped';

// --------------------------------------------------------------------------------
// Projection policy lifecycle.
// --------------------------------------------------------------------------------

/** The lifecycle states of one projection policy revision. */
export const POLICY_STATUSES = ['active', 'retired'] as const;

/** One projection policy status. */
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

// --------------------------------------------------------------------------------
// Opaque id grammars (kind-prefixed slugs, the W009/W036 convention).
// --------------------------------------------------------------------------------

/** Id grammar of one projection policy (`policy:<slug>`). */
export const POLICY_ID_PATTERN = /^policy:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of one principal role (`role:<slug>`). */
export const ROLE_ID_PATTERN = /^role:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of one agent task class (`task-class:<slug>`). */
export const AGENT_TASK_CLASS_PATTERN = /^task-class:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of one audit record (`audit:<16 hex chars>` — derived, deterministic). */
export const AUDIT_RECORD_ID_PATTERN = /^audit:[0-9a-f]{16}$/;

/** Id grammar of one access-projection event stream (`stream:access-<slug>`). */
export const ACCESS_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of principals inside access-projection records (W009 mirror). */
export const ACCESS_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Id grammar of the derivation scope tag of evaluation keys. */
export const EVALUATION_KEY_SCOPE = 'access-projection-evaluation' as const;

// --------------------------------------------------------------------------------
// The access-projection event vocabulary (open namespace, W010 shapes).
// --------------------------------------------------------------------------------

/** The access-projection lifecycle event discriminators (the open namespace). */
export const ACCESS_PROJECTION_EVENT_DISCRIMINATORS = [
  'access-projection:policy-registered',
  'access-projection:record-admitted',
  'access-projection:projection-released',
  'access-projection:projection-denied',
  'access-projection:audit-recorded',
  'access-projection:state-projected',
] as const;

/** One access-projection event discriminator. */
export type AccessProjectionEventDiscriminator =
  (typeof ACCESS_PROJECTION_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminator literals (one per record family + the event).
// --------------------------------------------------------------------------------

/** Schema discriminator of projection policies. */
export const PROJECTION_POLICY_SCHEMA_NAME = 'epoch.access-projection.policy' as const;

/** Schema discriminator of authorized projections. */
export const AUTHORIZED_PROJECTION_SCHEMA_NAME = 'epoch.access-projection.projection' as const;

/** Schema discriminator of projection audit records. */
export const PROJECTION_AUDIT_SCHEMA_NAME = 'epoch.access-projection.audit' as const;

// --------------------------------------------------------------------------------
// Stream derivation (deterministic; one object = one stream, one policy =
// one stream, one tenant's state projection = one stream).
// --------------------------------------------------------------------------------

/** `program:tower-retrofit` -> `stream:access-program-tower-retrofit`. */
export function accessStreamIdOf(kindPrefixedId: string): string {
  return `stream:access-${kindPrefixedId.replace(/:/g, '-')}`;
}

/** `tenant:globex` -> `stream:access-state-globex` (the state stream). */
export function accessStateStreamIdOf(tenantId: string): string {
  return `stream:access-state-${tenantId.replace(/:/g, '-')}`;
}

/** `policy:client-view` -> `access-policy-client-view` (kind prefix of stream slugs). */
export function accessStreamSlugOf(kindPrefixedId: string): string {
  return kindPrefixedId.replace(/:/g, '-');
}
