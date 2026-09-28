/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), the
 * pass outcomes (findings + alert admissions + notification receipts),
 * and the NotificationPort adapter seam passthrough (external channels
 * live BEHIND it; the core never names a vendor).
 */
import type {
  AlertsError,
  AlertRaiseOutcome,
  NotificationPort,
  NotificationReceipt,
  SealedAlertRecord,
  SealedEscalationOutcome,
  SealedEscalationPolicy,
  SealedNotificationRecord,
  EscalationPlan,
} from '@epoch/alerts';
import type { ActionProposal, AuthorizationDecision } from '@epoch/alerts';
import type {
  ExecutionIssueSummary,
  LeadTimeRiskInput,
  SealedSupervisionFinding,
  SealedSupervisionPass,
  SupervisionError,
  SupervisionStateProjection,
  SupervisionThresholds,
} from '@epoch/supervision';
import type {
  InformationAcquisitionRequest,
  SealedDeliveryRecord,
  SealedProgramOfWork,
} from '@epoch/supervision';
import type { AuthorizationContext } from '@epoch/authorization';

/** The sealed W036 authorities (re-exported for one-stop consumption). */
export type { SealedProgramOfWork, SealedDeliveryRecord, InformationAcquisitionRequest };
export type { SealedEscalationPolicy, SealedNotificationRecord, NotificationPort };
export type { SupervisionStateProjection, SupervisionThresholds };
export type { ExecutionIssueSummary, LeadTimeRiskInput };
export type { AlertRaiseOutcome, NotificationReceipt, SealedAlertRecord, SealedEscalationOutcome };
export type { EscalationPlan };
export type { ActionProposal, AuthorizationDecision };

/** The typed service-error union: kernel errors + service-owned codes. */
export type SupervisionServiceError =
  | SupervisionError
  | AlertsError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-program';
      readonly message: string;
      readonly programId: string;
    }
  | {
      readonly code: 'unknown-delivery';
      readonly message: string;
      readonly deliveryId: string;
    }
  | {
      readonly code: 'unknown-policy';
      readonly message: string;
      readonly policyId: string;
    }
  | {
      readonly code: 'unknown-alert';
      readonly message: string;
      readonly alertId: string;
    }
  | {
      readonly code: 'gateway-decision-missing';
      readonly message: string;
      readonly alertId: string;
    };

/** Total-result wrapper of every service entry point. */
export type SupervisionServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SupervisionServiceError };

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of the {@link SupervisionRuntime} constructor. */
export interface SupervisionRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The NotificationPort adapter seam (external channels). Defaults to
   * the in-memory reference adapter. The core never names a vendor.
   */
  readonly notificationPort?: NotificationPort | undefined;
}

/** Options of program registration. */
export interface RegisterProgramOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly program: SealedProgramOfWork;
}

/** Options of delivery registration. */
export interface RegisterDeliveryOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly delivery: SealedDeliveryRecord;
}

/** Options of policy registration. */
export interface RegisterPolicyOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly policy: unknown;
}

/** Options of one evaluation pass. */
export interface RunEvaluationPassOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly passId: string;
  readonly programId: string;
  readonly deliveryId: string;
  readonly evaluatedAt: string;
  readonly executionIssues?: readonly unknown[] | undefined;
  readonly leadTimeInputs?: readonly unknown[] | undefined;
  readonly infoRequests?: readonly unknown[] | undefined;
  readonly thresholds?: SupervisionThresholds | undefined;
  /** Whether raised/revised alerts dispatch notifications immediately (default true). */
  readonly notify?: boolean | undefined;
}

/** The outcome of one evaluation pass. */
export interface EvaluationPassOutcome {
  readonly pass: SealedSupervisionPass;
  readonly findings: readonly SealedSupervisionFinding[];
  readonly alertOutcomes: readonly AlertRaiseOutcome[];
  readonly notifications: readonly NotificationReceipt[];
}

/** Options of one gateway-decision recording (the escalation path). */
export interface RecordGatewayDecisionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly alertId: string;
  readonly proposal: ActionProposal;
  readonly decision: AuthorizationDecision;
  readonly recordedAt: string;
  /** Whether a dispatched outcome escalates the alert chain + notifies the escalation tier (default true). */
  readonly notify?: boolean | undefined;
}

/** The outcome of one gateway-decision recording. */
export interface GatewayDecisionOutcome {
  readonly outcome: SealedEscalationOutcome;
  readonly alert: SealedAlertRecord | null;
  readonly notifications: readonly NotificationReceipt[];
}

/** Options of one alert resolution. */
export interface ResolveAlertOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly alertId: string;
  readonly resolvedAt: string;
  readonly resolutionKind: 'remediated' | 'false-positive' | 'withdrawn';
}

/** Options of one notification sweep (policy-driven re-notify cadence). */
export interface NotificationSweepOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly asOf: string;
}

/** Options of the supervision-state projection read. */
export interface SupervisionStateOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly programId: string;
}

/** Options of the stream read. */
export interface StreamReadOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly streamId: string;
}

/** The derived supervision-state projection (findings + alert chains). */
export interface SupervisionHostProjection {
  readonly supervision: SupervisionStateProjection;
  readonly alerts: {
    readonly chains: readonly {
      readonly alertId: string;
      readonly revisionCount: number;
      readonly status: string;
      readonly severity: string;
      readonly findingId: string;
      readonly findingStatus: string;
      readonly raisedAt: string;
      readonly headDigest: string;
    }[];
    readonly counts: Readonly<Record<string, number>>;
  };
  readonly notifications: readonly NotificationReceipt[];
  readonly escalationOutcomes: readonly SealedEscalationOutcome[];
}

/** Runtime health counters. */
export interface RuntimeHealth {
  readonly programCount: number;
  readonly deliveryCount: number;
  readonly policyCount: number;
  readonly passCount: number;
  readonly alertChainCount: number;
  readonly notificationCount: number;
  readonly eventCount: number;
}

/** The deterministic runtime snapshot (sorted; no insertion-order leaks). */
export interface RuntimeSnapshot {
  readonly programs: readonly { programId: string; programDigest: string }[];
  readonly deliveries: readonly { deliveryId: string; deliveryDigest: string; programId: string }[];
  readonly policies: readonly { policyId: string; policyDigest: string; policyVersion: string }[];
  readonly streams: readonly { streamId: string; eventCount: number }[];
  readonly health: RuntimeHealth;
}
