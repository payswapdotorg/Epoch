/**
 * @epoch/desktop — the product composition root (W048).
 *
 * The DesktopProduct is the visible product logic: the typed commands
 * the React UI renders AND the journey runner drives — one code path.
 * Every semantic value arrives through the IPC bridge (a frozen
 * Application Gateway envelope); the product computes NO semantic state
 * locally (no second store). Around it, the product owns the platform
 * facilities the work order requires:
 *
 *  - the platform-safe session store (secure seam; pin 5);
 *  - the durable offline queue (pending projections; pin 4b);
 *  - the read-only projection cache (J08 handoff);
 *  - the protocol gate (update/record compatibility; pin 4c);
 *  - the W017 shell embedding: a shell session per authentication, the
 *    main window, and content-addressed session snapshots through the
 *    W017 offline/session cache (the "offline/session cache
 *    integration" the Work Order requires);
 *  - the network state (go offline / go online) driving the J07 flows.
 */
import {
  clientRecoveryAction,
  gatewayError,
  type ClientSession,
  type ClientTimestamp,
  type GatewayError,
  type GatewayOutcome,
  type JsonValue,
  type OfflineQueueScope,
} from '@epoch/client-runtime';
import { createDesktopShell, type DesktopShell } from '../../shell';
import { createReferenceHost, type ReferenceHost } from '../../host';
import { KIND_COMPLETE_RENDERER } from '../../device';
import type { HostShellEnvelope } from '../../envelopes';
import { TenancyHierarchy } from '@epoch/tenancy';
import type { HostCommandPort, HostAppMeta } from '../ipc/host';
import { DesktopIpcBridge, type BridgeCallRequest } from '../ipc/bridge';
import type { GatewayTransport } from '../ipc/transport';
import { DesktopOfflineQueue } from './offline-queue';
import { DesktopProjectionCache } from './projection-cache';
import { DesktopSessionStore } from './session-store';
import { checkUpdateCandidate } from './protocol-gate';
import type {
  ActionApprovalViewModel,
  DiscoveryViewModel,
  HandoffViewModel,
  OfflineQueueViewModel,
  ProgramOfWorkViewModel,
  ProjectEntryViewModel,
  RealizeViewModel,
  RecoveryEvent,
  RecoveryViewModel,
  RelaunchViewModel,
  SessionBarViewModel,
  SupervisionViewModel,
  UnderstandViewModel,
} from './view-models';
import type { DesktopGatewayMode } from '../version';

/** The product construction options. */
export interface DesktopProductOptions {
  readonly host: HostCommandPort;
  readonly transport: GatewayTransport;
  readonly clock: () => ClientTimestamp;
  /** The tenancy hierarchy the W017 shell resolves session scopes against. */
  readonly tenancy: TenancyHierarchy;
  /** The gateway binding mode (badge in the session bar). */
  readonly gatewayMode: DesktopGatewayMode;
}

/** The authentication input (a VERIFIED W009 result + scope + lifetime). */
export interface AuthenticateInput {
  readonly authentication: {
    readonly resultId: string;
    readonly resultDigest: string;
    readonly principalId: string;
    readonly outcome: 'verified' | 'failed';
  };
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly ttlMs?: number;
  readonly nonce?: string;
}

/** One typed product call outcome (view models never throw). */
export type ProductResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GatewayError; readonly recoveryAction: string };

/** The discovery run input (J03): the task heading + world references. */
export interface DiscoveryRunInput {
  /** The task summary (the discovery authority's TaskDescription.summary). */
  readonly summary: string;
  /** The universal lifecycle stage heading the discovery. */
  readonly lifecycleStage?: 'understand' | 'decide' | 'plan' | 'acquire' | 'realize' | 'observe' | 'actualize' | 'verify' | 'forecast' | 'close' | 'learn';
  /** Domain reference slugs (domain-pack template matching). */
  readonly domainRefs?: readonly string[];
  /** Task objectives. */
  readonly objectives?: readonly string[];
  /** World references (refId + content digest, the world snapshot anchors). */
  readonly worldRefs?: readonly { refId: string; contentDigest: string }[];
}

/** The action-approval cycle input (J04). */
export interface ActionCycleInput {
  readonly actionId: string;
  readonly proposal: unknown;
  readonly decidedBy: string;
  readonly asRole: string;
  readonly constraint?: { readonly compiledConstraint: unknown; readonly context: unknown } | undefined;
  readonly verificationChain?: unknown;
  /** The compiled policy set gating the action (reference data the harness supplies). */
  readonly policies?: readonly unknown[] | undefined;
  /** The constraint evaluation context for the policy set. */
  readonly evaluationContext?: unknown;
  /** The approval window (deadline + delegation depth). */
  readonly approval?: { readonly deadline: string; readonly maxDelegationDepth: number } | undefined;
}

/** The program workflow input (J05). */
export interface ProgramWorkflowInput {
  readonly solutionContent: unknown;
  readonly approvedBy: string;
  readonly program: unknown;
  readonly quote?: {
    readonly content: unknown;
    readonly packages: unknown;
    readonly store: unknown;
  } | undefined;
}

/** The delivery realization input (J06). */
export interface RealizeDeliveryInput {
  readonly deliveryContent: unknown;
  readonly observations: readonly {
    readonly solutionId: string;
    readonly capture: unknown;
    readonly program?: unknown;
  }[];
  readonly forecastInput: unknown;
  readonly verificationChain?: unknown;
  readonly closing: unknown;
}

/** The supervision input (J09). */
export interface SupervisionInput {
  readonly checkInput: unknown;
  readonly alert?: {
    readonly chain: readonly unknown[];
    readonly options: unknown;
  } | undefined;
}

/** The offline intent input (J07). */
export interface OfflineIntentRequest {
  readonly queueId: string;
  readonly operation: string;
  readonly idempotencyKey: string;
  readonly payload: unknown;
}

/**
 * The desktop product: the composition root every screen and journey
 * drives. Construct per product session (boot / relaunch).
 */
export class DesktopProduct {
  readonly host: HostCommandPort;
  readonly bridge: DesktopIpcBridge;
  private readonly clock: () => ClientTimestamp;
  private readonly sessionStore: DesktopSessionStore;
  private readonly projectionCache: DesktopProjectionCache;
  private offlineQueue: DesktopOfflineQueue | null = null;
  private shell: DesktopShell | null = null;
  private shellHost: ReferenceHost | null = null;
  private shellTime = 0;
  private session: ClientSession | null = null;
  private networkOnline = true;
  private draining = false;
  private readonly gatewayMode: DesktopGatewayMode;
  private readonly recoveryEvents: RecoveryEvent[] = [];
  private readonly drainedRecords: { queueId: string; outcomeDigest: string; replayed: boolean }[] = [];
  private lastDrainAt: string | null = null;
  private tenancy: TenancyHierarchy;

  constructor(options: DesktopProductOptions) {
    this.host = options.host;
    this.clock = options.clock;
    this.gatewayMode = options.gatewayMode;
    this.tenancy = options.tenancy;
    this.sessionStore = new DesktopSessionStore(options.host);
    this.projectionCache = new DesktopProjectionCache({ host: options.host });
    this.bridge = new DesktopIpcBridge({
      transport: options.transport,
      clock: options.clock,
      networkGate: (request) => this.networkDecision(request),
    });
  }

  // -------------------------------------------------------------------------
  // Session lifecycle (J01 bootstrap / J11 re-auth / J12 restore).
  // -------------------------------------------------------------------------

  /** The current session bar view-model. */
  sessionBar(): SessionBarViewModel {
    return {
      state: this.session === null ? 'unauthenticated' : 'active',
      principalId: this.session?.principalId ?? null,
      tenantId: this.session?.tenantId ?? null,
      sessionId: this.session?.sessionId ?? null,
      gatewayMode: this.gatewayMode,
      protocol: { gatewayContract: '1.0.0', hostProtocol: '1.0.0' },
    };
  }

  /** Authenticate: session.issue through the bridge, then bind everything. */
  async authenticate(input: AuthenticateInput): Promise<ProductResult<ClientSession>> {
    const result = await this.bridgeCall({
      operation: 'session.issue',
      payload: {
        authentication: input.authentication,
        principalId: input.principalId,
        tenantId: input.tenantId,
        ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ttlMs: input.ttlMs ?? 86_400_000,
        nonce: input.nonce ?? `nonce:desktop-${this.clock()}`,
      },
      idempotencyKey: `idem:desktop-session-${(input.nonce ?? 'boot').replace(/[^a-z0-9]+/gi, '-')}`,
    });
    if (!result.ok) {
      this.recoveryEvents.push({
        at: this.clock(),
        kind: 'session-expired',
        detail: `session issuance failed: ${result.error.message}`,
      });
      return result;
    }
    const session = result.value.result as unknown as ClientSession;
    await this.bindSession(session);
    return { ok: true, value: session };
  }

  /** Bind an issued/restored session: bridge context + queue + shell. */
  private async bindSession(session: ClientSession): Promise<void> {
    this.session = session;
    const context = DesktopSessionStore.bridgeContextOf(session);
    const scope: OfflineQueueScope = {
      schemaVersion: 1,
      sessionId: session.sessionId,
      principalId: session.principalId,
      tenantId: session.tenantId,
      ...(session.workspaceId !== undefined ? { workspaceId: session.workspaceId } : {}),
    };
    this.offlineQueue = new DesktopOfflineQueue({ host: this.host, scope });
    this.bridge.setContext({
      session: context.session,
      tenant: context.tenant,
      queueSink: async (envelope) => {
        const admitted = await this.offlineQueue!.admit({
          queueId: `queue:${envelope.correlation.correlationId.replace('corr:', '')}`,
          correlation: envelope.correlation,
          idempotencyKey: envelope.idempotencyKey ?? 'idem:unkeyed',
          operation: envelope.operation,
          payload: envelope.payload,
          enqueuedAt: this.clock(),
        });
        if (!admitted.ok) {
          throw new Error(`offline admission rejected: ${admitted.rejection.code}`);
        }
        return { queueId: admitted.intent.queueId };
      },
    });
    // The W017 embedding: the product plays the native-wrapper HOST side
    // (the reference host) and the shell consumes its envelopes — windows,
    // snapshots, the content-addressed session cache (the offline/session
    // cache integration the Work Order requires).
    // The W017 scope grammar is containment-strict: a project-scoped session
    // MUST carry its workspace. Gateway sessions may carry only the project;
    // the workspace resolves through the REAL tenancy authority (never a
    // second semantic store — the hierarchy restored from the same fixture).
    const shellScope: { tenantId: string; workspaceId?: string; projectId?: string } = {
      tenantId: session.tenantId,
      ...(session.workspaceId !== undefined ? { workspaceId: session.workspaceId } : {}),
      ...(session.projectId !== undefined ? { projectId: session.projectId } : {}),
    };
    if (session.projectId !== undefined && session.workspaceId === undefined) {
      const path = this.tenancy.pathToRoot(session.projectId);
      if (path.ok) {
        const workspace = path.value.find((node) => node.node.kind === 'workspace');
        if (workspace !== undefined) {
          shellScope.workspaceId = workspace.node.nodeId;
        }
      }
    }
    this.shellHost = createReferenceHost({
      // The W017 shell session grammar is `dss:<slug>` (its own IPC seam);
      // the gateway session id maps in deterministically.
      sessionId: `dss-${session.sessionId.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      scope: shellScope,
      principal: session.principalId,
    });
    this.shell = createDesktopShell({ tenancy: this.tenancy });
    // The W017 session-open payload carries the tenancy scope (the W017
    // envelope grammar), not the gateway session descriptor.
    this.shellSend({
      kind: 'session-open',
      payload: { scope: shellScope, principal: session.principalId },
    });
    this.shellSend({
      kind: 'window-open',
      payload: { windowId: 'win-main', title: 'Epoch — Project', renderer: KIND_COMPLETE_RENDERER },
    });
    await this.sessionStore.persist(session);
  }

  /** Send one host envelope into the shell (the W017 IPC seam). */
  private shellSend(body: HostShellEnvelope['body']): void {
    if (this.shellHost === null || this.shell === null) return;
    this.shellTime += 1;
    const sent = this.shellHost.send(body, this.shellTime);
    if (!sent.ok) return;
    this.shell.applyHostEnvelope(sent.value.envelope);
  }

  /** Restore a persisted session on relaunch (J12; refuses incompatible records). */
  async restoreSession(): Promise<boolean> {
    const restored = await this.sessionStore.restore();
    if ('absent' in restored) return false;
    if (!restored.ok) {
      this.recoveryEvents.push({
        at: this.clock(),
        kind: 'session-expired',
        detail: `the persisted session was refused (${restored.refusal.reason}); re-authentication required`,
      });
      return false;
    }
    await this.bindSession(restored.record);
    return true;
  }

  /** Sign out: revoke + clear the secure store. */
  async signOut(): Promise<void> {
    if (this.session !== null) {
      await this.bridgeCall({ operation: 'session.revoke', payload: {} });
    }
    await this.sessionStore.clear();
    this.session = null;
    this.offlineQueue = null;
    this.bridge.setContext({ session: null, tenant: null });
  }

  // -------------------------------------------------------------------------
  // J01 — project entry.
  // -------------------------------------------------------------------------

  /** Enter the project: resolve the tenancy context + the world snapshot. */
  async enterProject(nodeId: string): Promise<ProductResult<ProjectEntryViewModel>> {
    const context = await this.bridgeCall({ operation: 'context.resolve', payload: { nodeId } });
    if (!context.ok) return context;
    const node = (context.value.result as { node?: Record<string, unknown> }).node ?? {};
    const world = await this.bridgeCall({ operation: 'world.snapshot', payload: {} });
    const snapshot = world.ok ? (world.value.result as { digest?: string; statistics?: { entityCount?: number; relationCount?: number } }) : null;
    return {
      ok: true,
      value: {
        nodeId: String(node['nodeId'] ?? nodeId),
        nodeKind: String(node['kind'] ?? 'unknown'),
        parentId: node['parentId'] !== undefined ? String(node['parentId']) : null,
        worldDigest: snapshot?.digest ?? null,
        entityCount: snapshot?.statistics?.entityCount ?? null,
        relationCount: snapshot?.statistics?.relationCount ?? null,
        outcome: world.ok ? world.value : null,
      },
    };
  }

  // -------------------------------------------------------------------------
  // J02 — understand/reconstruct + evidence intake.
  // -------------------------------------------------------------------------

  /** Inspect the world entities + the fixture evidence; note the unknowns. */
  async inspectWorld(options: { readonly evidenceDigest?: string | undefined } = {}): Promise<ProductResult<UnderstandViewModel>> {
    const entitiesResult = await this.bridgeCall({ operation: 'world.entities', payload: {} });
    if (!entitiesResult.ok) return entitiesResult;
    const rawEntities = Array.isArray(entitiesResult.value.result)
      ? (entitiesResult.value.result as Record<string, unknown>[])
      : [];
    const entities = rawEntities.map((entity) => ({
      entityId: String(entity['entityId'] ?? entity['id'] ?? ''),
      entityType: String(entity['entityType'] ?? entity['type'] ?? ''),
      title: String(
        (entity['properties'] as Record<string, unknown> | undefined)?.['title'] ??
          (entity['properties'] as Record<string, unknown> | undefined)?.['name'] ??
          entity['entityId'] ??
          '',
      ),
    }));
    const world = await this.bridgeCall({ operation: 'world.snapshot', payload: {} });
    const worldDigest = world.ok ? ((world.value.result as { digest?: string }).digest ?? null) : null;
    let evidenceRecord: JsonValue | null = null;
    if (options.evidenceDigest !== undefined) {
      const evidence = await this.bridgeCall({ operation: 'evidence.get', payload: { digest: options.evidenceDigest } });
      if (evidence.ok) evidenceRecord = evidence.value.result;
    }
    return {
      ok: true,
      value: {
        entities,
        worldDigest,
        evidenceDigest: options.evidenceDigest ?? null,
        evidenceRecord,
        intakeDigest: null,
        unknowns: entities
          .filter((entity) => entity.title === '')
          .map((entity) => ({ entityId: entity.entityId, note: 'no title property (known-unknown)' })),
      },
    };
  }

  /** Intake evidence bytes (acquire high-value missing information). */
  async intakeEvidence(input: {
    readonly bytes: Uint8Array;
    readonly label: string;
    readonly artifactId: string;
  }): Promise<ProductResult<{ readonly objectDigest: string; readonly evidenceDigest: string }>> {
    const bytesBase64 = encodeBase64(input.bytes);
    const result = await this.bridgeCall({
      operation: 'evidence.intake',
      payload: {
        bytesBase64,
        metadata: { kind: 'evidence-artifact', label: input.label },
        record: {
          schemaVersion: 1,
          kind: 'observation',
          subject: { artifactId: input.artifactId, revision: 'r1', digest: '0'.repeat(64) },
          producedBy: { runId: 'desktop-intake', actorId: this.session?.principalId ?? 'principal:desktop' },
          observedAt: this.clock(),
          content: { mediaType: 'application/octet-stream', data: { label: input.label } },
          confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'stated', rationale: 'desktop intake' },
        },
      },
    });
    if (!result.ok) return result;
    const payload = result.value.result as {
      objectRef?: { digest?: string };
      receipt?: { digest?: string };
    };
    return {
      ok: true,
      value: {
        objectDigest: payload.objectRef?.digest ?? '',
        evidenceDigest: payload.receipt?.digest ?? '',
      },
    };
  }

  // -------------------------------------------------------------------------
  // J03 — capability/role discovery.
  // -------------------------------------------------------------------------

  /** Run problem-driven capability/role discovery through the authority. */
  async runDiscovery(input: DiscoveryRunInput): Promise<ProductResult<DiscoveryViewModel>> {
    const result = await this.bridgeCall({
      operation: 'discovery.run',
      payload: {
        input: {
          schemaVersion: 1,
          tenantId: this.session?.tenantId ?? '',
          task: {
            summary: input.summary,
            lifecycleStage: input.lifecycleStage ?? 'realize',
            domainRefs: input.domainRefs ?? [],
            objectives: input.objectives ?? [],
          },
          worldRefs: input.worldRefs ?? [],
          evidenceSignals: [],
          constraintSignals: [],
          taskSignals: [],
          packContributions: [],
        },
        options: { candidates: [] },
      },
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        recoveryAction: clientRecoveryAction(result.error),
      };
    }
    const run = result.value.result as {
      runId?: string;
      contentDigest?: string;
      organization?: { roles?: { roleId?: string; summary?: string }[] };
      roles?: { roleId?: string; summary?: string }[];
      capabilityGaps?: { gapId?: string; requirement?: string }[];
    };
    const roles =
      (run.organization?.roles ?? run.roles ?? []).map((role) => ({
        roleId: String(role.roleId ?? ''),
        summary: String(role.summary ?? ''),
      }));
    const gaps = (run.capabilityGaps ?? []).map((gap) => ({
      gapId: String(gap.gapId ?? ''),
      summary: String(gap.requirement ?? ''),
    }));
    return {
      ok: true,
      value: { runId: run.runId ?? run.contentDigest ?? null, roles, capabilityGaps: gaps, outcome: result.value, authorityError: null },
    };
  }

  // -------------------------------------------------------------------------
  // J04 — alternatives, constraints, evaluation, verification, approval.
  // -------------------------------------------------------------------------

  /** The full action cycle: constraint + verification + submit -> approve -> execute -> status. */
  async runActionApprovalCycle(input: ActionCycleInput): Promise<ProductResult<ActionApprovalViewModel>> {
    const steps: ActionApprovalViewModel['steps'][number][] = [];
    let constraintOutcome: JsonValue | null = null;
    let verificationOutcome: JsonValue | null = null;

    if (input.constraint !== undefined) {
      const constraint = await this.bridgeCall({
        operation: 'constraints.evaluate',
        payload: { compiledConstraint: input.constraint.compiledConstraint, context: input.constraint.context },
      });
      if (!constraint.ok) return constraint;
      constraintOutcome = constraint.value.result;
    }
    if (input.verificationChain !== undefined) {
      const verification = await this.bridgeCall({
        operation: 'verification.validateChain',
        payload: { chain: input.verificationChain },
      });
      if (!verification.ok) return verification;
      verificationOutcome = verification.value.result;
    }

    const submitted = await this.bridgeCall({
      operation: 'action.submit',
      payload: {
        actionId: input.actionId,
        proposal: input.proposal,
        ...(input.policies !== undefined ? { policies: input.policies } : {}),
        ...(input.evaluationContext !== undefined ? { evaluationContext: input.evaluationContext } : {}),
        ...(input.approval !== undefined ? { approval: input.approval } : {}),
      },
    });
    if (!submitted.ok) return submitted;
    steps.push({ actionId: input.actionId, step: 'submitted', at: this.clock(), detail: 'proposal submitted to the Action Gateway' });

    const approved = await this.bridgeCall({
      operation: 'action.approve',
      payload: { actionId: input.actionId, decidedBy: { id: input.decidedBy, role: 'human-approver' }, asRole: input.asRole },
    });
    if (!approved.ok) return approved;
    steps.push({ actionId: input.actionId, step: 'approved', at: this.clock(), detail: `human approval by ${input.decidedBy} as ${input.asRole}` });

    const executed = await this.bridgeCall({
      operation: 'action.execute',
      payload: { actionId: input.actionId },
    });
    if (!executed.ok) return executed;
    steps.push({ actionId: input.actionId, step: 'executed', at: this.clock(), detail: 'executed through the Action Gateway (the execution authority)' });

    const status = await this.bridgeCall({ operation: 'action.status', payload: { actionId: input.actionId } });
    const statusRecord = status.ok ? (status.value.result as { status?: string; state?: string }) : null;
    return {
      ok: true,
      value: {
        actionId: input.actionId,
        steps,
        status: String(statusRecord?.status ?? statusRecord?.state ?? 'executed'),
        constraintOutcome,
        verificationOutcome,
      },
    };
  }

  // -------------------------------------------------------------------------
  // J05 — program of work, BOQ/domain schedule, acquisition/procurement.
  // -------------------------------------------------------------------------

  /** Seal + approve the solution, fold the schedule, run the procurement quote. */
  async runProgramWorkflow(input: ProgramWorkflowInput): Promise<ProductResult<ProgramOfWorkViewModel>> {
    const sealed = await this.bridgeCall({ operation: 'solution.sealVersion', payload: { content: input.solutionContent } });
    if (!sealed.ok) return sealed;
    const sealedSolution = sealed.value.result as Record<string, unknown>;

    const approval = await this.bridgeCall({
      operation: 'solution.approveBaseline',
      payload: {
        solution: sealedSolution,
        approval: {
          schema: 'epoch.solution-delivery.baseline-approval',
          schemaVersion: 1,
          approvalId: 'approval:desktop-journey',
          solutionId: sealedSolution['solutionId'],
          tenantId: this.session?.tenantId ?? '',
          version: sealedSolution['version'],
          baselineDigest: sealedSolution['contentDigest'],
          approvedBy: input.approvedBy,
          approvedAt: this.clock(),
          decisionNote: 'desktop journey approval',
        },
      },
    });
    if (!approval.ok) return approval;

    const schedule = await this.bridgeCall({ operation: 'program.schedule', payload: { program: input.program } });
    if (!schedule.ok) return schedule;
    const folds = schedule.value.result as {
      quantity?: Record<string, unknown>;
      cost?: Record<string, unknown>;
      milestones?: { rows?: { milestoneId?: string; title?: string; status?: string }[] };
    };
    const quantityRows = foldRows(folds.quantity);
    const costRows = foldRows(folds.cost);
    const milestones = (folds.milestones?.rows ?? []).map((milestone) => ({
      milestoneId: String(milestone.milestoneId ?? ''),
      title: String(milestone.title ?? ''),
      status: String(milestone.status ?? ''),
    }));

    let quoteId: string | null = null;
    if (input.quote !== undefined) {
      const quoted = await this.bridgeCall({
        operation: 'procurement.quote',
        payload: { content: input.quote.content, packages: input.quote.packages, store: input.quote.store },
      });
      if (quoted.ok) {
        quoteId = String((quoted.value.result as { quote?: { quoteId?: string } }).quote?.quoteId ?? '');
      } else {
        // The procurement authority's typed rejection rides verbatim; the
        // journey records it (delegation-contract depth, W046 limitations §6).
        return quoted;
      }
    }

    return {
      ok: true,
      value: {
        solutionVersionDigest: String(sealedSolution['contentDigest'] ?? ''),
        programContentDigest: null,
        quantitySchedule: quantityRows,
        costSchedule: costRows,
        milestones,
        quoteId,
        outcome: schedule.value,
      },
    };
  }

  // -------------------------------------------------------------------------
  // J06 — realize, field observation, actualization, verification, close.
  // -------------------------------------------------------------------------

  /** Open the delivery, observe the field, roll the forecast, verify, close. */
  async realizeDelivery(input: RealizeDeliveryInput): Promise<ProductResult<RealizeViewModel>> {
    const opened = await this.bridgeCall({ operation: 'delivery.open', payload: { content: input.deliveryContent } });
    if (!opened.ok) return opened;
    const delivery = opened.value.result as Record<string, unknown>;

    const observations: RealizeViewModel['observations'][number][] = [];
    for (const observation of input.observations) {
      const observed = await this.bridgeCall({
        operation: 'delivery.observe',
        payload: {
          solutionId: observation.solutionId,
          ...(observation.program !== undefined ? { program: observation.program } : {}),
          capture: observation.capture,
        },
      });
      if (!observed.ok) return observed;
      const record = observed.value.result as Record<string, unknown>;
      observations.push({
        observationId: String(record['observationId'] ?? record['captureKey'] ?? ''),
        subject: String((record['subjectRef'] as Record<string, unknown> | undefined)?.['id'] ?? ''),
        measure: JSON.stringify((record['measure'] as Record<string, unknown> | undefined) ?? {}),
        at: String(record['observedAt'] ?? this.clock()),
      });
    }

    const forecast = await this.bridgeCall({ operation: 'actualization.forecast', payload: { input: input.forecastInput } });
    if (!forecast.ok) return forecast;

    let verification: JsonValue | null = null;
    if (input.verificationChain !== undefined) {
      const verified = await this.bridgeCall({ operation: 'verification.validateChain', payload: { chain: input.verificationChain } });
      if (!verified.ok) return verified;
      verification = verified.value.result;
    }

    const closed = await this.bridgeCall({
      operation: 'delivery.close',
      payload: { delivery, closing: input.closing },
    });
    if (!closed.ok) return closed;

    return {
      ok: true,
      value: {
        deliveryId: String(delivery['deliveryId'] ?? ''),
        observations,
        forecast: forecast.value.result,
        verification,
        closed: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // J07 — offline work, queue, reconnect, idempotent sync.
  // -------------------------------------------------------------------------

  /** The network state (the offline simulation switch). */
  get online(): boolean {
    return this.networkOnline;
  }

  async goOffline(): Promise<void> {
    this.networkOnline = false;
  }

  async goOnline(): Promise<void> {
    this.networkOnline = true;
  }

  private networkDecision(request: BridgeCallRequest): { readonly effect: 'online' | 'queue-offline' | 'fail-transient' } {
    if (this.networkOnline) return { effect: 'online' };
    // A drain attempt NEVER re-enqueues (the queue already holds the intent;
    // re-admission would duplicate the pending projection).
    if (this.draining) return { effect: 'fail-transient' };
    // While offline: mutating queueable operations route to the offline
    // queue; everything else fails transient (the recovery mapping).
    const queueable = ['evidence.intake', 'action.submit', 'action.approve', 'action.execute', 'delivery.observe'];
    if (queueable.includes(request.operation)) {
      return { effect: 'queue-offline' };
    }
    return { effect: 'fail-transient' };
  }

  /** Enqueue an offline intent explicitly (the J07 scenario shape). */
  async enqueueOfflineIntent(request: OfflineIntentRequest): Promise<ProductResult<{ readonly queueId: string }>> {
    if (this.offlineQueue === null) {
      return {
        ok: false,
        error: noSessionGatewayError(request.operation),
        recoveryAction: 're-authenticate',
      };
    }
    const admitted = await this.offlineQueue.admit({
      queueId: request.queueId,
      correlation: {
        schemaVersion: 1,
        correlationId: `corr:offline-${request.queueId.replace('queue:', '')}`,
        origin: 'desktop',
        issuedAt: this.clock(),
      },
      idempotencyKey: request.idempotencyKey,
      operation: request.operation,
      payload: toJson(request.payload),
      enqueuedAt: this.clock(),
    });
    if (!admitted.ok) {
      return {
        ok: false,
        error: gatewayError({
          class: 'authority-rejected',
          code: 'authority-denied',
          message: `offline admission rejected: ${admitted.rejection.message}`,
          operation: request.operation,
          correlationId: 'corr:unattributed',
          details: { authority: '@epoch/client-runtime', authorityCode: admitted.rejection.code, authorityError: JSON.parse(JSON.stringify(admitted.rejection)) as never },
        }),
        recoveryAction: 'surface-authority-rejection',
      };
    }
    return { ok: true, value: { queueId: admitted.intent.queueId } };
  }

  /** The offline queue view-model (J07). */
  offlineQueueView(): OfflineQueueViewModel {
    const queue = this.offlineQueue;
    if (queue === null) {
      return { pending: [], drained: this.drainedRecords, lastDrainAt: this.lastDrainAt, stillPendingCount: 0 };
    }
    return {
      pending: queue.pendingIntents().map((intent) => ({
        queueId: intent.queueId,
        operation: intent.operation,
        state: intent.state,
      })),
      drained: this.drainedRecords,
      lastDrainAt: this.lastDrainAt,
      stillPendingCount: queue.pendingIntents().length,
    };
  }

  /**
   * Drain the offline queue through the gateway (the client-runtime
   * per-intent replay port — every intent carries its idempotency key).
   */
  async drainOfflineQueue(): Promise<ProductResult<OfflineQueueViewModel>> {
    if (this.offlineQueue === null) {
      return {
        ok: false,
        error: noSessionGatewayError('recovery.replay'),
        recoveryAction: 're-authenticate',
      };
    }
    this.lastDrainAt = this.clock();
    const outcome = await this.offlineQueue.drain(
      {
        submitIntent: async (intent) => {
          // The drain is the retry path itself: while draining, the network
          // gate NEVER re-enqueues (a drain attempt either reaches the
          // gateway when online or fails transiently when offline — the
          // intent stays pending, exactly the J07 step-2 semantics).
          this.draining = true;
          try {
            const result = await this.bridgeCall({
              operation: intent.operation,
              payload: intent.payload,
              idempotencyKey: intent.idempotencyKey,
              correlationId: intent.correlation.correlationId,
            });
            if (result.ok) return { ok: true, value: result.value.result };
            return { ok: false, error: result.error };
          } finally {
            this.draining = false;
          }
        },
      },
      { at: this.clock() },
    );
    for (const intent of outcome.drained) {
      this.drainedRecords.push({
        queueId: intent.queueId,
        outcomeDigest: intent.idempotencyKey,
        replayed: false,
      });
    }
    return { ok: true, value: this.offlineQueueView() };
  }

  /** The recovery.replay operation (the scenario-script drain path). */
  async recoveryReplay(
    intents: readonly { readonly queueId: string; readonly idempotencyKey: string; readonly operation: string; readonly payload: unknown }[],
  ): Promise<ProductResult<JsonValue>> {
    const result = await this.bridgeCall({ operation: 'recovery.replay', payload: { intents: intents.map((intent) => ({ ...intent, payload: toJson(intent.payload) })) } });
    if (!result.ok) return result;
    this.lastDrainAt = this.clock();
    return { ok: true, value: result.value.result };
  }

  // -------------------------------------------------------------------------
  // J08 — cross-device handoff.
  // -------------------------------------------------------------------------

  /** The handoff view: world digest equality + session scope + cached projection. */
  async handoffView(registryWorldDigest: string | null): Promise<ProductResult<HandoffViewModel>> {
    const world = await this.bridgeCall({ operation: 'world.snapshot', payload: {} });
    if (!world.ok) return world;
    const digest = (world.value.result as { digest?: string }).digest ?? null;
    const validated = await this.bridgeCall({
      operation: 'session.validate',
      payload: { sessionId: this.session?.sessionId ?? '' },
    });
    const scope =
      validated.ok && this.session !== null
        ? { principalId: this.session.principalId, tenantId: this.session.tenantId }
        : null;
    // Admit the server projection into the read-only cache (J08 step 4).
    let cached: string | null = null;
    if (digest !== null) {
      const entry = this.projectionCache.admitServerProjection({
        digest,
        revision: 1,
        fetchedAt: this.clock(),
        content: world.value.result,
      });
      await this.projectionCache.persist();
      cached = entry.digest;
    }
    return {
      ok: true,
      value: {
        worldDigest: digest,
        registryWorldDigest,
        digestsMatch: digest !== null && registryWorldDigest !== null ? digest === registryWorldDigest : null,
        sessionScope: scope,
        cachedProjectionDigest: cached,
        note: 'the desktop resolves the SAME authoritative project state as the web product (identical fixture world digest)',
      },
    };
  }

  // -------------------------------------------------------------------------
  // J09 — agent supervision / intervention.
  // -------------------------------------------------------------------------

  /** Run the supervision pass (+ raise an alert when input provides one). */
  async runSupervision(input: SupervisionInput): Promise<ProductResult<SupervisionViewModel>> {
    const check = await this.bridgeCall({ operation: 'supervision.check', payload: { input: input.checkInput } });
    let alertId: string | null = null;
    let authorityError: GatewayError | null = null;
    if (!check.ok) {
      return { ok: false, error: check.error, recoveryAction: clientRecoveryAction(check.error) };
    }
    if (input.alert !== undefined) {
      const raised = await this.bridgeCall({
        operation: 'alerts.raise',
        payload: { chain: input.alert.chain, options: input.alert.options },
      });
      if (raised.ok) {
        alertId = String((raised.value.result as { alert?: { alertId?: string } }).alert?.alertId ?? '');
      } else {
        authorityError = raised.error;
      }
    }
    return {
      ok: true,
      value: { checkOutcome: check.value.result, alertId, authorityError },
    };
  }

  // -------------------------------------------------------------------------
  // J11 — recovery from network/session/input/action/connector/evidence failures.
  // -------------------------------------------------------------------------

  /** The recovery event log (J11 evidence). */
  recoveryView(): RecoveryViewModel {
    return { events: [...this.recoveryEvents] };
  }

  /** Record one recovery event (the runner + the UI drive the failure chain). */
  recordRecovery(event: Omit<RecoveryEvent, 'at'> & { readonly at?: string }): void {
    this.recoveryEvents.push({ ...event, at: event.at ?? this.clock() } as RecoveryEvent);
  }

  // -------------------------------------------------------------------------
  // J12 — relaunch + update.
  // -------------------------------------------------------------------------

  /** The relaunch view: restore persisted state + run the update check. */
  async relaunchView(updateCandidate: unknown): Promise<ProductResult<RelaunchViewModel>> {
    const sessionRestored = await this.restoreSession();
    const queueRestored = await this.offlineQueue?.restore();
    const projectionsRestored = await this.projectionCache.restore();
    const update = checkUpdateCandidate(updateCandidate);
    let appMeta: HostAppMeta | null = null;
    try {
      appMeta = await this.host.appMeta();
    } catch {
      // The typed fallback: an unavailable host (dev-server without the
      // native shell) reports no metadata — the view-model carries null.
    }
    return {
      ok: true,
      value: {
        sessionRestored,
        queueRestoredCount: queueRestored?.length ?? 0,
        projectionsRestoredCount: projectionsRestored?.length ?? 0,
        updateCheck: update.ok ? 'compatible' : 'refused',
        updateRefusalReason: update.ok ? null : update.refusal.reason,
        appMeta,
      },
    };
  }

  /** Restore the projection cache (relaunch boot). */
  async restoreProjectionCache(): Promise<number> {
    const restored = await this.projectionCache.restore();
    return restored?.length ?? 0;
  }

  // -------------------------------------------------------------------------
  // Native import/export (the file-picker surface).
  // -------------------------------------------------------------------------

  /** Export the product handoff descriptor through the native save dialog. */
  async exportHandoff(defaultName: string): Promise<ProductResult<{ readonly path: string }>> {
    const path = await this.host.pickSaveFile(defaultName, [
      { name: 'Epoch handoff', extensions: ['json'] },
    ]);
    if (path === null) {
      return {
        ok: false,
        error: dialogCancelledError('the save dialog was cancelled'),
        recoveryAction: 'surface-input',
      };
    }
    const world = await this.bridgeCall({ operation: 'world.snapshot', payload: {} });
    const descriptor = {
      schemaVersion: 1,
      kind: 'epoch.desktop.handoff',
      worldDigest: world.ok ? ((world.value.result as { digest?: string }).digest ?? null) : null,
      sessionScope: this.session === null ? null : { principalId: this.session.principalId, tenantId: this.session.tenantId },
      exportedAt: this.clock(),
    };
    await this.host.writeFileUtf8(path, JSON.stringify(descriptor, null, 2));
    return { ok: true, value: { path } };
  }

  /** Import a handoff descriptor through the native open dialog. */
  async importHandoff(): Promise<ProductResult<{ readonly worldDigest: string | null }>> {
    const path = await this.host.pickOpenFile([{ name: 'Epoch handoff', extensions: ['json'] }]);
    if (path === null) {
      return {
        ok: false,
        error: dialogCancelledError('the open dialog was cancelled'),
        recoveryAction: 'surface-input',
      };
    }
    const text = await this.host.readFileUtf8(path);
    let parsed: { worldDigest?: string };
    try {
      parsed = JSON.parse(text) as { worldDigest?: string };
    } catch {
      return {
        ok: false,
        error: dialogCancelledError('the imported file is not valid JSON'),
        recoveryAction: 'surface-input',
      };
    }
    return { ok: true, value: { worldDigest: parsed.worldDigest ?? null } };
  }

  // -------------------------------------------------------------------------
  // The typed bridge call (the ONE semantic exit — everything above uses it).
  // -------------------------------------------------------------------------

  private async bridgeCall(request: { operation: string; payload: unknown; idempotencyKey?: string; correlationId?: string; causationId?: string }): Promise<ProductResult<GatewayOutcome>> {
    const outcome = await this.bridge.call({ ...request, payload: toJson(request.payload) });
    if ('offline' in outcome && outcome.ok) {
      // Routed to the offline queue (J07): surface as the pending-projection
      // marker the UI renders (NOT a semantic outcome — the authority has
      // not spoken yet).
      return {
        ok: false,
        error: gatewayError({
          class: 'transient',
          code: 'network-unavailable',
          message: `"${request.operation}" queued as a pending offline projection (${outcome.offline.queueId})`,
          operation: 'gateway',
          correlationId: request.correlationId ?? 'corr:unattributed',
          details: { retryAfterMs: 0 },
        }),
        recoveryAction: 'retry-with-backoff',
      };
    }
    if (!outcome.ok) {
      const action = clientRecoveryAction(outcome.error);
      this.recoveryEvents.push({
        at: this.clock(),
        kind:
          outcome.error.class === 'auth-session-expired'
            ? 'session-expired'
            : outcome.error.class === 'transient'
              ? 'connector-failure'
              : outcome.error.class === 'authority-rejected'
                ? 'authority-rejection'
                : 'connector-failure',
        detail: `${outcome.error.class}/${outcome.error.code}: ${outcome.error.message}`,
      });
      return { ok: false, error: outcome.error, recoveryAction: action };
    }
    return { ok: true, value: outcome.value };
  }

  /** The W017 shell session snapshot digest (the session-cache integration). */
  async snapshotShell(): Promise<string | null> {
    if (this.shell === null || this.shellHost === null) return null;
    this.shellTime += 1;
    const sent = this.shellHost.send({ kind: 'snapshot-request', payload: {} }, this.shellTime);
    if (!sent.ok) return null;
    const outcome = this.shell.applyHostEnvelope(sent.value.envelope);
    if (!outcome.ok) return null;
    return outcome.value.snapshot?.digest ?? null;
  }
}

/** The typed no-session gateway error. */
function noSessionGatewayError(operation: string): GatewayError {
  return gatewayError({
    class: 'auth-session-expired',
    code: 'principal-authentication-required',
    message: 'no session is bound to the bridge (authenticate first)',
    operation,
    correlationId: 'corr:unattributed',
    details: { sessionId: 'session:unbound', reauthRequired: true },
  });
}

/** The typed dialog/import refusal. */
function dialogCancelledError(message: string): GatewayError {
  return gatewayError({
    class: 'validation',
    code: 'request-validation',
    message,
    operation: 'gateway',
    correlationId: 'corr:unattributed',
  });
}

/** Coerce a payload into the frozen JsonValue envelope type (runtime-safe: JSON round-trip). */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** Encode bytes to base64 (environment-neutral). */
function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Fold a schedule projection into view rows. */
function foldRows(fold: Record<string, unknown> | undefined): { key: string; quantity: string; cost: string }[] {
  if (fold === undefined) return [];
  const rows: { key: string; quantity: string; cost: string }[] = [];
  const entries = (fold['byKey'] ?? fold['rows'] ?? fold) as Record<string, unknown>;
  if (Array.isArray(entries)) {
    for (const entry of entries as Record<string, unknown>[]) {
      rows.push({
        key: String(entry['key'] ?? entry['solutionLineId'] ?? ''),
        quantity: String(entry['quantity'] ?? ''),
        cost: String(entry['cost'] ?? entry['totalCost'] ?? ''),
      });
    }
    return rows;
  }
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      rows.push({
        key,
        quantity: String(record['quantity'] ?? record['totalQuantity'] ?? ''),
        cost: String(record['cost'] ?? record['totalCost'] ?? ''),
      });
    }
  }
  return rows.sort((a, b) => (a.key < b.key ? -1 : 1));
}

export type { GatewayCallResult } from '@epoch/client-runtime';
