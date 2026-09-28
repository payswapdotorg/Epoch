/**
 * @epoch/supervision-runtime — public API (service layer, Work Order
 * W043).
 *
 * The thin typed HOST FACADE over the @epoch/supervision +
 * @epoch/alerts kernels:
 *
 * - program/delivery/policy registration (the REAL W036 sealed records
 *   verified at admission; idempotent by digest; replay-conflict on
 *   same id + different content);
 * - scheduled evaluation passes at CALLER-DRIVEN instants (no timers):
 *   the six supervision check families produce findings, alerts raise
 *   idempotently with append-only revisions across due -> late ->
 *   blocked transitions, notifications dispatch through the
 *   NotificationPort seam;
 * - the alert lifecycle: escalation through typed W003 proposals +
 *   verifiable gateway decisions (policy decision FIRST), terminal
 *   resolution, policy-driven re-notify cadence sweeps;
 * - the derived supervision-state projection + stream reads;
 * - `supervision:*` events on one stream per supervised program
 *   (`stream:supervision-<suffix>`, W010-shaped, digests sealed by the
 *   kernel);
 * - the W009 authorization gate denies unauthorized operations BEFORE
 *   any kernel admission; tenant isolation is typed
 *   `tenant-isolation-rejected`; supervision OBSERVES, never
 *   re-schedules (`re-schedule-rejected`).
 *
 * In-memory reference behavior: no persistence, no network, no clocks,
 * no randomness.
 */
export { SupervisionRuntime } from './runtime';
export { RUNTIME_RECORD_VERSION } from './version';
export {
  SUPERVISION_PUBLIC_CONTRACT_DIR,
  renderSupervisionPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';

export type {
  ActionProposal,
  AlertRaiseOutcome,
  AuthorizationInput,
  AuthorizationContext,
  EscalationPlan,
  EvaluationPassOutcome,
  ExecutionIssueSummary,
  GatewayDecisionOutcome,
  InformationAcquisitionRequest,
  LeadTimeRiskInput,
  NotificationPort,
  NotificationReceipt,
  RecordGatewayDecisionOptions,
  RegisterDeliveryOptions,
  RegisterPolicyOptions,
  RegisterProgramOptions,
  ResolveAlertOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  RunEvaluationPassOptions,
  SealedAlertRecord,
  SealedDeliveryRecord,
  SealedEscalationOutcome,
  SealedEscalationPolicy,
  SealedNotificationRecord,
  SealedProgramOfWork,
  StreamReadOptions,
  SupervisionHostProjection,
  SupervisionRuntimeOptions,
  SupervisionServiceError,
  SupervisionServiceResult,
  SupervisionStateOptions,
  SupervisionStateProjection,
  SupervisionThresholds,
} from './types';

