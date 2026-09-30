/**
 * @epoch/mobile — the MobileFieldHost (W049): the product engine behind
 * the native field application (the platform host renders this engine).
 *
 * The host is the W049 composition of the W018 typed field surface with
 * the W046 shared product runtime, over the frozen 32-operation
 * Application Gateway vocabulary (the typed client bridge —
 * gateway-client.ts). NOTHING here is a second semantic store:
 *
 *  - the SESSION issues/validates/revokes through `session.*` (the
 *    @epoch/authentication seam) and persists ONLY through the platform
 *    secure store seam (never AsyncStorage/plaintext);
 *  - the CONTEXT/WORLD/PROGRAM surfaces are READ projections
 *    (`context.resolve`, `world.snapshot`, `world.entities`,
 *    `program.schedule`) — the world digest is the cross-device authority
 *    anchor (J08);
 *  - the CAPTURE flow seals W018 capture envelopes (unambiguous linkage,
 *    mandatory uncertainty, digest-only evidence) and submits through
 *    `delivery.observe` (the W038 authority intake) — ONLINE directly,
 *    OFFLINE as a PENDING PROJECTION in the client-runtime queue (the
 *    five W046 named negatives) drained through the Action Gateway path
 *    with idempotency keys (J07 — exactly once);
 *  - the EVIDENCE flow is digest-addressed end-to-end: camera bytes ->
 *    SHA-256 BEFORE upload -> `evidence.intake` (the object-storage seam
 *    recomputes server-side) -> digest-referenced records only;
 *  - the APPROVAL flow submits W003 typed proposals through
 *    `action.submit` and approves through `action.approve` — the mobile
 *    approval surface is a STRICT SUBSET of the frozen gateway vocabulary
 *    (asserted by test; an approval can NEVER bypass the gateway);
 *  - SUPERVISION (J09) reads `action.status` and runs `supervision.check`
 *    over the fixture program/delivery (the W043 authority);
 *  - RECOVERY (J11) maps every failure through the W046 typed error
 *    taxonomy -> recovery actions (re-authenticate / retry-with-backoff /
 *    surface-authority-rejection);
 *  - RELAUNCH (J12) restores the session from the secure store and
 *    validates it (surviving server state) or re-authenticates.
 *
 * Determinism: zero wall-clock, zero randomness — every instant is
 * caller-supplied (the clock seam); correlation ids are the deterministic
 * monotonic sequence.
 */
import {
  clientRecoveryAction,
  gatewayError,
  type ClientRecoveryAction,
  type ClientSession,
  type GatewayError,
  type GatewayOperationName,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/client-runtime';
import type { Timestamp } from '@epoch/agent-protocol';
import { openFieldSession, type SealedFieldSession } from '../session';
import { sealFieldCapture, type SealedFieldCapture } from '../capture';
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import {
  defaultFieldDeviceDescriptor,
  deviceDescriptorDigestOf,
  fixtureAuthenticationResult,
  fixtureDeliveryId,
  fixtureProgram,
  fixtureSolutionId,
  type FieldFixtureRecords,
} from './fixture-gateway';
import { CorrelationSequence, GatewayClient, type MobileClock, type MobileGatewayTransport } from './gateway-client';
import { MemorySecureStore, type SecureStorePort } from './secure-store';
import type { FieldCameraPort } from './camera';
import {
  OfflineController,
  ScriptedNetworkState,
  type IdempotentSyncReport,
  type NetworkStatePort,
} from './offline';
import {
  projectProgram,
  resolveCaptureAnchor,
  toDeliveryObservePayload,
  type CaptureAnchor,
  type ProgramProjections,
} from './capture-pipeline';
import { captureEvidence, type CapturedEvidence } from './evidence-capture';
import { buildFieldDeviceIdentity } from './host-identity';

/** The session persistence record (the ONLY session-shaped client state). */
export interface PersistedSessionRecord {
  readonly schemaVersion: 1;
  readonly kind: 'epoch.field.session';
  readonly session: ClientSession;
  readonly principalId: string;
  readonly tenantId: string;
  readonly nonce: string;
}

/** One typed product error (the W046 error taxonomy + the recovery action). */
export interface MobileProductError {
  readonly error: GatewayError;
  readonly recovery: ClientRecoveryAction;
  /** Where in the product flow the failure surfaced. */
  readonly stage: string;
}

/** The cross-device state projection (the J08 record). */
export interface CrossDeviceState {
  readonly worldDigest: string;
  readonly sessionTenantId: string;
  readonly principalId: string;
  readonly deliveryId: string;
  readonly programContentDigest: string;
  readonly solutionId: string;
}

/** A read projection result: the authority's value or the typed product error. */
export type ProductRead<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: MobileProductError };

/** A mutating result: the recorded outcome or the typed product error. */
export interface ProductEffectOk {
  readonly ok: true;
  readonly result: JsonValue;
  readonly outcomeDigest: Sha256Hex;
  readonly replayed: boolean;
}

export type ProductEffect = ProductEffectOk | { readonly ok: false; readonly failure: MobileProductError };

/** Options of {@link MobileFieldHost}. */
export interface MobileFieldHostOptions {
  /** The typed client bridge transport (bindInProcessGateway in the shipped composition). */
  readonly transport: MobileGatewayTransport;
  readonly clock: MobileClock;
  /** The committed fixture records (the deterministic product state source). */
  readonly records: FieldFixtureRecords;
  /** The platform secure store seam (Memory in tests/harness; the platform module on device). */
  readonly secureStore?: SecureStorePort | undefined;
  /** The field camera seam (Memory in tests/detox; the platform camera on device). */
  readonly camera?: FieldCameraPort | undefined;
  /** The network state seam (scripted in tests; AppState+heartbeat on device). */
  readonly network?: NetworkStatePort | undefined;
  /** The signing-in principal (a fixture principal for the field product). */
  readonly principalId: string;
  /** The deterministic session nonce (caller-supplied entropy for the session id derivation). */
  readonly sessionNonce: string;
  /** Session TTL (default 24h; the J11 expiry path uses short TTLs). */
  readonly sessionTtlMs?: number | undefined;
  /** The field device descriptor (default: the deterministic phone-class FIELD descriptor). */
  readonly device?: DeviceDescriptor | undefined;
  /** The correlation sequence prefix (default 'mobile'). */
  readonly correlationPrefix?: string | undefined;
}

/** One capture input (what the field worker observed). */
export interface CaptureObservationInput {
  /** The capture anchor (work package / activity / milestone) — ambiguity is rejected. */
  readonly anchor: CaptureAnchor;
  /** The quantity/progress measure (W036 grammar). */
  readonly measure: unknown;
  /** The MANDATORY uncertainty state (W036 grammar). */
  readonly uncertainty: unknown;
  /** Optional note on the capture context. */
  readonly note?: string | undefined;
  /** The observed instant (caller-supplied; zero wall-clock). */
  readonly observedAt: string;
  /** The capture id slug (deterministic, caller-supplied). */
  readonly captureId: string;
  /** Evidence photos captured first (digest-addressed). */
  readonly evidence?: readonly { readonly note?: string | undefined }[] | undefined;
}

/** The capture outcome (online submission or offline admission). */
export type CaptureObservationResult =
  | {
      readonly ok: true;
      readonly mode: 'online' | 'offline-queued';
      readonly capture: SealedFieldCapture;
      readonly evidence: readonly CapturedEvidence[];
      readonly outcomeDigest?: string | undefined;
      readonly replayed?: boolean | undefined;
    }
  | {
      readonly ok: false;
      readonly mode: 'online' | 'offline-queued';
      readonly failure: MobileProductError;
      readonly capture?: SealedFieldCapture | undefined;
      readonly evidence?: readonly CapturedEvidence[] | undefined;
    };

/**
 * The field product host. One instance per app process; the J12 relaunch
 * constructs a fresh instance over the SAME authorities (the server state
 * survives) with the SAME secure store (the session survives).
 */
export class MobileFieldHost {
  private readonly client: GatewayClient;
  private readonly clock: MobileClock;
  private readonly records: FieldFixtureRecords;
  private readonly secureStore: SecureStorePort;
  private readonly camera: FieldCameraPort;
  private readonly network: NetworkStatePort;
  private readonly principalId: string;
  private readonly sessionNonce: string;
  private readonly sessionTtlMs: number;
  private readonly device: DeviceDescriptor;
  private readonly deviceDigest: string;
  private readonly correlation: CorrelationSequence;
  private readonly correlationPrefix: string;

  private session: ClientSession | null = null;
  private fieldSession: SealedFieldSession | null = null;
  private offlineController: OfflineController | null = null;
  private queueIdCounter = 0;

  constructor(options: MobileFieldHostOptions) {
    this.correlationPrefix = options.correlationPrefix ?? 'mobile';
    this.client = new GatewayClient({
      transport: options.transport,
      clock: options.clock,
      tenant: { tenantId: options.records.tenantId },
    });
    this.clock = options.clock;
    this.records = options.records;
    this.secureStore = options.secureStore ?? new MemorySecureStore();
    this.camera = options.camera ?? createNoCamera();
    this.network = options.network ?? new ScriptedNetworkState();
    this.principalId = options.principalId;
    this.sessionNonce = options.sessionNonce;
    this.sessionTtlMs = options.sessionTtlMs ?? 86_400_000;
    this.device = options.device ?? defaultFieldDeviceDescriptor();
    this.deviceDigest = deviceDescriptorDigestOf(this.device);
    this.correlation = new CorrelationSequence(this.correlationPrefix);
  }

  // -------------------------------------------------------------------------
  // J01 — onboarding / session bootstrap.
  // -------------------------------------------------------------------------

  /** True when a session has been issued/restored. */
  get hasSession(): boolean {
    return this.session !== null;
  }

  /** The active client session (read-only projection). */
  get currentSession(): ClientSession | null {
    return this.session;
  }

  /** The active field session (the W018 capture session). */
  get currentFieldSession(): SealedFieldSession | null {
    return this.fieldSession;
  }

  /** The network seam (scripted/harness/device binding). */
  get networkState(): NetworkStatePort {
    return this.network;
  }

  /**
   * J01: sign in — issue the session through the gateway (the fixture
   * VERIFIED authentication result is the bootstrap input), persist it in
   * the secure store, open the W018 field session, and bind the offline
   * queue to the session scope.
   */
  async signIn(): Promise<{ ok: true; session: ClientSession } | { ok: false; failure: MobileProductError }> {
    const auth = fixtureAuthenticationResult(this.records, this.principalId);
    if (auth === undefined) {
      throw new TypeError(`no VERIFIED fixture authentication result for principal "${this.principalId}"`);
    }
    const issued = await this.client.callForResult({
      operation: 'session.issue',
      sessionId: 'session:bootstrap',
      payload: {
        authentication: auth.authentication,
        principalId: this.principalId,
        tenantId: this.records.tenantId,
        ttlMs: this.sessionTtlMs,
        nonce: this.sessionNonce,
      } as unknown as JsonValue,
    });
    if (!issued.ok) {
      return { ok: false, failure: { error: issued.error, recovery: issued.recovery, stage: 'session.issue' } };
    }
    const session = issued.result as unknown as ClientSession;
    await this.adoptSession(session);
    return { ok: true, session };
  }

  /**
   * J12 relaunch: restore the session from the secure store, VALIDATE it
   * against the gateway (surviving server state), and only re-authenticate
   * when the validation says so (J11 session-expiry/unknown).
   */
  async restoreOrSignIn(): Promise<
    { ok: true; session: ClientSession; restored: boolean } | { ok: false; failure: MobileProductError }
  > {
    const persisted = await this.secureStore.getItem('epoch.field.session');
    if (persisted !== undefined) {
      const parsed = parsePersistedSession(persisted);
      if (parsed !== undefined && parsed.principalId === this.principalId) {
        const validated = await this.client.callForResult({
          operation: 'session.validate',
          sessionId: parsed.session.sessionId,
          payload: {},
        });
        if (validated.ok) {
          const session = validated.result as unknown as ClientSession;
          if (session.state === 'active') {
            await this.adoptSession(session);
            return { ok: true, session, restored: true };
          }
        }
      }
    }
    const signed = await this.signIn();
    if (signed.ok) return { ok: true, session: signed.session, restored: false };
    return { ok: false, failure: signed.failure };
  }

  /** Revoke the session (sign-out) through the gateway. */
  async signOut(): Promise<void> {
    if (this.session === null) return;
    await this.client.callForResult({
      operation: 'session.revoke',
      sessionId: this.session.sessionId,
      payload: {},
    });
    await this.secureStore.deleteItem('epoch.field.session');
    this.session = null;
    this.fieldSession = null;
    this.offlineController = null;
  }

  /** Adopt a validated session: persist it, open the field session, bind the queue. */
  private async adoptSession(session: ClientSession): Promise<void> {
    this.session = session;
    // Persist ONLY through the secure store (never plaintext files/AsyncStorage).
    const record: PersistedSessionRecord = {
      schemaVersion: 1,
      kind: 'epoch.field.session',
      session,
      principalId: this.principalId,
      tenantId: this.records.tenantId,
      nonce: this.sessionNonce,
    };
    await this.secureStore.setItem('epoch.field.session', JSON.stringify(record));
    // The W018 field session (the capture channel identity).
    const identity = buildFieldDeviceIdentity(this.correlationPrefix);
    const opened = openFieldSession({
      sessionId: identity.sessionId,
      tenantId: this.records.tenantId,
      device: this.device,
      solutionId: this.solutionId,
      deliveryId: this.deliveryId,
      openedBy: this.principalId,
      openedAt: this.clock(),
    });
    if (!opened.ok) {
      throw new TypeError(`the field session failed W018 admission: ${opened.error.message}`);
    }
    this.fieldSession = opened.value;
    // The offline queue bound to the session scope.
    this.offlineController = new OfflineController({
      scope: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        principalId: this.principalId,
        tenantId: this.records.tenantId,
      },
      client: this.client,
      network: this.network,
    });
  }

  // -------------------------------------------------------------------------
  // J02 — the understand/inspect field surface.
  // -------------------------------------------------------------------------

  /** Resolve the project context node (context.resolve). */
  async resolveContext(nodeId: string): Promise<ProductRead<JsonValue>> {
    return this.read('context.resolve', { nodeId });
  }

  /** The world snapshot digest (the cross-device authority anchor). */
  async worldSnapshot(): Promise<ProductRead<{ digest: string; snapshot: JsonValue }>> {
    const result = await this.read('world.snapshot', {});
    if (!result.ok) return result;
    const record = result.value as { digest?: string; snapshot?: JsonValue };
    return { ok: true, value: { digest: record.digest ?? '', snapshot: record.snapshot ?? null } };
  }

  /** The world entities projection (the field inspect surface). */
  async worldEntities(): Promise<ProductRead<JsonValue>> {
    return this.read('world.entities', {});
  }

  /** The program schedule folds (the J02 quantity/cost/milestone projections). */
  async programSchedule(): Promise<ProductRead<JsonValue>> {
    return this.read('program.schedule', { program: fixtureProgram(this.records) });
  }

  /** The program projections (work packages / activities / milestones). */
  programProjections(): ProgramProjections {
    return projectProgram(this.records.program);
  }

  /** The fixture anchors (ids the field surface navigates). */
  get deliveryId(): string {
    return fixtureDeliveryId(this.records);
  }

  get solutionId(): string {
    return fixtureSolutionId(this.records);
  }

  get tenantId(): string {
    return this.records.tenantId;
  }

  // -------------------------------------------------------------------------
  // J06 — field capture (observation + evidence).
  // -------------------------------------------------------------------------

  /**
   * Capture one field observation: resolve the anchor (client-side
   * ambiguity gate), capture the evidence photos (digest-addressed), seal
   * the W018 envelope, then submit ONLINE (`delivery.observe` with the
   * idempotency key) or queue OFFLINE (the pending projection).
   */
  async captureObservation(input: CaptureObservationInput): Promise<CaptureObservationResult> {
    if (this.session === null || this.fieldSession === null) {
      throw new TypeError('captureObservation requires a signed-in host (signIn first)');
    }
    const mode: 'online' | 'offline-queued' = this.network.isOnline() ? 'online' : 'offline-queued';
    // 1. Resolve the anchor — ambiguity is a typed rejection BEFORE anything.
    const projections = this.programProjections();
    const resolved = resolveCaptureAnchor(projections, input.anchor);
    if (!resolved.ok) {
      return {
        ok: false,
        mode,
        failure: {
          error: gatewayError({
            class: 'validation',
            code: 'request-validation',
            message: resolved.error.message,
            operation: 'delivery.observe',
            correlationId: 'corr:unattributed',
            details: { issues: [{ path: 'anchor', message: resolved.error.message }] },
          }),
          recovery: 'surface-input',
          stage: 'anchor-resolution',
        },
      };
    }
    // 2. Evidence capture (digest-addressed; optional).
    const evidence: CapturedEvidence[] = [];
    for (const photoRequest of input.evidence ?? []) {
      const captured = await captureEvidence(this.camera, this.client, {
        sessionId: this.session.sessionId,
        tenantId: this.records.tenantId,
        capturedAt: input.observedAt,
        capturedBy: this.principalId,
        ...(photoRequest.note !== undefined ? { note: photoRequest.note } : {}),
      });
      if (!captured.ok) {
        return {
          ok: false,
          mode,
          failure: { error: captured.error, recovery: clientRecoveryAction(captured.error), stage: `evidence-${captured.stage}` },
        };
      }
      evidence.push(captured.evidence);
    }
    // 3. Seal the W018 capture envelope (unambiguous link, mandatory uncertainty).
    const captureId = input.captureId.startsWith('field-capture:')
      ? input.captureId
      : `field-capture:${input.captureId}`;
    const sealed = sealFieldCapture({
      captureId,
      tenantId: this.records.tenantId,
      sessionId: this.fieldSession.sessionId,
      solutionId: this.solutionId,
      deliveryId: this.deliveryId,
      observationId: `observation:${input.captureId.replace(/^field-capture:/, '')}`,
      capturedBy: this.principalId,
      capturedAt: input.observedAt,
      measure: input.measure,
      uncertainty: input.uncertainty,
      evidence: evidence.map((entry) => entry.ref),
      link: { status: 'resolved', workPackageId: resolved.value.workPackageId },
      context: {
        deviceDescriptorDigest: this.deviceDigest,
        offline: mode === 'offline-queued',
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    if (!sealed.ok) {
      return {
        ok: false,
        mode,
        failure: {
          error: gatewayError({
            class: 'validation',
            code: 'request-validation',
            message: sealed.error.message,
            operation: 'delivery.observe',
            correlationId: 'corr:unattributed',
          }),
          recovery: 'surface-input',
          stage: 'capture-sealing',
        },
      };
    }
    // 4. The W038 authority payload.
    const payload = toDeliveryObservePayload({
      capture: sealed.value,
      solutionId: this.solutionId,
      program: this.records.program,
      evidence,
    });
    if (!payload.ok) {
      return {
        ok: false,
        mode,
        failure: {
          error: gatewayError({
            class: 'validation',
            code: 'request-validation',
            message: payload.error.message,
            operation: 'delivery.observe',
            correlationId: 'corr:unattributed',
          }),
          recovery: 'surface-input',
          stage: 'payload-conversion',
        },
      };
    }
    // 5. Submit or queue.
    const idempotencyKey = this.client.idempotencyKeyFor('delivery.observe', payload.value);
    if (mode === 'online') {
      const submitted = await this.client.callForResult({
        operation: 'delivery.observe',
        sessionId: this.session.sessionId,
        payload: payload.value,
        idempotencyKey,
      });
      if (!submitted.ok) {
        return {
          ok: false,
          mode,
          capture: sealed.value,
          evidence,
          failure: { error: submitted.error, recovery: submitted.recovery, stage: 'delivery.observe' },
        };
      }
      return {
        ok: true,
        mode,
        capture: sealed.value,
        evidence,
        outcomeDigest: submitted.outcomeDigest,
        replayed: submitted.replayed,
      };
    }
    // Offline: admit the PENDING PROJECTION (the W046 queue admission negatives).
    this.queueIdCounter += 1;
    const queueId = `queue:mobile-${this.queueIdCounter}`;
    const admission = this.offlineController!.admitIntent({
      queueId,
      idempotencyKey,
      operation: 'delivery.observe',
      payload: payload.value,
      correlation: {
        schemaVersion: 1,
        correlationId: this.correlation.next(),
        origin: 'mobile',
        issuedAt: this.clock(),
      },
      enqueuedAt: this.clock(),
    });
    if (!admission.ok) {
      return {
        ok: false,
        mode,
        capture: sealed.value,
        evidence,
        failure: {
          error: gatewayError({
            class: 'authority-rejected',
            code: 'authority-denied',
            message: admission.rejection.message,
            operation: 'delivery.observe',
            correlationId: 'corr:unattributed',
            details: { admissionCode: admission.rejection.code },
          }),
          recovery: 'surface-authority-rejection',
          stage: 'offline-admission',
        },
      };
    }
    return {
      ok: true,
      mode: 'offline-queued',
      capture: sealed.value,
      evidence,
    };
  }

  // -------------------------------------------------------------------------
  // J07 — offline queue / reconnect / idempotent sync.
  // -------------------------------------------------------------------------

  /** Enter the offline interval (scripted / device network loss). */
  goOffline(): void {
    this.network.setOnline(false);
  }

  /** True while offline. */
  get offline(): boolean {
    return !this.network.isOnline();
  }

  /** The queue snapshot (pending projections, deterministic order). */
  queueSnapshot() {
    return this.offlineController?.pendingIntents() ?? [];
  }

  /** The offline controller (the queue/reconnect/sync engine — public read for the harness/journey proofs). */
  get offlineSync(): OfflineController | null {
    return this.offlineController;
  }

  /** The typed gateway client bridge (public read for the harness/journey proofs). */
  get gatewayClient(): GatewayClient {
    return this.client;
  }

  /** The reconnect + idempotent sync (the J07 assertion surface). */
  async syncNow(at: string): Promise<IdempotentSyncReport> {
    if (this.offlineController === null) {
      throw new TypeError('syncNow requires a signed-in host');
    }
    return this.offlineController.syncNow({ at });
  }

  // -------------------------------------------------------------------------
  // J04 — the approval surface (a strict subset of the gateway vocabulary).
  // -------------------------------------------------------------------------

  /** The mobile approval vocabulary: EVERY operation the approval surface may call. */
  static readonly APPROVAL_OPERATIONS: readonly GatewayOperationName[] = [
    'action.submit',
    'action.approve',
    'action.status',
  ];

  /** Submit an action proposal through the gateway (the ONLY approval route). */
  async submitAction(payload: JsonValue): Promise<ProductEffect> {
    return this.mutate('action.submit', payload);
  }

  /** Approve a pending action through the gateway approval flow. */
  async approveAction(input: {
    readonly actionId: string;
    readonly decidedById: string;
    readonly decidedByRole: string;
    readonly asRole: string;
    readonly note?: string | undefined;
    readonly at: string;
  }): Promise<ProductEffect> {
    const payload: JsonValue = {
      actionId: input.actionId,
      decidedBy: { id: input.decidedById, role: input.decidedByRole },
      asRole: input.asRole,
      ...(input.note !== undefined ? { note: input.note } : {}),
      at: input.at,
    } as unknown as JsonValue;
    return this.mutate('action.approve', payload);
  }

  /** Read the action list / one action (the supervision surface feeds on this). */
  async actionStatus(actionId?: string): Promise<ProductRead<JsonValue>> {
    return this.read('action.status', actionId !== undefined ? { actionId } : {});
  }

  // -------------------------------------------------------------------------
  // J08 — cross-device state.
  // -------------------------------------------------------------------------

  /** The cross-device state projection (the J08 comparison record). */
  async crossDeviceState(): Promise<ProductRead<CrossDeviceState>> {
    const world = await this.worldSnapshot();
    if (!world.ok) return world;
    return {
      ok: true,
      value: {
        worldDigest: world.value.digest,
        sessionTenantId: this.records.tenantId,
        principalId: this.principalId,
        deliveryId: this.deliveryId,
        programContentDigest: (this.records.program['contentDigest'] as string) ?? '',
        solutionId: this.solutionId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // J09 — supervision surface.
  // -------------------------------------------------------------------------

  /** Run one supervision pass over the fixture program/delivery (supervision.check). */
  async supervisionCheck(input: {
    readonly passId: string;
    readonly evaluatedAt: string;
    readonly thresholds: JsonValue;
  }): Promise<ProductRead<JsonValue>> {
    const payload: JsonValue = {
      input: {
        passId: input.passId,
        tenantId: this.records.tenantId,
        evaluatedAt: input.evaluatedAt,
        evaluatedBy: this.principalId,
        program: this.records.program,
        delivery: this.records.delivery,
        thresholds: input.thresholds,
        executionIssues: [],
        leadTimeInputs: [],
        infoRequests: [],
      },
    } as unknown as JsonValue;
    return this.read('supervision.check', payload);
  }

  // -------------------------------------------------------------------------
  // J11 — recovery surface.
  // -------------------------------------------------------------------------

  /** Re-authenticate after a session failure (re-issue + re-persist). */
  async reauthenticate(): Promise<{ ok: true; session: ClientSession } | { ok: false; failure: MobileProductError }> {
    await this.secureStore.deleteItem('epoch.field.session');
    this.session = null;
    this.fieldSession = null;
    this.offlineController = null;
    return this.signIn();
  }

  // -------------------------------------------------------------------------
  // The typed call helpers (every call through the frozen vocabulary).
  // -------------------------------------------------------------------------

  private async read(
    operation: GatewayOperationName,
    payload: JsonValue,
  ): Promise<ProductRead<JsonValue>> {
    const sessionId = this.requireSession(operation);
    const result = await this.client.callForResult({ operation, sessionId, payload });
    if (!result.ok) {
      return { ok: false, failure: { error: result.error, recovery: result.recovery, stage: operation } };
    }
    return { ok: true, value: result.result };
  }

  private async mutate(
    operation: GatewayOperationName,
    payload: JsonValue,
  ): Promise<ProductEffect> {
    const sessionId = this.requireSession(operation);
    const result = await this.client.callForResult({ operation, sessionId, payload });
    if (!result.ok) {
      return { ok: false, failure: { error: result.error, recovery: result.recovery, stage: operation } };
    }
    return {
      ok: true,
      result: result.result,
      outcomeDigest: result.outcomeDigest,
      replayed: result.replayed,
    };
  }

  private requireSession(operation: GatewayOperationName): string {
    const sessionId = this.session?.sessionId;
    if (sessionId === undefined) {
      throw new TypeError(`operation "${operation}" requires a signed-in host`);
    }
    return sessionId;
  }
}

/** Parse a persisted session record (total; undefined when malformed). */
export function parsePersistedSession(value: string): PersistedSessionRecord | undefined {
  try {
    const parsed = JSON.parse(value) as PersistedSessionRecord;
    if (parsed?.kind === 'epoch.field.session' && parsed?.session?.sessionId !== undefined) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** The no-camera binding (used when a host is constructed without a camera — typed failures on capture). */
function createNoCamera(): FieldCameraPort {
  return {
    async capturePhoto(): Promise<never> {
      throw new TypeError('no camera bound: construct the host with a camera port to capture evidence');
    },
  };
}

export type { Timestamp, SealedFieldCapture };
