/**
 * @epoch/action-gateway — public API (service layer, Work Order W022).
 *
 * The EXECUTION AUTHORITY over the @epoch/action-policy kernel
 * (architecture.md, binding: "Actions propose; the Action Gateway
 * authorizes execution."; lock rule 3: "Actions execute only through the
 * Action Gateway."). The gateway:
 *
 * - gates intake with W009 authorization FIRST (`authorization-rejected`
 *   before any policy evaluation), then records the typed policy decision
 *   through the kernel (allow / deny / requires-approval, full W004
 *   provenance, append-only hash-chained records);
 * - drives the human-approval flow (quorum, deadlines, delegation bounds,
 *   supersession) with the kernel's typed rejections surfacing verbatim;
 * - dispatches execution through the ActionExecutionPort ADAPTER SEAM and
 *   records record-shaped outcomes ONLY (typed success/failure records
 *   with evidence references — the gateway never implements side effects);
 * - emits the action:* event vocabulary over the W010 shapes (one action =
 *   one stream; digests mirror computeEventDigest; the real sealEvent
 *   admits the same content — devDep parity tests);
 * - replays idempotently (duplicate-decision / duplicate-approval), holds
 *   tenant isolation (R12), and snapshots deterministically.
 *
 * In-memory reference behavior: NO persistence, NO network, NO real side
 * effects; core logic stays pure (zero wall-clock, zero randomness —
 * instants are caller-supplied).
 *
 * Runtime dependency policy (W022 Tech Lead pin): @epoch/action-policy
 * (the evaluation kernel), @epoch/action-protocol (the W003 vocabulary),
 * @epoch/authorization (the W009 decision point), @epoch/tenancy (the W009
 * tenant grammars), and zod. Compatibility with @epoch/event-log /
 * @epoch/evidence / @epoch/verification (and, for fixtures,
 * @epoch/policy-contracts) is exercised via devDependencies + parity tests
 * — never runtime deps.
 */

// Version + vocabularies.
export {
  ACTION_GATEWAY_CONTRACT_VERSION,
  ACTION_ID_PATTERN,
  ACTION_LIFECYCLE_EVENT_KIND,
  ACTION_STATUSES,
  ACTION_STREAM_PREFIX,
  GATEWAY_HEALTH_STATUSES,
  GATEWAY_RECORD_VERSION,
} from './version';
export type { ActionStatus, GatewayHealthStatus } from './version';

// Host-model types (the kernel contract types are re-exported below).
export type {
  ActionEntry,
  ActionExecutionPort,
  ActionGatewayOptions,
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionOutcomeContent,
  ActionReadOptions,
  ActionScope,
  ApprovalFlowOptions,
  ApprovalOutcome,
  AuthorizationGateInput,
  ExecuteActionOptions,
  ExecutionEffectResult,
  ExecutionOutcome,
  ExpiredApproval,
  GatewayError,
  GatewayHealth,
  GatewayResult,
  GatewaySnapshot,
  IntakeOutcome,
  ListActionsOptions,
  RejectionOutcome,
  SealedActionOutcomeRecord,
  SubmitActionOptions,
} from './types';

// The reference host.
export { ActionGateway } from './runtime';

// The execution adapter seam + the in-memory reference adapter.
export { InMemoryExecutionPort } from './adapters';

// The action:* event vocabulary over the W010 shapes (mirrored; parity-pinned).
export {
  ACTION_EVENT_ACTOR_PATTERN,
  ACTION_STREAM_ID_PATTERN,
  SHA256_HEX_PATTERN,
  ActionEventCausalParentSchema,
  ActionEventContentSchema,
  ActionEventPayloadSchema,
  ActionEventSequenceSchema,
  SealedActionEventSchema,
  actionIdIssue,
  actionStreamIdOf,
  computeActionEventDigest,
  intakeEventDetail,
  sealActionEvent,
  terminalPhaseOf,
  verifySealedActionEvent,
} from './events';
export type { ActionEventContent, ActionEventPayload, ActionEventPhase, SealedActionEvent } from './events';
export type { SealedDecisionLike } from './events';

// Execution outcome records (record-shaped outcomes ONLY).
export {
  ActionOutcomeContentSchema,
  SealedActionOutcomeRecordSchema,
  computeActionOutcomeDigest,
  sealActionOutcome,
  verifySealedActionOutcome,
} from './outcomes';

// Host-model validators (snapshot restore path).
export { ActionEntrySchema, GatewaySnapshotSchema, parseActionEntry, parseGatewaySnapshot } from './schema';

// Issue helpers (the kernel-shaped validation surface).
export { gatewayValidationError, rePathedIssues, zodIssuesToGatewayIssues } from './issues';

// Kernel contract types re-exported for one-stop typed consumption (the
// typed decision/approval contracts are @epoch/action-policy's — reused
// verbatim, never forked).
export type {
  ActionPolicyError,
  ApprovalDirective,
  ApprovalRequestState,
  ApprovalRequestStatus,
  PolicyDecisionOutcome,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
} from '@epoch/action-policy';
export { ActionPolicyRegistry } from '@epoch/action-policy';
