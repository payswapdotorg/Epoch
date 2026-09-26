/**
 * @epoch/execution-tracking-runtime — public API (service layer, Work
 * Order W038).
 *
 * The thin typed HOST FACADE over the @epoch/execution-tracking kernel:
 *
 * - program + delivery registration (the REAL W036 sealed records are
 *   the authority inputs; idempotent by digest);
 * - the LOW-FRICTION field-capture intake, direct or through the
 *   FieldCapturePort adapter seam (ONE in-memory reference adapter; the
 *   core never names a vendor) — linkage inference, uncertainty, and
 *   idempotent replay (the typed `duplicate-observation` admission);
 * - tracking-state transitions, issue raising/resolution, and
 *   reconciliation proposals applied EXCLUSIVELY through the W036
 *   DeliveryRecord authority path;
 * - `execution:*` events on one stream per work package
 *   (`stream:execution-<suffix>`, W010-shaped, digests sealed by the
 *   kernel);
 * - the deterministic execution-state projection, health, and snapshot.
 *
 * The W009 authorization gate denies unauthorized operations BEFORE any
 * kernel admission; tenant isolation is typed
 * `tenant-isolation-rejected`. In-memory reference behavior: no
 * persistence, no network, no clocks, no randomness.
 */
export { ExecutionTrackingRuntime } from './runtime';
export { InMemoryFieldCaptureAdapter } from './field-port';
export type { ReferenceCaptureSeed } from './field-port';
export { RUNTIME_RECORD_VERSION } from './version';

export type {
  ApplyReconciliationOptions,
  AuthorizationInput,
  DeliveryEntry,
  ExecutionServiceError,
  ExecutionServiceResult,
  ExecutionTrackingRuntimeOptions,
  FieldCapturePollRequest,
  FieldCapturePort,
  FieldCapturePortResult,
  FieldCaptureSubmission,
  FieldIntakeServiceOutcome,
  IntakeFieldCaptureOptions,
  PollFieldCapturesOptions,
  ProjectStateOptions,
  ProposalEntry,
  RaiseIssueOptions,
  RecordTrackingStateOptions,
  RegisterDeliveryOptions,
  RegisterProgramOptions,
  ResolveIssueOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  StoreEntry,
  StreamReadOptions,
  ProposeReconciliationOptions,
} from './types';
export type {
  ExecutionStateProjection,
  SealedDeliveryRecord,
  SealedProgramOfWork,
} from '@epoch/execution-tracking';
