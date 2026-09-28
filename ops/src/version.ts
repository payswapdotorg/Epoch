/**
 * @epoch/ops-kit — versions and closed vocabularies (Work Order W033).
 *
 * The OPERATIONS KIT over the deploy model: typed RUNBOOKS (data,
 * versioned), a deterministic incident SIMULATOR, and release/rollback
 * procedures as typed checklists with provenance. Runbooks reference
 * topology components BY ID; the simulator replays runbook steps against
 * fixture incident traces, proving each runbook's steps reach recovery.
 *
 * OBSERVABILITY NOTE (graceful W030 skip): `packages/observability` (W030)
 * is NOT merged at this revision, so runbook DETECTION SIGNALS use the
 * deploy-native signal vocabulary below (probe observations, gate reports,
 * state digests, capacity declarations). When W030 lands, its event
 * classes extend this vocabulary behind the same typed records — the
 * runbook model changes nothing (signals are data).
 *
 * Determinism: zero wall-clock, zero randomness, zero network (the W031
 * discipline). All error paths are typed values.
 */

/** Version of the ops-kit contract surface. */
export const OPS_KIT_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized ops record. */
export const OPS_RECORD_VERSION = 1 as const;

/**
 * The closed incident-class vocabulary — one runbook per class, one
 * fixture trace family per class (`runbook-reaches-recovery` per class).
 */
export const INCIDENT_CLASSES = [
  'health-degradation',
  'gate-violation',
  'capacity-exhaustion',
  'integrity-mismatch',
  'rollout-stall',
] as const;
export type IncidentClass = (typeof INCIDENT_CLASSES)[number];

/**
 * The deploy-native detection-signal vocabulary (the W030 observability
 * event classes join here as data when that surface lands).
 */
export const DETECTION_SIGNAL_KINDS = [
  'health-probe-failed',
  'health-probe-degraded',
  'gate-report-missing',
  'gate-command-failed',
  'capacity-exhausted',
  'digest-mismatch-observed',
  'deploy-step-stalled',
] as const;
export type DetectionSignalKind = (typeof DETECTION_SIGNAL_KINDS)[number];

/**
 * The closed runbook-step action vocabulary (neutral operator verbs —
 * what a step DOES to the incident, never a provider command).
 */
export const RUNBOOK_ACTIONS = [
  'quarantine-component',
  'freeze-deploys',
  'pin-prior-revision',
  'restore-placement-revision',
  'un-place-component',
  'verify-record-digests',
  're-run-verification-battery',
  'scale-out-component',
  're-run-health-probe',
  'clear-quarantine',
  'resume-deploy-steps',
  'notify-operator',
] as const;
export type RunbookAction = (typeof RUNBOOK_ACTIONS)[number];

/**
 * The closed recovery-check vocabulary — the typed predicates a runbook's
 * recovery verification evaluates over the post-mitigation state.
 */
export const RECOVERY_CHECKS = [
  'component-healthy',
  'component-degraded-but-serving',
  'placement-revision-restored',
  'all-gates-green',
  'capacity-within-envelope',
  'record-digests-verified',
  'deploy-steps-resumed',
  'operator-notified',
] as const;
export type RecoveryCheckKind = (typeof RECOVERY_CHECKS)[number];

/** Incident trace event kinds (fixture data). */
export const INCIDENT_EVENT_KINDS = [
  'probe-observed',
  'gate-outcome-observed',
  'capacity-observed',
  'digest-observed',
  'step-stalled-observed',
] as const;
export type IncidentEventKind = (typeof INCIDENT_EVENT_KINDS)[number];

/** The typed ops error vocabulary (values, never exceptions). */
export const OPS_ERROR_CODES = [
  'validation',
  'digest-mismatch',
  'unknown-runbook',
  'unknown-incident-class',
  'unknown-component',
  'unknown-environment',
  'duplicate-record',
  'signal-not-matched',
  'recovery-not-reached',
  'provider-vocabulary-rejected',
  'topology-skew',
] as const;
export type OpsErrorCode = (typeof OPS_ERROR_CODES)[number];
