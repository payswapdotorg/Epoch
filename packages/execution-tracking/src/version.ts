/**
 * Execution Tracking contract versions and the closed vocabularies (W038).
 *
 * Execution Tracking is the universal REALIZATION-TRACKING projection over
 * the W036 solution-delivery kernel (USL1.0: "Execution is a common
 * construction-facing term for realization, but the universal semantic
 * concept is Realization"). Construction execution is ONE projection;
 * software deployment, mechanical fabrication, electrical
 * installation/commissioning, manufacturing and infrastructure
 * provisioning are the other realization variants of the SAME spine —
 * the {@link DOMAIN_TRACKING_STATE_BINDINGS} table maps each domain's
 * natural vocabulary onto the canonical tracking states WITHOUT creating
 * a second lifecycle or schedule authority (ProgramOfWork remains the
 * authoritative schedule dimension; tracking records OBSERVE, never
 * re-schedule).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, marketplace, ERP,
 * PM tool, field platform or API surface. External field systems (mobile
 * capture, IoT, scanners) stay behind the service-layer
 * FieldCapturePort adapter seam.
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * execution-tracking record is admitted only when its `schemaVersion`
 * equals {@link EXECUTION_TRACKING_RECORD_VERSION} exactly; skew surfaces
 * as a `validation` issue at path ["schemaVersion"]. {@link
 * EXECUTION_TRACKING_CONTRACT_VERSION} versions the published contract
 * surface (schemas/ + the typed index export +
 * contracts/execution).
 */

/** Version of the published execution-tracking contract surface (schemas/ + types). */
export const EXECUTION_TRACKING_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized execution-tracking record. */
export const EXECUTION_TRACKING_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized execution event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (execution
 * events are append-only typed events over the W010 event shapes, the
 * open `execution:` payload namespace). The runtime parity test asserts
 * the constants are equal; a future W010 bump intentionally breaks that
 * parity and surfaces here as a review gate.
 */
export const EXECUTION_EVENT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Work-package/activity tracking states (the W038 pin: not-started,
// in-progress, completed, blocked — plus domain-mappable equivalents).
// --------------------------------------------------------------------------------

/** The canonical tracking states of a work package or activity. */
export const TRACKING_STATES = ['not-started', 'in-progress', 'completed', 'blocked'] as const;

/** One canonical tracking state. */
export type TrackingState = (typeof TRACKING_STATES)[number];

/**
 * The CLOSED tracking-state transition graph (append-only; recorded
 * events with provenance — never an FSM on the schedule):
 *
 * - `not-started -> in-progress | completed | blocked` (start, fast-track
 *   completion, or an impediment before start);
 * - `in-progress -> completed | blocked` (completion or impediment);
 * - `blocked -> in-progress | completed` (unblock resumes, or the
 *   impediment closes with the work done);
 * - `completed` is TERMINAL (rework ships as a NEW rework issue record +
 *   new tracking records — history is never rewritten).
 */
export const TRACKING_TRANSITIONS: Readonly<Record<TrackingState, readonly TrackingState[]>> = {
  'not-started': ['in-progress', 'completed', 'blocked'],
  'in-progress': ['completed', 'blocked'],
  blocked: ['in-progress', 'completed'],
  completed: [],
};

/** The implicit initial tracking state of every tracked subject. */
export const INITIAL_TRACKING_STATE: TrackingState = 'not-started';

/**
 * DOMAIN-MAPPABLE EQUIVALENTS (the USL1.0 domain projections): each
 * realization variant's natural execution vocabulary mapped onto the
 * canonical tracking states. A domain pack may PRESENT these terms; the
 * RECORDS carry the canonical states (one spine, many vocabularies —
 * never a competing state authority).
 */
export const DOMAIN_TRACKING_STATE_BINDINGS: Readonly<
  Record<string, Readonly<Record<TrackingState, readonly string[]>>>
> = {
  'construction-build': {
    'not-started': ['not-commenced', 'site-handover-pending'],
    'in-progress': ['on-site', 'erecting', 'pouring'],
    completed: ['built', 'practically-complete'],
    blocked: ['held-up', 'stopped'],
  },
  'software-implementation-deployment': {
    'not-started': ['backlog', 'not-picked-up'],
    'in-progress': ['implementing', 'in-review', 'deploying'],
    completed: ['deployed', 'released'],
    blocked: ['blocked', 'on-hold'],
  },
  'mechanical-fabrication-assembly': {
    'not-started': ['awaiting-materials'],
    'in-progress': ['fabricating', 'assembling'],
    completed: ['fabricated', 'assembled'],
    blocked: ['awaiting-parts'],
  },
  'electrical-installation-commissioning': {
    'not-started': ['not-installed'],
    'in-progress': ['installing', 'commissioning'],
    completed: ['commissioned', 'energized'],
    blocked: ['lockout'],
  },
  manufacturing: {
    'not-started': ['queued'],
    'in-progress': ['in-production', 'machining'],
    completed: ['produced', 'inspected-ok'],
    blocked: ['line-down'],
  },
  'infrastructure-provisioning': {
    'not-started': ['planned'],
    'in-progress': ['provisioning', 'configuring'],
    completed: ['provisioned', 'live'],
    blocked: ['capacity-pending'],
  },
  'field-service-repair': {
    'not-started': ['dispatch-pending'],
    'in-progress': ['on-assignment', 'diagnosing'],
    completed: ['repaired', 'restored'],
    blocked: ['awaiting-parts'],
  },
} as const;

// --------------------------------------------------------------------------------
// Resource observations (labor/equipment/material/resource usage).
// --------------------------------------------------------------------------------

/** The resource-usage observation kinds (USL1.0 Observe: labor/time, equipment/time, material consumption, waste). */
export const RESOURCE_KINDS = ['labor', 'equipment', 'material', 'resource'] as const;

/** One resource-usage observation kind. */
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

// --------------------------------------------------------------------------------
// Field evidence references.
// --------------------------------------------------------------------------------

/**
 * The field-evidence capture kinds (W006 evidence records referenced BY
 * DIGEST — photos, sensor readings, documents; NEVER embedded payloads).
 */
export const FIELD_EVIDENCE_KINDS = ['photo', 'sensor-reading', 'document'] as const;

/** One field-evidence capture kind. */
export type FieldEvidenceKind = (typeof FIELD_EVIDENCE_KINDS)[number];

// --------------------------------------------------------------------------------
// Changes, delays, rework, defects and blockers (typed record families).
// --------------------------------------------------------------------------------

/** The execution-issue record families (one id prefix per kind). */
export const ISSUE_KINDS = ['change', 'delay', 'rework', 'defect', 'blocker'] as const;

/** One execution-issue kind. */
export type IssueKind = (typeof ISSUE_KINDS)[number];

/** The severity vocabulary of every issue family. */
export const ISSUE_SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const;

/** One issue severity. */
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

/** The resolution states of one issue (open until a resolution record settles it). */
export const RESOLUTION_STATES = ['open', 'resolved', 'dismissed'] as const;

/** One issue resolution state. */
export type ResolutionState = (typeof RESOLUTION_STATES)[number];

/** The issue-resolution decisions (an issue accepts exactly one resolution). */
export const ISSUE_RESOLUTIONS = ['resolved', 'dismissed'] as const;

/** One issue-resolution decision. */
export type IssueResolutionDecision = (typeof ISSUE_RESOLUTIONS)[number];

// --------------------------------------------------------------------------------
// The execution:* event vocabulary (the W010 open-namespace family owned
// by this package; one stream per work package).
// --------------------------------------------------------------------------------

/** The execution lifecycle event discriminators (the `execution:` namespace). */
export const EXECUTION_EVENT_DISCRIMINATORS = [
  'execution:tracking-recorded',
  'execution:observation-recorded',
  'execution:resource-observation-recorded',
  'execution:evidence-linked',
  'execution:issue-raised',
  'execution:issue-resolved',
  'execution:reconciliation-proposed',
  'execution:reconciliation-applied',
  'execution:state-projected',
] as const;

/** One execution event payload discriminator. */
export type ExecutionEventDiscriminator = (typeof EXECUTION_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminators (the sealed-envelope discipline: a literal
// `schema` names the record family so mixed envelopes cannot be confused
// at admission).
// --------------------------------------------------------------------------------

export const TRACKING_STATE_SCHEMA_NAME = 'epoch.execution-tracking.tracking-state' as const;
export const RESOURCE_OBSERVATION_SCHEMA_NAME =
  'epoch.execution-tracking.resource-observation' as const;
export const FIELD_EVIDENCE_LINK_SCHEMA_NAME =
  'epoch.execution-tracking.field-evidence-link' as const;
export const ISSUE_RECORD_SCHEMA_NAME = 'epoch.execution-tracking.issue-record' as const;
export const ISSUE_RESOLUTION_SCHEMA_NAME = 'epoch.execution-tracking.issue-resolution' as const;
export const RECONCILIATION_PROPOSAL_SCHEMA_NAME =
  'epoch.execution-tracking.reconciliation-proposal' as const;
export const EXECUTION_EVENT_SCHEMA_NAME = 'epoch.execution-tracking.event' as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023/W036
// house pattern). The segment before `:` is the record kind; the slug is
// a lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Tracking-state record identity: `state:<slug>`. */
export const STATE_ID_PATTERN = /^state:[a-z0-9][a-z0-9-]{0,62}$/;

/** Resource-observation record identity: `resource-observation:<slug>`. */
export const RESOURCE_OBSERVATION_ID_PATTERN =
  /^resource-observation:[a-z0-9][a-z0-9-]{0,62}$/;

/** Field-evidence-link record identity: `evidence-link:<slug>`. */
export const EVIDENCE_LINK_ID_PATTERN = /^evidence-link:[a-z0-9][a-z0-9-]{0,62}$/;

/** Change-record identity: `change:<slug>`. */
export const CHANGE_ID_PATTERN = /^change:[a-z0-9][a-z0-9-]{0,62}$/;

/** Delay-record identity: `delay:<slug>`. */
export const DELAY_ID_PATTERN = /^delay:[a-z0-9][a-z0-9-]{0,62}$/;

/** Rework-record identity: `rework:<slug>`. */
export const REWORK_ID_PATTERN = /^rework:[a-z0-9][a-z0-9-]{0,62}$/;

/** Defect-record identity: `defect:<slug>`. */
export const DEFECT_ID_PATTERN = /^defect:[a-z0-9][a-z0-9-]{0,62}$/;

/** Blocker-record identity: `blocker:<slug>` (the W036 grammar). */
export const BLOCKER_ID_PATTERN = /^blocker:[a-z0-9][a-z0-9-]{0,62}$/;

/** Issue-resolution record identity: `issue-resolution:<slug>`. */
export const ISSUE_RESOLUTION_ID_PATTERN = /^issue-resolution:[a-z0-9][a-z0-9-]{0,62}$/;

/** Reconciliation-proposal record identity: `reconciliation:<slug>`. */
export const RECONCILIATION_ID_PATTERN = /^reconciliation:[a-z0-9][a-z0-9-]{0,62}$/;

/** The issue-record identity grammar per issue kind (prefix must match kind). */
export const ISSUE_ID_PATTERNS: Readonly<Record<IssueKind, RegExp>> = {
  change: CHANGE_ID_PATTERN,
  delay: DELAY_ID_PATTERN,
  rework: REWORK_ID_PATTERN,
  defect: DEFECT_ID_PATTERN,
  blocker: BLOCKER_ID_PATTERN,
};

/** The low-friction field-capture key grammar (a bare slug, embedded in derived ids). */
export const FIELD_CAPTURE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}$/;

/**
 * Execution event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One work
 * package's execution lifecycle events form one stream
 * (`stream:execution-<suffix>`); pinned by the runtime parity test.
 */
export const EXECUTION_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; runtime parity test
 * pins the pattern-identical constants).
 */
export const EXECUTION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** The kind prefix of an execution-tracking opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}

/**
 * Derive the execution event stream id of one work package:
 * `stream:execution-<suffix>` where the suffix is the work-package id's
 * slug (the work-package id grammar bounds the suffix so the derived
 * stream id always satisfies the W010 stream grammar). Deterministic.
 */
export function executionStreamIdOf(workPackageId: string): string {
  return `stream:execution-${workPackageId.slice('work-package:'.length)}`;
}

/** The issue-kind prefix of an issue record id (change/delay/rework/defect/blocker). */
export function issueKindOfId(recordId: string): string {
  return kindPrefixOf(recordId);
}
