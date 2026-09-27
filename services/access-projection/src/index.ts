/**
 * @epoch/access-projection-runtime — public API (service layer, W041).
 *
 * The thin typed HOST FACADE over @epoch/access-projection: policy
 * registration + versioning, canonical record admission, the two-stage
 * evaluation pipeline behind the W009 authorization gate, projection
 * materialization, audit emission (evaluation-key replay discipline),
 * the derived projection-state projection, and the access-projection:*
 * event streams. See src/runtime.ts for the ownership and determinism
 * contracts.
 */
export { AccessProjectionRuntime } from './runtime';
export { verifyCanonicalRecord } from './runtime';
export { RUNTIME_RECORD_VERSION } from './version';
export type {
  AccessProjectionRuntimeOptions,
  AccessServiceError,
  AccessServiceResult,
  AdmitRecordOptions,
  AuthorizationInput,
  CanonicalRecordReference,
  PolicyRevisionReference,
  ProjectOptions,
  ProjectStateOptions,
  ProjectionOutcome,
  ReadOptions,
  RegisterPolicyOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  StoreEntry,
  AccessStateProjection,
  CanonicalRecord,
  ProjectionEvaluation,
  ProjectionSubject,
  SealedAccessProjectionEvent,
  SealedProjectionAudit,
  TaskProjectionContext,
} from './types';
