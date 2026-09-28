/**
 * The reference delivery-supervision runtime host (W043): the thin typed
 * HOST FACADE over the @epoch/supervision + @epoch/alerts kernels.
 *
 * Owns (and only owns): tenant-scoped program/delivery registration
 * (the REAL W036 sealed records verified at admission; idempotent by
 * digest, replay-conflict on same-id-different-content), escalation-
 * policy registration (policy as data; the ACTIVE policy is the latest
 * activation), scheduled evaluation passes at CALLER-DRIVEN instants
 * (no timers, no wall-clock) producing findings through the six
 * supervision check families, the alert lifecycle (idempotent raise,
 * append-only revisions across due -> late -> blocked transitions,
 * escalation through typed W003 proposals + verifiable gateway
 * decisions, terminal resolution), notification dispatch through the
 * NotificationPort adapter seam (replay-safe duplicate receipts) with
 * policy-driven re-notify cadence sweeps, and the derived
 * supervision-state projection. Every step emits `supervision:*`
 * events on the affected program's stream (`stream:supervision-<suffix>`,
 * one stream per supervised program, digests sealed by the kernel and
 * pinned by the REAL sealEvent parity tests); tenant host-level steps
 * (policy registration) use `stream:supervision-host-<suffix>`.
 *
 * The W009 authorization gate denies unauthorized operations BEFORE any
 * kernel admission. Supervision OBSERVES, never re-schedules:
 * `rescheduleProgram` is the typed `re-schedule-rejected` trap.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every
 * instant is caller-supplied; every listing/snapshot is sorted (no
 * insertion-order leaks); two runtimes fed the same operations hold
 * byte-identical state.
 */
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  admitEscalationPolicy,
  buildNotification,
  escalateAlert,
  foldAlertChains,
  InMemoryNotificationAdapter,
  planEscalation,
  raiseAlert,
  recordEscalationOutcome,
  resolveAlert,
  resolvePolicyRule,
  type AlertFindingSummary,
  type AlertRaiseOutcome,
  type NotificationPort,
  type NotificationReceipt,
  type SealedAlertRecord,
  type SealedEscalationOutcome,
  type SealedEscalationPolicy,
} from '@epoch/alerts';
import {
  DEFAULT_SUPERVISION_THRESHOLDS,
  evaluateSupervisionPass,
  instantToEpochMs,
  projectSupervisionState,
  sealSupervisionEvent,
  supervisionHostStreamIdOf,
  supervisionStreamIdOf,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  type ExecutionIssueSummary,
  type LeadTimeRiskInput,
  type SealedSupervisionEvent,
  type SealedSupervisionFinding,
  type SealedSupervisionPass,
} from '@epoch/supervision';
import type {
  SealedDeliveryRecord,
  SealedProgramOfWork,
} from '@epoch/supervision';
import { RUNTIME_RECORD_VERSION } from './version';
import type {
  AuthorizationInput,
  EvaluationPassOutcome,
  GatewayDecisionOutcome,
  NotificationSweepOptions,
  RecordGatewayDecisionOptions,
  RegisterDeliveryOptions,
  RegisterPolicyOptions,
  RegisterProgramOptions,
  ResolveAlertOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  RunEvaluationPassOptions,
  StreamReadOptions,
  SupervisionHostProjection,
  SupervisionServiceError,
  SupervisionServiceResult,
  SupervisionStateOptions,
} from './types';

/**
 * Map a W009 authorization error onto the service union: `validation`
 * passes through (malformed contexts are typed validation failures);
 * every other authorization failure is the fail-closed
 * `authorization-rejected` service code.
 */
function mapAuthorizationError(error: {
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly { path: string; message: string }[] | undefined;
}): SupervisionServiceError {
  if (error.code === 'validation') {
    return {
      code: 'validation',
      message: error.message,
      issues: error.issues ?? [],
    };
  }
  return {
    code: 'authorization-rejected',
    message: `the authorization decision point failed (${error.code}): ${error.message}`,
    denialCode: error.code,
    principalId: 'unknown',
    operation: 'authorization',
  };
}

/** Deterministic composite key: `<tenantId>#<id>`. */
function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}#${id}`;
}

/** The notification-id slug of one alert id (deterministic, bounded). */
function notificationSlugOf(alertId: string): string {
  return alertId
    .slice('alert:'.length)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Derive the alert id of one finding (stable across passes; epoch-suffixed on recurrence). */
function alertIdOf(findingId: string, epoch: number): string {
  const slug = findingId
    .slice('finding:'.length)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55);
  const suffix = epoch > 1 ? `-r${epoch}` : '';
  return `alert:${slug}${suffix}`;
}

/** Project one finding into the alerts summary (the parity-pinned mapping). */
function toFindingSummary(
  finding: SealedSupervisionFinding,
  pass: SealedSupervisionPass,
): AlertFindingSummary {
  return {
    findingId: finding.findingId,
    findingDigest: finding.contentDigest,
    findingClass: finding.findingClass,
    findingStatus: finding.status,
    subjectKind: finding.subject.subjectKind,
    subjectId: finding.subject.subjectId,
    title: finding.title,
    detectedAt: pass.evaluatedAt,
  };
}

/** The runtime's per-tenant alert-chain bookkeeping. */
interface AlertChainEntry {
  readonly findingId: string;
  readonly epoch: number;
  revisions: readonly SealedAlertRecord[];
  notificationCounter: number;
}

/**
 * The reference delivery-supervision runtime host. Construct directly
 * (the in-memory NotificationPort reference adapter is the default).
 * In-memory only: no persistence, no network, no clocks.
 */
export class SupervisionRuntime {
  /** tenantId#programId -> the verified sealed program. Maps iterate in insertion order; every read path sorts. */
  private readonly programs = new Map<string, SealedProgramOfWork>();

  /** tenantId#deliveryId -> the verified sealed delivery + its program binding. */
  private readonly deliveries = new Map<string, { delivery: SealedDeliveryRecord; programId: string }>();

  /** tenantId -> (policyId -> sealed policy); activePolicyId per tenant. */
  private readonly policies = new Map<string, Map<string, SealedEscalationPolicy>>();
  private readonly activePolicy = new Map<string, string>();

  /** tenantId#programId -> the pass history (append-only). */
  private readonly passes = new Map<string, SealedSupervisionPass[]>();

  /** tenantId#alertId -> the alert-chain entry. */
  private readonly alertChains = new Map<string, AlertChainEntry>();

  /** tenantId -> escalation outcomes (append-only). */
  private readonly escalationOutcomes = new Map<string, SealedEscalationOutcome[]>();

  /** tenantId -> notification receipts (append-only). */
  private readonly notifications = new Map<string, NotificationReceipt[]>();

  /** stream:supervision-<suffix> -> events (append-only). */
  private readonly streams = new Map<string, SealedSupervisionEvent[]>();

  private readonly notificationPort: NotificationPort;

  private readonly expectedTenantId: string | undefined;

  constructor(options: SupervisionRuntimeOptionsLike = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.notificationPort = options.notificationPort ?? new InMemoryNotificationAdapter();
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W037/W038 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): SupervisionServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: mapAuthorizationError(context.error) };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `supervision.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: mapAuthorizationError(decision.error) };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for supervision.${operation} (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `the authorization decision point is not applicable to this request (${value.reason}) — supervision is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private tenantGuard(tenantId: string): SupervisionServiceResult<null> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this supervision host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
          subject: tenantId,
        },
      };
    }
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // Event emission (sealed by the kernel; contiguous sequences).
  // --------------------------------------------------------------------------------

  private emit(
    streamId: string,
    tenantId: string,
    actor: string,
    discriminator: string,
    data: Record<string, unknown>,
    occurredAt: string,
  ): void {
    const events = this.streams.get(streamId) ?? [];
    const previous = events.length > 0 ? events[events.length - 1]! : null;
    const sealed = sealSupervisionEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId,
      actor,
      causalParent: previous === null ? null : { streamId, sequence: previous.sequence },
      payload: { discriminator, data: data as never },
      occurredAt,
    });
    if (sealed.ok) {
      this.streams.set(streamId, [...events, sealed.value]);
    }
  }

  // --------------------------------------------------------------------------------
  // Registration (idempotent by digest; replay-conflict on same id + different content).
  // --------------------------------------------------------------------------------

  /** Register the sealed W036 ProgramOfWork (the schedule authority input). */
  registerProgram(options: RegisterProgramOptions): SupervisionServiceResult<{
    programId: string;
    programDigest: string;
    registered: boolean;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register',
      options.tenantId,
      options.authorization,
      options.program.programId,
      'supervision-program',
    );
    if (!gate.ok) return gate;
    const verified = verifySealedProgramOfWork(options.program);
    if (!verified.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the W036 authority rejected the program: ${verified.error.message}`,
          issues: [{ path: '$', message: verified.error.message }],
        },
      };
    }
    const program = verified.value;
    if (program.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `program "${program.programId}" belongs to tenant "${program.tenantId}" — it cannot be hosted for tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: program.tenantId,
          subject: program.programId,
        },
      };
    }
    const key = tenantKey(options.tenantId, program.programId);
    const existing = this.programs.get(key);
    if (existing !== undefined) {
      if (existing.contentDigest === program.contentDigest) {
        return {
          ok: true,
          value: { programId: program.programId, programDigest: program.contentDigest, registered: false },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `program "${program.programId}" is already hosted with different content — the schedule authority advances through new W036 baseline versions, not supervision re-registration`,
          subject: program.programId,
          publishedDigest: existing.contentDigest,
          encounteredDigest: program.contentDigest,
        },
      };
    }
    this.programs.set(key, program);
    this.emit(
      supervisionStreamIdOf(program.programId),
      options.tenantId,
      gate.value.principalId,
      'supervision:program-registered',
      {
        programId: program.programId,
        programDigest: program.contentDigest,
        registeredAt: options.program.createdAt,
      },
      options.program.createdAt,
    );
    return {
      ok: true,
      value: { programId: program.programId, programDigest: program.contentDigest, registered: true },
    };
  }

  /** Register the sealed W036 DeliveryRecord (the delivery-facts authority input). */
  registerDelivery(options: RegisterDeliveryOptions): SupervisionServiceResult<{
    deliveryId: string;
    deliveryDigest: string;
    programId: string;
    registered: boolean;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const verified = verifySealedDeliveryRecord(options.delivery);
    if (!verified.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the W036 authority rejected the delivery: ${verified.error.message}`,
          issues: [{ path: '$', message: verified.error.message }],
        },
      };
    }
    const delivery = verified.value;
    if (delivery.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `delivery "${delivery.deliveryId}" belongs to tenant "${delivery.tenantId}" — it cannot be hosted for tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: delivery.tenantId,
          subject: delivery.deliveryId,
        },
      };
    }
    // The delivery must ground a REGISTERED program of the same baseline.
    const binding = [...this.programs.entries()].find(
      ([, program]) =>
        program.tenantId === options.tenantId &&
        program.solutionId === delivery.solutionId &&
        program.solutionVersionDigest === delivery.solutionVersionDigest,
    );
    if (binding === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-program',
          message: `delivery "${delivery.deliveryId}" grounds solution "${delivery.solutionId}" (${delivery.solutionVersionDigest.slice(0, 12)}…) which has no registered program — register the program first`,
          programId: delivery.solutionId,
        },
      };
    }
    const program = binding[1]!;
    const gate = this.authorizationGate(
      'register',
      options.tenantId,
      options.authorization,
      delivery.deliveryId,
      'supervision-delivery',
    );
    if (!gate.ok) return gate;
    const key = tenantKey(options.tenantId, delivery.deliveryId);
    const existing = this.deliveries.get(key);
    if (existing !== undefined) {
      if (existing.delivery.contentDigest === delivery.contentDigest) {
        return {
          ok: true,
          value: {
            deliveryId: delivery.deliveryId,
            deliveryDigest: delivery.contentDigest,
            programId: existing.programId,
            registered: false,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `delivery "${delivery.deliveryId}" is already hosted with different state — deliveries advance through the W036 authority path only`,
          subject: delivery.deliveryId,
          publishedDigest: existing.delivery.contentDigest,
          encounteredDigest: delivery.contentDigest,
        },
      };
    }
    this.deliveries.set(key, { delivery, programId: program.programId });
    this.emit(
      supervisionStreamIdOf(program.programId),
      options.tenantId,
      gate.value.principalId,
      'supervision:delivery-registered',
      {
        deliveryId: delivery.deliveryId,
        deliveryDigest: delivery.contentDigest,
        programId: program.programId,
        registeredAt: delivery.openedAt,
      },
      delivery.openedAt,
    );
    return {
      ok: true,
      value: {
        deliveryId: delivery.deliveryId,
        deliveryDigest: delivery.contentDigest,
        programId: program.programId,
        registered: true,
      },
    };
  }

  /** Register (activate) one escalation policy (policy as data). */
  registerPolicy(options: RegisterPolicyOptions): SupervisionServiceResult<{
    policyId: string;
    policyDigest: string;
    policyVersion: string;
    registered: boolean;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register-policy',
      options.tenantId,
      options.authorization,
      'escalation-policy',
      'supervision-policy',
    );
    if (!gate.ok) return gate;
    const admitted = admitEscalationPolicy(options.policy);
    if (!admitted.ok) {
      return admitted;
    }
    const policy = admitted.value;
    if (policy.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `policy "${policy.policyId}" belongs to tenant "${policy.tenantId}" — it cannot be activated for tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: policy.tenantId,
          subject: policy.policyId,
        },
      };
    }
    const perTenant = this.policies.get(options.tenantId) ?? new Map<string, SealedEscalationPolicy>();
    const existing = perTenant.get(policy.policyId);
    if (existing !== undefined && existing.contentDigest === policy.contentDigest) {
      return {
        ok: true,
        value: {
          policyId: policy.policyId,
          policyDigest: policy.contentDigest,
          policyVersion: policy.policyVersion,
          registered: false,
        },
      };
    }
    perTenant.set(policy.policyId, policy);
    this.policies.set(options.tenantId, perTenant);
    // The ACTIVE policy is the latest activation (policy is data; swapping
    // records changes escalation with no code change).
    this.activePolicy.set(options.tenantId, policy.policyId);
    this.emit(
      supervisionHostStreamIdOf(options.tenantId),
      options.tenantId,
      gate.value.principalId,
      'supervision:policy-registered',
      {
        policyId: policy.policyId,
        policyDigest: policy.contentDigest,
        policyVersion: policy.policyVersion,
        registeredAt: policy.activatedAt,
      },
      policy.activatedAt,
    );
    return {
      ok: true,
      value: {
        policyId: policy.policyId,
        policyDigest: policy.contentDigest,
        policyVersion: policy.policyVersion,
        registered: true,
      },
    };
  }

  /** The active escalation policy of one tenant (null when none registered). */
  activePolicyOf(tenantId: string): SealedEscalationPolicy | null {
    const policyId = this.activePolicy.get(tenantId);
    if (policyId === undefined) {
      return null;
    }
    return this.policies.get(tenantId)?.get(policyId) ?? null;
  }

  // --------------------------------------------------------------------------------
  // The re-schedule trap (supervision OBSERVES, never re-schedules).
  // --------------------------------------------------------------------------------

  /**
   * The typed RE-SCHEDULE trap: supervision observes the ProgramOfWork,
   * it never re-schedules it. Every call is rejected — schedule changes
   * ship as new W036 baseline versions through the W036 path.
   */
  rescheduleProgram(): SupervisionServiceResult<null> {
    return {
      ok: false,
      error: {
        code: 're-schedule-rejected',
        message:
          'supervision OBSERVES the ProgramOfWork, it never re-schedules it — schedule changes ship as new W036 baseline versions through the W036 path (the graph authority stays in W036)',
        field: 'reschedule',
        subject: 'supervision-runtime',
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Evaluation passes (caller-driven instants — no timers).
  // --------------------------------------------------------------------------------

  /** Run one supervision evaluation pass over a registered program + delivery. */
  runEvaluationPass(options: RunEvaluationPassOptions): SupervisionServiceResult<EvaluationPassOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'evaluate',
      options.tenantId,
      options.authorization,
      options.passId,
      'supervision-pass',
    );
    if (!gate.ok) return gate;
    const programKey = tenantKey(options.tenantId, options.programId);
    const program = this.programs.get(programKey);
    if (program === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-program',
          message: `program "${options.programId}" is not registered for tenant "${options.tenantId}"`,
          programId: options.programId,
        },
      };
    }
    const deliveryKey = tenantKey(options.tenantId, options.deliveryId);
    const deliveryEntry = this.deliveries.get(deliveryKey);
    if (deliveryEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-delivery',
          message: `delivery "${options.deliveryId}" is not registered for tenant "${options.tenantId}"`,
          deliveryId: options.deliveryId,
        },
      };
    }
    if (deliveryEntry.programId !== options.programId) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `delivery "${options.deliveryId}" is bound to program "${deliveryEntry.programId}", not "${options.programId}"`,
          referenceKind: 'delivery',
          referenceId: options.deliveryId,
        },
      };
    }
    const evaluated = evaluateSupervisionPass({
      passId: options.passId,
      tenantId: options.tenantId,
      evaluatedAt: options.evaluatedAt,
      evaluatedBy: gate.value.principalId,
      program,
      delivery: deliveryEntry.delivery,
      thresholds: options.thresholds ?? DEFAULT_SUPERVISION_THRESHOLDS,
      executionIssues: (options.executionIssues ?? []) as readonly ExecutionIssueSummary[],
      leadTimeInputs: (options.leadTimeInputs ?? []) as readonly LeadTimeRiskInput[],
      infoRequests: options.infoRequests ?? [],
    });
    if (!evaluated.ok) {
      return evaluated;
    }
    const pass = evaluated.value;
    const streamId = supervisionStreamIdOf(program.programId);

    // Replay protection: the same pass id with different content is a conflict.
    const passHistory = this.passes.get(programKey) ?? [];
    const priorSameId = passHistory.find((existing) => existing.passId === pass.passId);
    if (priorSameId !== undefined) {
      if (priorSameId.contentDigest === pass.contentDigest) {
        return {
          ok: false,
          error: {
            code: 'replay-conflict',
            message: `pass "${pass.passId}" is already recorded with identical content — evaluation passes are append-only facts; re-evaluation ships as a NEW pass id`,
            subject: pass.passId,
            publishedDigest: priorSameId.contentDigest,
            encounteredDigest: pass.contentDigest,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `pass id "${pass.passId}" is already recorded with DIFFERENT content — a changed evaluation ships as a new pass id`,
          subject: pass.passId,
          publishedDigest: priorSameId.contentDigest,
          encounteredDigest: pass.contentDigest,
        },
      };
    }

    this.passes.set(programKey, [...passHistory, pass]);
    this.emit(streamId, options.tenantId, gate.value.principalId, 'supervision:pass-evaluated', {
      passId: pass.passId,
      passDigest: pass.contentDigest,
      programId: program.programId,
      deliveryId: pass.deliveryId,
      findingCount: pass.findings.length,
      evaluatedAt: pass.evaluatedAt,
    }, pass.evaluatedAt);

    const alertOutcomes: AlertRaiseOutcome[] = [];
    const notifications: NotificationReceipt[] = [];
    const policy = this.activePolicyOf(options.tenantId);
    const notify = options.notify ?? true;

    for (const finding of pass.findings) {
      this.emit(streamId, options.tenantId, gate.value.principalId, 'supervision:finding-produced', {
        findingId: finding.findingId,
        findingDigest: finding.contentDigest,
        findingClass: finding.findingClass,
        findingStatus: finding.status,
        subjectKind: finding.subject.subjectKind,
        subjectId: finding.subject.subjectId,
        passId: pass.passId,
      }, pass.evaluatedAt);

      if (policy === null) {
        continue; // findings are recorded; alerts require an active policy
      }
      const raised = this.raiseForFinding(
        options.tenantId,
        policy,
        finding,
        pass,
        gate.value.principalId,
        streamId,
      );
      if (raised === null) {
        continue;
      }
      alertOutcomes.push(raised.outcome);
      if (raised.outcome.admission === 'raised' && notify) {
        const receipt = this.dispatchNotification(
          options.tenantId,
          policy,
          raised.outcome.alert,
          gate.value.principalId,
          streamId,
          pass.evaluatedAt,
        );
        if (receipt !== null) {
          notifications.push(receipt);
        }
      }
    }

    this.emit(streamId, options.tenantId, gate.value.principalId, 'supervision:projection-updated', {
      programId: program.programId,
      deliveryId: pass.deliveryId,
      passId: pass.passId,
      findingCount: pass.findings.length,
      alertCount: this.alertChainsOf(options.tenantId).length,
      projectedAt: pass.evaluatedAt,
    }, pass.evaluatedAt);

    return {
      ok: true,
      value: { pass, findings: pass.findings, alertOutcomes, notifications },
    };
  }

  /** Raise (or re-evaluate) the alert of one finding against its chain. */
  private raiseForFinding(
    tenantId: string,
    policy: SealedEscalationPolicy,
    finding: SealedSupervisionFinding,
    pass: SealedSupervisionPass,
    principalId: string,
    streamId: string,
  ): { outcome: AlertRaiseOutcome } | null {
    // Find the chain watching this finding (any epoch).
    const chains = this.alertChainsOf(tenantId);
    const existing = chains.find((entry) => entry.findingId === finding.findingId);
    const epoch =
      existing === undefined
        ? 1
        : existing.revisions[existing.revisions.length - 1]!.status === 'resolved'
          ? existing.epoch + 1
          : existing.epoch;
    const alertId = alertIdOf(finding.findingId, epoch);
    const chainKey = tenantKey(tenantId, alertId);
    const chain = existing !== undefined && epoch === existing.epoch ? existing.revisions : [];
    const summary = toFindingSummary(finding, pass);
    const raised = raiseAlert(chain, {
      alertId,
      tenantId,
      summary,
      policy,
      raisedAt: pass.evaluatedAt,
      raisedBy: principalId,
    });
    if (!raised.ok) {
      if (
        raised.error.code === 'lifecycle-conflict' &&
        existing !== undefined &&
        epoch === existing.epoch + 1
      ) {
        // The head is resolved: start the next epoch chain.
        return this.raiseForFinding(tenantId, policy, finding, pass, principalId, streamId);
      }
      return null;
    }
    if (raised.value.admission === 'raised') {
      this.alertChains.set(chainKey, {
        findingId: finding.findingId,
        epoch,
        revisions: [...chain, raised.value.alert],
        notificationCounter: 0,
      });
      this.emit(streamId, tenantId, principalId, 'supervision:alert-raised', {
        alertId: raised.value.alert.alertId,
        alertDigest: raised.value.alert.contentDigest,
        revision: raised.value.alert.revision,
        findingId: raised.value.alert.findingId,
        findingDigest: raised.value.alert.findingDigest,
        severity: raised.value.alert.severity,
        raisedAt: raised.value.alert.raisedAt,
      }, pass.evaluatedAt);
      return { outcome: raised.value };
    }
    if (chain.length > 0) {
      // The head moved (state transition): append the revision.
      this.alertChains.set(chainKey, {
        findingId: finding.findingId,
        epoch,
        revisions: [...chain, raised.value.alert],
        notificationCounter: existing?.notificationCounter ?? 0,
      });
      this.emit(streamId, tenantId, principalId, 'supervision:alert-revised', {
        alertId: raised.value.alert.alertId,
        alertDigest: raised.value.alert.contentDigest,
        revision: raised.value.alert.revision,
        previousRevisionDigest: raised.value.alert.previousRevisionDigest!,
        findingId: raised.value.alert.findingId,
        findingStatus: raised.value.alert.findingStatus,
        severity: raised.value.alert.severity,
        revisedAt: pass.evaluatedAt,
      }, pass.evaluatedAt);
    }
    return { outcome: raised.value };
  }

  /** Dispatch one notification through the port + emit the event. */
  private dispatchNotification(
    tenantId: string,
    policy: SealedEscalationPolicy,
    alert: SealedAlertRecord,
    principalId: string,
    streamId: string,
    dispatchedAt: string,
    notificationId?: string,
  ): NotificationReceipt | null {
    const decision = resolvePolicyRule(policy, alert.findingClass, alert.findingStatus);
    const chainKey = tenantKey(tenantId, alert.alertId);
    const entry = this.alertChains.get(chainKey);
    const counter = (entry?.notificationCounter ?? 0) + 1;
    const id = notificationId ?? `notification:${notificationSlugOf(alert.alertId)}-n${counter}`;
    const built = buildNotification({
      notificationId: id,
      alert,
      channelKind: 'in-app',
      targets: decision.escalation.notify,
      title: alert.title,
      body: `alert ${alert.alertId} (revision ${alert.revision}, severity ${alert.severity}) on finding ${alert.findingId} [${alert.findingClass}/${alert.findingStatus}]`,
      dispatchedAt,
      dispatchedBy: principalId,
    });
    if (!built.ok) {
      return null;
    }
    const receipt = this.notificationPort.dispatch({
      notification: built.value,
      dispatchedAt,
      dispatchedBy: principalId,
    });
    if (!receipt.ok) {
      return null;
    }
    if (entry !== undefined) {
      this.alertChains.set(chainKey, { ...entry, notificationCounter: counter });
    }
    const receipts = this.notifications.get(tenantId) ?? [];
    this.notifications.set(tenantId, [...receipts, receipt.value]);
    this.emit(streamId, tenantId, principalId, 'supervision:notification-dispatched', {
      notificationId: receipt.value.notificationId,
      notificationDigest: receipt.value.notificationDigest,
      alertId: alert.alertId,
      channelKind: receipt.value.channelKind,
      targetCount: decision.escalation.notify.length,
      duplicate: receipt.value.duplicate,
      dispatchedAt,
    }, dispatchedAt);
    return receipt.value;
  }

  // --------------------------------------------------------------------------------
  // Escalation through the gateway seam (policy decision FIRST).
  // --------------------------------------------------------------------------------

  /**
   * Record one gateway decision for an alert escalation: the typed W003
   * proposal + decision are supplied by the caller (the gateway path);
   * a DISPATCHED outcome escalates the chain and notifies the escalation
   * tier. A missing decision is `gateway-decision-missing` BEFORE any
   * kernel admission (the gateway-bypass guard).
   */
  recordGatewayDecision(
    options: RecordGatewayDecisionOptions,
  ): SupervisionServiceResult<GatewayDecisionOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'escalate',
      options.tenantId,
      options.authorization,
      options.alertId,
      'supervision-alert',
    );
    if (!gate.ok) return gate;
    if (options.decision === undefined || options.decision === null) {
      return {
        ok: false,
        error: {
          code: 'gateway-decision-missing',
          message: `the escalation of alert "${options.alertId}" cannot be recorded without a gateway decision — escalation actions are typed proposals through the W022 authority seam (gateway-bypass-rejected)`,
          alertId: options.alertId,
        },
      };
    }
    const chainKey = tenantKey(options.tenantId, options.alertId);
    const entry = this.alertChains.get(chainKey);
    if (entry === undefined || entry.revisions.length === 0) {
      return {
        ok: false,
        error: {
          code: 'unknown-alert',
          message: `alert "${options.alertId}" is not hosted for tenant "${options.tenantId}"`,
          alertId: options.alertId,
        },
      };
    }
    const head = entry.revisions[entry.revisions.length - 1]!;
    const plan = planEscalation({
      alert: head,
      delaySeconds: '0',
      reNotifyCadenceSeconds: '0',
      notify: [],
      escalateTo: [],
    });
    const outcome = recordEscalationOutcome({
      outcomeId: `escalation:${options.alertId
        .slice('alert:'.length)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)}-l${(head.escalationLevel ?? 0) + 1}`,
      tenantId: options.tenantId,
      alert: head,
      proposal: options.proposal,
      decision: options.decision,
      escalationLevel: (head.escalationLevel ?? 0) + 1,
      recordedAt: options.recordedAt,
      recordedBy: gate.value.principalId,
    });
    if (!outcome.ok) {
      return outcome;
    }
    const outcomes = this.escalationOutcomes.get(options.tenantId) ?? [];
    this.escalationOutcomes.set(options.tenantId, [...outcomes, outcome.value]);

    const streamId = this.programStreamOfAlert(options.tenantId);
    let escalatedAlert: SealedAlertRecord | null = null;
    const notifications: NotificationReceipt[] = [];
    if (outcome.value.outcomeKind === 'dispatched') {
      const escalated = escalateAlert(entry.revisions, {
        escalatedAt: options.recordedAt,
        escalationLevel: outcome.value.escalationLevel,
      });
      if (escalated.ok) {
        escalatedAlert = escalated.value;
        this.alertChains.set(chainKey, { ...entry, revisions: [...entry.revisions, escalated.value] });
      }
    }
    this.emit(streamId, options.tenantId, gate.value.principalId, 'supervision:alert-escalated', {
      alertId: outcome.value.alertId,
      alertDigest: outcome.value.alertDigest,
      revision: head.revision,
      escalationLevel: outcome.value.escalationLevel,
      outcomeKind: outcome.value.outcomeKind,
      proposalDigest: outcome.value.proposalDigest,
      escalatedAt: options.recordedAt,
    }, options.recordedAt);

    if (escalatedAlert !== null && (options.notify ?? true)) {
      const policy = this.activePolicyOf(options.tenantId);
      if (policy !== null) {
        const decision = resolvePolicyRule(policy, escalatedAlert.findingClass, escalatedAlert.findingStatus);
        void plan;
        void decision;
        const receipt = this.dispatchNotification(
          options.tenantId,
          policy,
          escalatedAlert,
          gate.value.principalId,
          streamId,
          options.recordedAt,
        );
        if (receipt !== null) {
          notifications.push(receipt);
        }
      }
    }
    return { ok: true, value: { outcome: outcome.value, alert: escalatedAlert, notifications } };
  }

  /** Resolve one alert chain (terminal). */
  resolveAlertService(
    options: ResolveAlertOptions,
  ): SupervisionServiceResult<SealedAlertRecord> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'resolve',
      options.tenantId,
      options.authorization,
      options.alertId,
      'supervision-alert',
    );
    if (!gate.ok) return gate;
    const chainKey = tenantKey(options.tenantId, options.alertId);
    const entry = this.alertChains.get(chainKey);
    if (entry === undefined || entry.revisions.length === 0) {
      return {
        ok: false,
        error: {
          code: 'unknown-alert',
          message: `alert "${options.alertId}" is not hosted for tenant "${options.tenantId}"`,
          alertId: options.alertId,
        },
      };
    }
    const resolved = resolveAlert(entry.revisions, {
      resolvedAt: options.resolvedAt,
      resolvedBy: gate.value.principalId,
      resolutionKind: options.resolutionKind,
    });
    if (!resolved.ok) {
      return resolved;
    }
    this.alertChains.set(chainKey, { ...entry, revisions: [...entry.revisions, resolved.value] });
    const streamId = this.programStreamOfAlert(options.tenantId);
    this.emit(streamId, options.tenantId, gate.value.principalId, 'supervision:alert-resolved', {
      alertId: resolved.value.alertId,
      alertDigest: resolved.value.contentDigest,
      revision: resolved.value.revision,
      resolutionKind: resolved.value.resolutionKind,
      resolvedAt: resolved.value.resolvedAt!,
    }, options.resolvedAt);
    return { ok: true, value: resolved.value };
  }

  // --------------------------------------------------------------------------------
  // The notification sweep (policy-driven re-notify cadence).
  // --------------------------------------------------------------------------------

  /**
   * Run one notification sweep at a caller-driven instant: every
   * non-resolved alert whose last notification is older than the
   * policy's re-notify cadence re-notifies (a NEW notification record
   * per cadence tick; replay-safe through the port).
   */
  runNotificationSweep(
    options: NotificationSweepOptions,
  ): SupervisionServiceResult<readonly NotificationReceipt[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'notify',
      options.tenantId,
      options.authorization,
      'notification-sweep',
      'supervision-notification',
    );
    if (!gate.ok) return gate;
    const policy = this.activePolicyOf(options.tenantId);
    if (policy === null) {
      return { ok: true, value: [] };
    }
    const receipts: NotificationReceipt[] = [];
    for (const entry of this.alertChainsOf(options.tenantId)) {
      const head = entry.revisions[entry.revisions.length - 1]!;
      if (head.status === 'resolved') {
        continue;
      }
      const lastDispatchedAt = this.lastDispatchedAtOf(options.tenantId, head.alertId);
      if (lastDispatchedAt === null) {
        continue;
      }
      const decision = resolvePolicyRule(policy, head.findingClass, head.findingStatus);
      const cadenceMs = Number(decision.escalation.reNotifyCadenceSeconds) * 1000;
      const elapsed = instantToEpochMs(options.asOf) - instantToEpochMs(lastDispatchedAt);
      if (elapsed < cadenceMs || cadenceMs <= 0) {
        continue;
      }
      const streamId = this.programStreamOfAlert(options.tenantId);
      const receipt = this.dispatchNotification(
        options.tenantId,
        policy,
        head,
        gate.value.principalId,
        streamId,
        options.asOf,
      );
      if (receipt !== null) {
        receipts.push(receipt);
      }
    }
    return { ok: true, value: receipts };
  }

  private lastDispatchedAtOf(tenantId: string, alertId: string): string | null {
    const receipts = this.notifications.get(tenantId) ?? [];
    const prefix = `notification:${notificationSlugOf(alertId)}-n`;
    const sorted = receipts
      .filter((receipt) => receipt.notificationId.startsWith(prefix))
      .sort((a, b) => (a.acceptedAt < b.acceptedAt ? -1 : 1));
    return sorted.length > 0 ? sorted[sorted.length - 1]!.acceptedAt : null;
  }

  // --------------------------------------------------------------------------------
  // Projections + reads.
  // --------------------------------------------------------------------------------

  /** The derived supervision-state projection (findings + alert chains + receipts). */
  supervisionState(
    options: SupervisionStateOptions,
  ): SupervisionServiceResult<SupervisionHostProjection> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.programId,
      'supervision-projection',
    );
    if (!gate.ok) return gate;
    const programKey = tenantKey(options.tenantId, options.programId);
    const program = this.programs.get(programKey);
    if (program === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-program',
          message: `program "${options.programId}" is not registered for tenant "${options.tenantId}"`,
          programId: options.programId,
        },
      };
    }
    const passes = this.passes.get(programKey) ?? [];
    const fold = foldAlertChains(this.alertChainsOf(options.tenantId).map((entry) => entry.revisions));
    return {
      ok: true,
      value: {
        supervision: projectSupervisionState(passes),
        alerts: {
          chains: fold.chains.map((row) => ({
            alertId: row.alertId,
            revisionCount: row.revisionCount,
            status: row.status,
            severity: row.severity,
            findingId: row.findingId,
            findingStatus: row.findingStatus,
            raisedAt: row.raisedAt,
            headDigest: row.headDigest,
          })),
          counts: fold.counts as Readonly<Record<string, number>>,
        },
        notifications: [...(this.notifications.get(options.tenantId) ?? [])].sort((a, b) =>
          a.notificationId < b.notificationId ? -1 : 1,
        ),
        escalationOutcomes: [...(this.escalationOutcomes.get(options.tenantId) ?? [])],
      },
    };
  }

  /** Read one supervision event stream (sealed facts). */
  readStream(options: StreamReadOptions): SupervisionServiceResult<readonly SealedSupervisionEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.streamId,
      'supervision-stream',
    );
    if (!gate.ok) return gate;
    const events = this.streams.get(options.streamId) ?? [];
    const tenant = events.length > 0 ? events[0]!.tenantId : null;
    if (tenant !== null && tenant !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `stream "${options.streamId}" belongs to tenant "${tenant}" — it cannot be read as tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: tenant,
          subject: options.streamId,
        },
      };
    }
    return { ok: true, value: [...events] };
  }

  /** Runtime health counters. */
  health(): RuntimeHealth {
    return {
      programCount: this.programs.size,
      deliveryCount: this.deliveries.size,
      policyCount: [...this.policies.values()].reduce((sum, perTenant) => sum + perTenant.size, 0),
      passCount: [...this.passes.values()].reduce((sum, passes) => sum + passes.length, 0),
      alertChainCount: [...this.alertChains.keys()].length,
      notificationCount: [...this.notifications.values()].reduce((sum, receipts) => sum + receipts.length, 0),
      eventCount: [...this.streams.values()].reduce((sum, events) => sum + events.length, 0),
    };
  }

  /** The deterministic runtime snapshot (sorted; no insertion-order leaks). */
  snapshot(): RuntimeSnapshot {
    const programs = [...this.programs.values()]
      .map((program) => ({ programId: program.programId, programDigest: program.contentDigest }))
      .sort((a, b) => (a.programId < b.programId ? -1 : 1));
    const deliveries = [...this.deliveries.entries()]
      .map(([key, entry]) => ({
        deliveryId: entry.delivery.deliveryId,
        deliveryDigest: entry.delivery.contentDigest,
        programId: entry.programId,
        _key: key,
      }))
      .sort((a, b) => (a.deliveryId < b.deliveryId ? -1 : 1))
      .map(({ deliveryId, deliveryDigest, programId }) => ({ deliveryId, deliveryDigest, programId }));
    const policies: { policyId: string; policyDigest: string; policyVersion: string }[] = [];
    for (const perTenant of this.policies.values()) {
      for (const policy of perTenant.values()) {
        policies.push({
          policyId: policy.policyId,
          policyDigest: policy.contentDigest,
          policyVersion: policy.policyVersion,
        });
      }
    }
    policies.sort((a, b) => (a.policyId < b.policyId ? -1 : 1));
    const streams = [...this.streams.entries()]
      .map(([streamId, events]) => ({ streamId, eventCount: events.length }))
      .sort((a, b) => (a.streamId < b.streamId ? -1 : 1));
    return { programs, deliveries, policies, streams, health: this.health() };
  }

  // --------------------------------------------------------------------------------
  // Private helpers.
  // --------------------------------------------------------------------------------

  private alertChainsOf(tenantId: string): AlertChainEntry[] {
    const prefix = `${tenantId}#`;
    return [...this.alertChains.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry);
  }

  private programStreamOfAlert(tenantId: string): string {
    // Alerts derive from delivery-supervised programs; the stream anchor is
    // the delivery-registered program of the tenant (deterministic: the
    // earliest registered program id).
    const programIds = [...this.deliveries.entries()]
      .filter(([, entry]) => entry.delivery.tenantId === tenantId)
      .map(([, entry]) => entry.programId)
      .sort();
    if (programIds.length > 0) {
      return supervisionStreamIdOf(programIds[0]!);
    }
    return supervisionHostStreamIdOf(tenantId);
  }
}

/** Constructor-options alias (kept structural for the type import above). */
interface SupervisionRuntimeOptionsLike {
  readonly expectedTenantId?: string | undefined;
  readonly notificationPort?: NotificationPort | undefined;
}

export { RUNTIME_RECORD_VERSION };
