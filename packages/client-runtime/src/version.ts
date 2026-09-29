/**
 * @epoch/client-runtime — versions, id grammars and the closed gateway
 * operation vocabulary (W046 / ACR-005).
 *
 * The operation vocabulary below is THE client-facing Application Gateway
 * surface shared by web, desktop and mobile (productization-architecture.md:
 * "All clients share semantic contracts"; lock rule 14). It is frozen by
 * this package; `services/application-gateway` implements it and the
 * authority-map walk test proves every operation maps to an existing Epoch
 * authority (ACR-005: the Application Gateway composes existing
 * authorities; it is NOT a new semantic authority).
 *
 * Provider-neutral by construction (lock rule 13): operation names describe
 * product capabilities, never vendors/platforms.
 */

/** Version of the published application-gateway contract surface. */
export const APPLICATION_GATEWAY_CONTRACT_VERSION = '1.0.0' as const;

/** The contract-version literal type (parity-pinned against contracts). */
export type ApplicationGatewayContractVersion = typeof APPLICATION_GATEWAY_CONTRACT_VERSION;

/** Version discriminator on serialized client-runtime records (v1). */
export const CLIENT_RUNTIME_RECORD_VERSION = 1 as const;

/** The record-version literal type (parity-pinned against contracts). */
export type ClientRuntimeRecordVersion = typeof CLIENT_RUNTIME_RECORD_VERSION;

/** Version of the client-runtime machinery itself (queues, replay, cache). */
export const CLIENT_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

/** The client-runtime machinery version literal type. */
export type ClientRuntimeContractVersion = typeof CLIENT_RUNTIME_CONTRACT_VERSION;

// ---------------------------------------------------------------------------
// Identifier grammars (self-contained; the tenant/workspace/project and
// principal grammars are imported VERBATIM from @epoch/tenancy and
// @epoch/identity — no grammar forking).
// ---------------------------------------------------------------------------

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Correlation identifier: `corr:` + lowercase slug. */
export const CORRELATION_ID_PATTERN = /^corr:[a-z0-9][a-z0-9-]{0,62}$/;

/** Causation identifier (the originating correlation id): `corr:` + slug. */
export const CAUSATION_ID_PATTERN = CORRELATION_ID_PATTERN;

/** Session identifier: `session:` + lowercase slug. */
export const SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/** Idempotency key: `idem:` + lowercase slug. */
export const IDEMPOTENCY_KEY_PATTERN = /^idem:[a-z0-9][a-z0-9-]{0,62}$/;

/** Offline queue entry identifier: `queue:` + lowercase slug. */
export const QUEUE_ID_PATTERN = /^queue:[a-z0-9][a-z0-9-]{0,62}$/;

/** UTC instant in the canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export const CLIENT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** One client family (origin of a gateway call). */
export const GATEWAY_ORIGINS = ['web', 'desktop', 'mobile', 'server'] as const;

/** One gateway operation kind: reads never carry idempotency keys. */
export const GATEWAY_OPERATION_KINDS = ['read', 'mutate'] as const;

/** Gateway operation kind. */
export type GatewayOperationKind = (typeof GATEWAY_OPERATION_KINDS)[number];

/** One client family. */
export type GatewayOrigin = (typeof GATEWAY_ORIGINS)[number];

/** Correlation identifier (`corr:<slug>`). */
export type CorrelationId = string;

/** Causation identifier (an originating `corr:<slug>`). */
export type CausationId = string;

/** Session identifier (`session:<slug>`). */
export type SessionId = string;

/** Idempotency key (`idem:<slug>`). */
export type IdempotencyKey = string;

/** Offline queue entry identifier (`queue:<slug>`). */
export type QueueId = string;

/** UTC instant in canonical form. */
export type ClientTimestamp = string;

/** Lowercase hex SHA-256 digest. */
export type Sha256Hex = string;

/** The name of one Application Gateway operation. */
export type GatewayOperationName = (typeof APPLICATION_GATEWAY_OPERATION_NAMES)[number];

/** One entry of the operation registry (a frozen capability declaration). */
export interface GatewayOperation {
  readonly name: GatewayOperationName;
  readonly kind: GatewayOperationKind;
  readonly queueable: boolean;
  readonly description: string;
}

/**
 * THE Application Gateway operation-name vocabulary (frozen v1 surface).
 * The registry below must cover EXACTLY these names — pinned by
 * `test/transport.test.ts` (registry == vocabulary, no drift).
 */
export const APPLICATION_GATEWAY_OPERATION_NAMES = [
  // identity/session.
  'session.issue',
  'session.validate',
  'session.revoke',
  // tenant/workspace/project context.
  'context.resolve',
  // world read projections.
  'world.snapshot',
  'world.entities',
  // evidence.
  'evidence.intake',
  'evidence.get',
  // agents / capability discovery.
  'discovery.run',
  // actions (the Action Gateway authority).
  'action.submit',
  'action.approve',
  'action.execute',
  'action.status',
  // constraints.
  'constraints.evaluate',
  // verification.
  'verification.validateChain',
  // solutions.
  'solution.sealVersion',
  'solution.approveBaseline',
  // program of work / domain schedule / BOQ.
  'program.build',
  'program.schedule',
  // delivery.
  'delivery.open',
  'delivery.observe',
  'delivery.close',
  // acquisition / procurement.
  'procurement.quote',
  'procurement.order',
  // actualization / forecast / outcome.
  'actualization.forecast',
  'outcome.learn',
  // authorized projections.
  'access.project',
  // supervision / alerts.
  'supervision.check',
  'alerts.raise',
  // marketplace / developer.
  'marketplace.entitlement',
  // events (READ only).
  'events.read',
  // recovery.
  'recovery.replay',
] as const;

/**
 * THE Application Gateway operation registry (frozen v1 surface).
 *
 * Mutating operations REQUIRE an idempotency key on every call (enforced by
 * `requireIdempotencyKey`); `queueable` marks the operations whose user
 * intents the offline queue may hold as PENDING PROJECTIONS — every
 * queueable operation is replayed through the Action Gateway path with
 * idempotency keys (the offline-admission negative (e)).
 */
export const APPLICATION_GATEWAY_OPERATIONS: readonly GatewayOperation[] = [
  // -- identity/session (authority: @epoch/identity + the W046 session seam).
  { name: 'session.issue', kind: 'mutate', queueable: false, description: 'Issue a client session from an admitted authentication result' },
  { name: 'session.validate', kind: 'read', queueable: false, description: 'Validate a session reference and return its typed state' },
  { name: 'session.revoke', kind: 'mutate', queueable: false, description: 'Revoke a session' },
  // -- tenant/workspace/project context (authority: @epoch/tenancy).
  { name: 'context.resolve', kind: 'read', queueable: false, description: 'Resolve the tenancy context of a workspace/project node' },
  // -- world (authority: @epoch/world-model; read projections only).
  { name: 'world.snapshot', kind: 'read', queueable: false, description: 'Project the world snapshot and its content digest' },
  { name: 'world.entities', kind: 'read', queueable: false, description: 'Project world entities for a tenant-scoped filter' },
  // -- evidence (authority: @epoch/evidence; bytes via @epoch/object-storage by digest).
  { name: 'evidence.intake', kind: 'mutate', queueable: true, description: 'Intake evidence bytes + record through the digest-addressed object store' },
  { name: 'evidence.get', kind: 'read', queueable: false, description: 'Read an evidence record by digest or artifact' },
  // -- agents/capability discovery (authority: @epoch/capability-discovery).
  { name: 'discovery.run', kind: 'mutate', queueable: false, description: 'Run problem-driven capability/role discovery' },
  // -- actions (authority: the Action Gateway — @epoch/action-gateway).
  { name: 'action.submit', kind: 'mutate', queueable: true, description: 'Submit an action proposal to the Action Gateway' },
  { name: 'action.approve', kind: 'mutate', queueable: true, description: 'Approve a pending action through the Action Gateway approval flow' },
  { name: 'action.execute', kind: 'mutate', queueable: true, description: 'Request execution of an authorized action through the Action Gateway' },
  { name: 'action.status', kind: 'read', queueable: false, description: 'Read the action entry and lifecycle stream' },
  // -- constraints (authority: @epoch/constraint-language).
  { name: 'constraints.evaluate', kind: 'read', queueable: false, description: 'Evaluate a compiled constraint against an evaluation context' },
  // -- verification (authority: @epoch/verification).
  { name: 'verification.validateChain', kind: 'read', queueable: false, description: 'Validate a typed verification chain' },
  // -- solutions (authority: @epoch/solution-delivery).
  { name: 'solution.sealVersion', kind: 'mutate', queueable: false, description: 'Seal a solution version over a solution intent payload' },
  { name: 'solution.approveBaseline', kind: 'mutate', queueable: false, description: 'Approve a sealed solution version as the baseline' },
  // -- program of work / domain schedule / BOQ (authority: @epoch/solution-delivery).
  { name: 'program.build', kind: 'mutate', queueable: false, description: 'Build (seal) a program of work over the approved baseline' },
  { name: 'program.schedule', kind: 'read', queueable: false, description: 'Fold a program of work into the domain schedule/BOQ projections' },
  // -- delivery (authority: @epoch/solution-delivery; field observations via @epoch/execution-tracking).
  { name: 'delivery.open', kind: 'mutate', queueable: false, description: 'Open a delivery record for an approved solution' },
  { name: 'delivery.observe', kind: 'mutate', queueable: true, description: 'Intake a field observation capture (pending projection when offline)' },
  { name: 'delivery.close', kind: 'mutate', queueable: false, description: 'Close a delivery record' },
  // -- acquisition/procurement (authority: @epoch/procurement).
  { name: 'procurement.quote', kind: 'mutate', queueable: false, description: 'Seal + admit a supplier quote for an acquisition package' },
  { name: 'procurement.order', kind: 'mutate', queueable: false, description: 'Seal + admit a purchase order over a selected quote' },
  // -- actualization / forecast / outcome (authority: @epoch/actualization, @epoch/learning-calibration).
  { name: 'actualization.forecast', kind: 'read', queueable: false, description: 'Roll a deterministic forecast over actual-vs-baseline inputs' },
  { name: 'outcome.learn', kind: 'mutate', queueable: false, description: 'Register an outcome record into the learning store' },
  // -- authorized projections (authority: @epoch/access-projection).
  { name: 'access.project', kind: 'read', queueable: false, description: 'Evaluate + select an authorized projection for a principal' },
  // -- supervision / alerts (authority: @epoch/supervision, @epoch/alerts).
  { name: 'supervision.check', kind: 'read', queueable: false, description: 'Run the supervision check set over delivery context' },
  { name: 'alerts.raise', kind: 'mutate', queueable: false, description: 'Raise an alert through the alert authority' },
  // -- marketplace/developer (authority: @epoch/marketplace).
  { name: 'marketplace.entitlement', kind: 'read', queueable: false, description: 'Check an entitlement over grants/revocations' },
  // -- events (authority: @epoch/event-log; READ only — events are APPENDED by domain authorities, never by clients).
  { name: 'events.read', kind: 'read', queueable: false, description: 'Read a sealed event stream' },
  // -- recovery (authority: the offline queue drain path THROUGH the Action Gateway).
  { name: 'recovery.replay', kind: 'mutate', queueable: false, description: 'Drain pending offline projections through the Action Gateway with idempotency keys' },
] as const;

/** The frozen v1 operation vocabulary in list form (the wire type is readonly). */
export type GatewayOperationVocabulary = readonly GatewayOperationName[];

/** Lookup table: operation name -> descriptor. */
export const OPERATION_BY_NAME: Readonly<Record<GatewayOperationName, GatewayOperation>> =
  Object.fromEntries(
    APPLICATION_GATEWAY_OPERATIONS.map((operation) => [operation.name, operation]),
  ) as Readonly<Record<GatewayOperationName, GatewayOperation>>;

/** True when the name is a registered gateway operation. */
export function isGatewayOperationName(name: string): name is GatewayOperationName {
  return Object.prototype.hasOwnProperty.call(OPERATION_BY_NAME, name);
}

/** True when the operation is mutating (idempotency key required). */
export function isMutatingOperation(name: GatewayOperationName): boolean {
  return OPERATION_BY_NAME[name].kind === 'mutate';
}

/**
 * The offline-queue allowlist: the operations whose USER INTENTS may be
 * queued locally as PENDING PROJECTIONS. Every entry is replayed through
 * the Action Gateway path with idempotency keys (negative (e)); no
 * semantic-truth mutation is ever queued locally (negative (b)).
 */
export const QUEUEABLE_OPERATIONS: readonly GatewayOperationName[] =
  APPLICATION_GATEWAY_OPERATIONS.filter((operation) => operation.queueable).map(
    (operation) => operation.name,
  );

/** True when the operation's intent is queueable offline. */
export function isQueueableOperation(name: GatewayOperationName): boolean {
  return OPERATION_BY_NAME[name].queueable;
}

/**
 * The offline-admission rejection vocabulary — the five NAMED NEGATIVES of
 * ACR-005 (AI_CONTINUATION.md: "Local cache/queue = replay/session/
 * projection only"), each carrying a dedicated code so a violation fails a
 * named test:
 *  (a) 'local-approval-not-authority'      — no local approval ever counts as authority;
 *  (b) 'local-semantic-mutation-rejected'  — no local mutation of World/Solution/Delivery/ProgramOfWork truth;
 *  (c) 'local-identity-minting-rejected'   — no local tenant/identity minting;
 *  (d) 'local-digest-forgery-rejected'     — no local digest/verification forgery;
 *  (e) 'idempotency-key-required'          — queue replay must carry idempotency keys or be rejected.
 */
export const OFFLINE_ADMISSION_CODES = [
  'local-approval-not-authority',
  'local-semantic-mutation-rejected',
  'local-identity-minting-rejected',
  'local-digest-forgery-rejected',
  'idempotency-key-required',
] as const;

/** One offline-admission rejection code (the named negatives). */
export type OfflineAdmissionCode = (typeof OFFLINE_ADMISSION_CODES)[number];

/** Lifecycle states of a queued offline intent. */
export const OFFLINE_INTENT_STATES = ['pending', 'draining', 'drained', 'rejected'] as const;

/** One queued-intent lifecycle state. */
export type OfflineIntentState = (typeof OFFLINE_INTENT_STATES)[number];
