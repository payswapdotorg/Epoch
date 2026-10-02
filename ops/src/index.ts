/**
 * @epoch/ops-kit — public API (Work Order W033).
 *
 * The OPERATIONS KIT over @epoch/deploy-model:
 *
 *   RUNBOOKS    — typed, versioned DATA: incident class -> detection
 *                 signals -> containment/mitigation steps -> recovery
 *                 verification; runbooks reference topology components by
 *                 id; one reference runbook per incident class
 *                 (runbookCatalog).
 *   SIMULATOR   — simulateIncidentRunbook: replays a runbook's steps
 *                 against a fixture incident trace deterministically,
 *                 emitting a sealed RECOVERY PROOF
 *                 (`runbook-reaches-recovery` per incident class).
 *   PROCEDURES  — release + rollback procedures as typed checklists with
 *                 provenance, derived from sealed plans/runs.
 *
 * Runtime dependency policy (W033 pin): @epoch/deploy-model (this tree's
 * deploy surface — itself depending only on @epoch/agent-protocol,
 * @epoch/tenancy and zod). Zero wall-clock, zero randomness, zero network.
 */

// Versions + closed vocabularies.
export {
  DETECTION_SIGNAL_KINDS,
  INCIDENT_CLASSES,
  INCIDENT_EVENT_KINDS,
  OPS_ERROR_CODES,
  OPS_KIT_CONTRACT_VERSION,
  OPS_RECORD_VERSION,
  RECOVERY_CHECKS,
  RUNBOOK_ACTIONS,
} from './version';
export type {
  DetectionSignalKind,
  IncidentClass,
  IncidentEventKind,
  OpsErrorCode,
  RecoveryCheckKind,
  RunbookAction,
} from './version';

// Errors + total-result shape.
export { opsFail, opsUnwrap } from './errors';
export type { OpsError, OpsResult } from './errors';

// Runbooks.
export {
  DetectionSignalSchema,
  RecoveryCheckSchema,
  RunbookContentSchema,
  RunbookRecordSchema,
  RunbookStepSchema,
} from './runbooks/schema';
export type {
  DetectionSignal,
  RecoveryCheck,
  RunbookContent,
  RunbookRecord,
  RunbookStep,
} from './runbooks/schema';
export { CATALOG_COMPONENTS, runbookCatalog } from './runbooks/catalog';
// W054 (ACR-006): the acquisition runbooks are part of the ops-kit public
// API (the serialized W055 re-export — recorded as a W054 architecture
// question and applied here by the Tech Lead).
export {
  ACQUISITION_RUNBOOK_COMPONENTS,
  ACQUISITION_RUNBOOK_IDS,
  acquisitionRunbooks,
} from './runbooks/acquisition';

// Incident traces + the simulator.
export {
  IncidentEventSchema,
  IncidentTraceContentSchema,
  IncidentTraceSchema,
  TraceSignalSchema,
} from './incidents/schema';
export type {
  IncidentEvent,
  IncidentTrace,
  IncidentTraceContent,
  TraceSignal,
} from './incidents/schema';
export {
  RecoveryProofContentSchema,
  RecoveryProofSchema,
  admitRecoveryProof,
  deserializeIncidentTrace,
  deserializeRunbook,
  incidentTraceContent,
  runbookContent,
  sealIncidentTrace,
  sealRunbook,
  serializeIncidentTrace,
  serializeRecoveryProof,
  serializeRunbook,
  simulateIncidentRunbook,
  verifyIncidentTraceDigest,
  verifyRunbookDigest,
} from './incidents/simulator';
export type { RecoveryProof, RecoveryProofContent } from './incidents/simulator';

// Release/rollback procedures (typed checklists).
export {
  ChecklistContentSchema,
  OpsChecklistSchema,
  admitCompletedChecklist,
  checklistContent,
  completeChecklistItem,
  deserializeChecklist,
  releaseChecklistFor,
  rollbackChecklistFor,
  sealChecklist,
  serializeChecklist,
  verifyChecklistDigest,
} from './release/schema';
export type { ChecklistContent, OpsChecklist } from './release/schema';
