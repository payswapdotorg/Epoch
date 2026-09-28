/**
 * Supervision contract versions and the closed vocabularies (W043).
 *
 * Delivery Supervision is the READ-ONLY observation layer over the W036
 * solution-delivery spine (USL1.0/SD1.0, binding: "The Delivery State
 * Engine evaluates: planned vs actual progress, critical path drift,
 * missing prerequisites, procurement lead-time risk, consumption
 * anomalies, cost variance, verification failures, unresolved
 * high-impact unknowns"). Construction delivery is ONE projection; the
 * same supervision spine serves every realization variant.
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, marketplace, ERP,
 * PM tool or notification surface. External notification channels stay
 * behind the alerts kernel's NotificationPort seam (@epoch/alerts) and
 * the W042 external-event bridge — never this package.
 *
 * THE AUTHORITY SPLIT (lock rule 16 + the W038 precedent):
 * - ProgramOfWork (W036) — the authoritative schedule dimension.
 *   Supervision OBSERVES it; a record or input that tries to RE-SCHEDULE
 *   (carry schedule-mutation vocabulary) is a typed
 *   `re-schedule-rejected`.
 * - DeliveryRecord (W036) — the delivery-facts authority. Supervision
 *   folds its sealed actuals; it never writes delivery state.
 * - Procurement (W037) / Execution Tracking (W038) — sibling kernels
 *   consumed as OPAQUE typed input references (devDep compile-time
 *   parity; never runtime edges).
 * - Alerts (@epoch/alerts) — the severity/escalation authority over
 *   supervision findings. This kernel never names severities.
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * supervision record is admitted only when its `schemaVersion` equals
 * {@link SUPERVISION_RECORD_VERSION} exactly. {@link
 * SUPERVISION_CONTRACT_VERSION} versions the published contract surface
 * (schemas/ + the typed index export + contracts/supervision).
 */

/** Version of the published supervision contract surface (schemas/ + types). */
export const SUPERVISION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized supervision record. */
export const SUPERVISION_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized supervision event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (supervision
 * events are append-only typed events over the W010 event shapes, the
 * open `supervision:` payload namespace). The runtime parity test asserts
 * the constants are equal; a future W010 bump intentionally breaks that
 * parity and surfaces here as a review gate.
 */
export const SUPERVISION_EVENT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Id grammars (kind-prefixed, opaque, provider-neutral).
// --------------------------------------------------------------------------------

/** Finding id grammar: `finding:<slug>`. */
export const FINDING_ID_PATTERN = /^finding:[a-z0-9][a-z0-9-]{0,62}$/;

/** Supervision-pass id grammar: `pass:<slug>`. */
export const SUPERVISION_PASS_ID_PATTERN = /^pass:[a-z0-9][a-z0-9-]{0,62}$/;

/** Supervision stream id grammar: `stream:supervision-<suffix>` (one stream per supervised program). */
export const SUPERVISION_STREAM_ID_PATTERN = /^stream:supervision-[a-z0-9][a-z0-9-]{0,54}$/;

/** Supervision principal id grammar (the W009 principal grammar, mirrored). */
export const SUPERVISION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Execution-issue summary id grammar (the W038 issue families, mirrored). */
export const ISSUE_SUMMARY_ID_PATTERN =
  /^(change|delay|rework|defect|blocker):[a-z0-9][a-z0-9-]{0,62}$/;

/** Lead-time risk input id grammar: `lead-time:<slug>`. */
export const LEAD_TIME_INPUT_ID_PATTERN = /^lead-time:[a-z0-9][a-z0-9-]{0,62}$/;

/** Finding-class token grammar (also the policy rule key in @epoch/alerts). */
export const FINDING_CLASS_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** Neutral subject-kind token grammar (W036 subject kinds + supervision extensions). */
export const SUBJECT_KIND_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

// --------------------------------------------------------------------------------
// Finding classes (the W043 "must provide" list, one class per family).
// --------------------------------------------------------------------------------

/** The closed supervision finding classes. */
export const FINDING_CLASSES = [
  'planned-vs-actual',
  'critical-path-drift',
  'missing-prerequisite',
  'lead-time-risk',
  'consumption-anomaly',
  'verification-failure',
  'unresolved-unknown',
] as const;

/** One supervision finding class. */
export type FindingClass = (typeof FINDING_CLASSES)[number];

// --------------------------------------------------------------------------------
// Finding statuses (the W043 pin: due / late / blocked / drifted).
// --------------------------------------------------------------------------------

/**
 * The closed supervision finding statuses. `blocked` outranks `late`
 * (an impediment explains the delay), `late` outranks `drifted` (the
 * plan date has actually passed), `drifted` outranks `due` (a forecast
 * deviation exists while the plan window is still open).
 */
export const FINDING_STATUSES = ['due', 'drifted', 'late', 'blocked'] as const;

/** One supervision finding status. */
export type FindingStatus = (typeof FINDING_STATUSES)[number];

// --------------------------------------------------------------------------------
// Finding subjects (what a finding is about).
// --------------------------------------------------------------------------------

/**
 * The closed finding-subject kinds: the W036 distinction-subject kinds
 * plus the supervision-only extensions (gates, acquisitions and
 * information requests).
 */
export const FINDING_SUBJECT_KINDS = [
  'solution',
  'solution-line',
  'work-package',
  'activity',
  'milestone',
  'program',
  'delivery',
  'gate',
  'acquisition',
  'info-request',
  'execution-issue',
] as const;

/** One finding-subject kind. */
export type FindingSubjectKind = (typeof FINDING_SUBJECT_KINDS)[number];

// --------------------------------------------------------------------------------
// Provenance (the W006 convention: exact-revision source references).
// --------------------------------------------------------------------------------

/** The closed provenance reference kinds of a supervision finding. */
export const PROVENANCE_REFERENCE_KINDS = [
  'program',
  'delivery',
  'activity',
  'work-package',
  'milestone',
  'gate',
  'execution-issue',
  'lead-time-record',
  'info-request',
  'distinction-record',
] as const;

/** One provenance reference kind. */
export type ProvenanceReferenceKind = (typeof PROVENANCE_REFERENCE_KINDS)[number];

// --------------------------------------------------------------------------------
// Consumption/cost anomaly vocabulary.
// --------------------------------------------------------------------------------

/** The closed anomaly breach classes (magnitude + breach class on every anomaly finding). */
export const ANOMALY_BREACH_CLASSES = [
  'quantity-overrun',
  'quantity-underrun',
  'cost-overrun',
  'cost-underrun',
] as const;

/** One anomaly breach class. */
export type AnomalyBreachClass = (typeof ANOMALY_BREACH_CLASSES)[number];

// --------------------------------------------------------------------------------
// The supervision:* event vocabulary (the W010 open-namespace family owned
// by this package; one stream per supervised program).
// --------------------------------------------------------------------------------

/** The supervision lifecycle event discriminators (the `supervision:` namespace). */
export const SUPERVISION_EVENT_DISCRIMINATORS = [
  'supervision:program-registered',
  'supervision:delivery-registered',
  'supervision:policy-registered',
  'supervision:pass-evaluated',
  'supervision:finding-produced',
  'supervision:alert-raised',
  'supervision:alert-revised',
  'supervision:alert-escalated',
  'supervision:alert-resolved',
  'supervision:notification-dispatched',
  'supervision:projection-updated',
] as const;

/** One supervision event payload discriminator. */
export type SupervisionEventDiscriminator = (typeof SUPERVISION_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminators (the sealed-envelope discipline).
// --------------------------------------------------------------------------------

export const SUPERVISION_FINDING_SCHEMA_NAME = 'epoch.supervision.finding' as const;
export const SUPERVISION_PASS_SCHEMA_NAME = 'epoch.supervision.supervision-pass' as const;
export const EXECUTION_ISSUE_SUMMARY_SCHEMA_NAME = 'epoch.supervision.execution-issue-summary' as const;
export const LEAD_TIME_RISK_INPUT_SCHEMA_NAME = 'epoch.supervision.lead-time-risk-input' as const;
export const SUPERVISION_EVENT_SCHEMA_NAME = 'epoch.supervision.event' as const;

// --------------------------------------------------------------------------------
// Schedule-authority guard (the W043 pin: supervision OBSERVES, never
// re-schedules — mutation vocabulary on supervision-side records is a
// typed `re-schedule-rejected` BEFORE validation).
// --------------------------------------------------------------------------------

/**
 * Field names that express an attempt to MUTATE ProgramOfWork schedule
 * state through a supervision-side record (issue summaries, lead-time
 * inputs, the evaluation input itself). The ProgramOfWork and
 * DeliveryRecord authorities legitimately carry planned/actual schedule
 * FIELDS; these keys, by contrast, only ever mean "change the plan".
 */
export const SCHEDULE_MUTATION_FIELDS = [
  'revisedPlannedStart',
  'revisedPlannedFinish',
  'revisedForecastFinish',
  'proposedPredecessors',
  'proposedSuccessors',
  'proposedReschedule',
  'scheduleChange',
  'reschedule',
] as const;

/** One schedule-mutation field name. */
export type ScheduleMutationField = (typeof SCHEDULE_MUTATION_FIELDS)[number];

// --------------------------------------------------------------------------------
// Stream derivation (deterministic; one stream per supervised program).
// --------------------------------------------------------------------------------

/** Slugify an opaque kind-prefixed id into the stream-suffix grammar (the W038 pattern: the kind prefix is stripped). */
function streamSuffixOf(id: string): string {
  const stripped = /^[a-z][a-z0-9-]*:/.test(id) ? id.slice(id.indexOf(':') + 1) : id;
  const slug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55);
  return slug.length >= 1 ? slug : 'program';
}

/** Derive the supervision stream id of one supervised program (`stream:supervision-<suffix>`). */
export function supervisionStreamIdOf(programId: string): string {
  return `stream:supervision-${streamSuffixOf(programId)}`;
}

/** Derive the supervision host stream id of one tenant (`stream:supervision-host-<suffix>`). */
export function supervisionHostStreamIdOf(tenantId: string): string {
  return `stream:supervision-host-${streamSuffixOf(tenantId)}`;
}

/** The class prefix of a finding id (`finding`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
