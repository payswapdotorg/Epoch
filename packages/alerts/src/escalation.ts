/**
 * ESCALATION through the W022 authority seam (the W043 pin):
 *
 * - escalation ACTIONS are TYPED W003 ACTION PROPOSALS
 *   (`buildEscalationProposal` — action type
 *   `supervision.alert.escalate`, authority scope `supervision:alert`,
 *   predicted effects, reversibility): agents propose; the Action
 *   Gateway authorizes execution — this kernel NEVER executes anything;
 * - the POLICY DECISION COMES FIRST: an escalation outcome is recorded
 *   ONLY against a verifiable W003 `AuthorizationDecision` bound to the
 *   EXACT proposal revision (digest + id). A missing, unverifiable, or
 *   unbound decision is a typed `gateway-bypass-rejected`;
 * - the three decision outcomes map to typed outcome records:
 *   `authorized` -> dispatched, `denied` -> blocked-by-gateway,
 *   `escalated` (to a human approver) -> awaiting-approval;
 * - outcome records are DATA: they carry no execution side effects —
 *   dispatching the escalation notification is the host's notification
 *   port concern, not this kernel's.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  ActionProposalSchema,
  parseAuthorizationDecision,
  type ActionProposal,
  type AuthorizationDecision,
} from '@epoch/action-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  AlertsPrincipalIdSchema,
  EscalationOutcomeIdSchema,
} from './primitives';
import {
  ALERTS_RECORD_VERSION,
  ESCALATION_ACTION_TYPE_ID,
  ESCALATION_ACTION_TYPE_VERSION,
  ESCALATION_AUTHORITY_SCOPE,
  ESCALATION_OUTCOME_KINDS,
  ESCALATION_OUTCOME_SCHEMA_NAME,
} from './version';
import type { EscalationOutcomeKind } from './version';
import type { SealedAlertRecord } from './alerts';
import { hasUnrecognizedKeys, validationError, vendorFieldsError, gatewayBypassError } from './issues';
import type { AlertsResult } from './errors';

// --------------------------------------------------------------------------------
// The escalation plan (policy data; the host drives the clock).
// --------------------------------------------------------------------------------

/** One planned escalation tier (derived from the policy path; pure data). */
export interface EscalationPlan {
  readonly alertId: string;
  readonly alertDigest: string;
  readonly revision: number;
  readonly escalationLevel: number;
  readonly delaySeconds: string;
  readonly reNotifyCadenceSeconds: string;
  readonly notify: readonly { targetKind: string; targetRef: string }[];
  readonly escalateTo: readonly { targetKind: string; targetRef: string }[];
}

/** Options of one escalation-plan construction. */
export interface PlanEscalationOptions {
  readonly alert: SealedAlertRecord;
  readonly delaySeconds: string;
  readonly reNotifyCadenceSeconds: string;
  readonly notify: readonly { targetKind: string; targetRef: string }[];
  readonly escalateTo: readonly { targetKind: string; targetRef: string }[];
}

/** Derive the escalation plan of one alert from the policy path (pure). */
export function planEscalation(options: PlanEscalationOptions): EscalationPlan {
  const sortTargets = (targets: readonly { targetKind: string; targetRef: string }[]) =>
    [...targets].sort((a, b) =>
      a.targetKind !== b.targetKind
        ? a.targetKind < b.targetKind
          ? -1
          : 1
        : a.targetRef < b.targetRef
          ? -1
          : 1,
    );
  return {
    alertId: options.alert.alertId,
    alertDigest: options.alert.contentDigest,
    revision: options.alert.revision,
    escalationLevel: (options.alert.escalationLevel ?? 0) + 1,
    delaySeconds: options.delaySeconds,
    reNotifyCadenceSeconds: options.reNotifyCadenceSeconds,
    notify: sortTargets(options.notify),
    escalateTo: sortTargets(options.escalateTo),
  };
}

// --------------------------------------------------------------------------------
// The escalation action proposal (W003 shapes; the gateway authorizes).
// --------------------------------------------------------------------------------

/** Options of one escalation-proposal construction. */
export interface BuildEscalationProposalOptions {
  readonly alert: SealedAlertRecord;
  readonly plan: EscalationPlan;
  readonly proposalId: string;
  readonly messageId: string;
  readonly proposedBy: string;
  readonly createdAt: string;
  readonly rationale?: string | undefined;
}

/** The exact-revision digest of a W003 proposal (canonical JSON). */
export function computeProposalDigest(proposal: ActionProposal): Sha256Hex {
  return canonicalDigest(proposal as unknown as JsonValue);
}

/**
 * Build the typed W003 action proposal for one escalation: the alerts
 * kernel PROPOSES (agents propose; the Action Gateway authorizes —
 * architecture lock rules 2/3). The proposal targets the alert's
 * subject, requests the `supervision:alert` scope, and carries the
 * escalation level in its parameters.
 */
export function buildEscalationProposal(
  options: BuildEscalationProposalOptions,
): AlertsResult<ActionProposal> {
  const proposal = {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: options.messageId,
    createdAt: options.createdAt,
    proposalId: options.proposalId,
    proposedBy: options.proposedBy,
    actionType: {
      id: ESCALATION_ACTION_TYPE_ID,
      version: ESCALATION_ACTION_TYPE_VERSION,
    },
    target: {
      kind: 'external-resource',
      ref: options.alert.subjectId,
    },
    parameters: {
      alert_id: options.alert.alertId,
      alert_revision: options.alert.revision,
      escalation_level: options.plan.escalationLevel,
      finding_class: options.alert.findingClass,
      severity: options.alert.severity,
    },
    preconditions: [
      {
        description: `alert ${options.alert.alertId} at revision ${options.alert.revision} is not resolved`,
      },
    ],
    predictedEffects: [
      {
        description: `the escalation notification for alert ${options.alert.alertId} reaches escalation level ${options.plan.escalationLevel}`,
        confidence: { kind: 'qualitative', level: 'high' },
      },
    ],
    sideEffects: [
      {
        description: 'the escalation records an audit trail entry in the alert chain',
        reversible: true,
      },
    ],
    reversibility: { kind: 'reversible', via: 'compensating-action' },
    authorityRequirements: {
      requiredScopes: [ESCALATION_AUTHORITY_SCOPE],
      requiresHumanApproval: false,
    },
    ...(options.rationale !== undefined ? { rationale: options.rationale } : {}),
  };
  const parsed = ActionProposalSchema.safeParse(proposal);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The escalation outcome record (policy decision FIRST).
// --------------------------------------------------------------------------------

/** The immutable content of one escalation outcome. */
export const EscalationOutcomeContentSchema = z
  .strictObject({
    schema: z.literal(ESCALATION_OUTCOME_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    outcomeId: EscalationOutcomeIdSchema,
    tenantId: TenantIdSchema,
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: z.string().regex(/^[0-9a-f]{64}$/),
    alertRevision: z.number().int().min(1),
    escalationLevel: z.number().int().min(1),
    outcomeKind: z.enum(ESCALATION_OUTCOME_KINDS),
    proposalId: z.string().min(1).max(128),
    proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decisionMessageId: z.string().min(1).max(128),
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decidedByRole: z.enum(['action-gateway', 'human-approver']),
    recordedAt: TimestampSchema,
    recordedBy: AlertsPrincipalIdSchema,
  })
  .readonly()
  .meta({
    id: 'EscalationOutcomeContent',
    title: 'EscalationOutcomeContent',
    description:
      'The immutable content of one escalation outcome: the alert revision it concerns, the gateway decision binding (proposal digest + decision digest + authorizer role), the outcome kind, and recording provenance.',
  });

/** One escalation outcome content. */
export type EscalationOutcomeContent = z.infer<typeof EscalationOutcomeContentSchema>;

/** The SEALED escalation outcome: content plus its SHA-256 content digest. */
export const SealedEscalationOutcomeSchema = z
  .strictObject({
    schema: z.literal(ESCALATION_OUTCOME_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    outcomeId: EscalationOutcomeIdSchema,
    tenantId: TenantIdSchema,
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: z.string().regex(/^[0-9a-f]{64}$/),
    alertRevision: z.number().int().min(1),
    escalationLevel: z.number().int().min(1),
    outcomeKind: z.enum(ESCALATION_OUTCOME_KINDS),
    proposalId: z.string().min(1).max(128),
    proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decisionMessageId: z.string().min(1).max(128),
    decisionDigest: z.string().regex(/^[0-9a-f]{64}$/),
    decidedByRole: z.enum(['action-gateway', 'human-approver']),
    recordedAt: TimestampSchema,
    recordedBy: AlertsPrincipalIdSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedEscalationOutcome',
    title: 'SealedEscalationOutcome',
    description:
      'The sealed escalation outcome: immutable gateway-decision record plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed escalation outcome. */
export type SealedEscalationOutcome = z.infer<typeof SealedEscalationOutcomeSchema>;

/** Options of one outcome recording. */
export interface RecordEscalationOutcomeOptions {
  readonly outcomeId: string;
  readonly tenantId: string;
  readonly alert: SealedAlertRecord;
  readonly proposal: ActionProposal;
  readonly decision: AuthorizationDecision;
  readonly escalationLevel: number;
  readonly recordedAt: string;
  readonly recordedBy: string;
}

/** The typed mapping of a W003 decision to an escalation outcome kind. */
export function outcomeKindOfDecision(decision: AuthorizationDecision): EscalationOutcomeKind {
  if (decision.decision.kind === 'authorized') {
    return 'dispatched';
  }
  if (decision.decision.kind === 'denied') {
    return 'blocked-by-gateway';
  }
  return 'awaiting-approval';
}

/**
 * RECORD one escalation outcome — the ONLY constructor, and it demands
 * the verifiable gateway decision FIRST:
 *
 * - the decision parses through the REAL W003 pipeline
 *   (`parseAuthorizationDecision`);
 * - the decision must bind the EXACT proposal revision
 *   (`proposalRef.proposalId` + `proposalRef.canonicalDigest`) — an
 *   unbound decision is `gateway-bypass-rejected` (proposal-unbound);
 * - the alert revision must match the proposal's parameters
 *   (alertRevision) — a stale proposal is `replay-conflict`;
 * - the tenant scope must match the alert's (R12).
 */
export function recordEscalationOutcome(
  options: RecordEscalationOutcomeOptions,
): AlertsResult<SealedEscalationOutcome> {
  const parsed = parseAuthorizationDecision(options.decision);
  if (!parsed.ok) {
    return {
      ok: false,
      error: gatewayBypassError(options.outcomeId, 'decision-unverifiable'),
    };
  }
  const decision = parsed.value;
  const proposalDigest = computeProposalDigest(options.proposal);
  if (
    decision.proposalRef.proposalId !== options.proposal.proposalId ||
    decision.proposalRef.canonicalDigest !== proposalDigest
  ) {
    return {
      ok: false,
      error: gatewayBypassError(options.outcomeId, 'proposal-unbound'),
    };
  }
  if (options.proposal.parameters['alert_revision'] !== options.alert.revision) {
    return {
      ok: false,
      error: {
        code: 'replay-conflict',
        message: `the escalation proposal targets alert revision ${String(options.proposal.parameters['alert_revision'])} but the alert head is at revision ${options.alert.revision} — a stale proposal is replayed against a newer chain head`,
        subject: options.alert.alertId,
        publishedDigest: options.alert.contentDigest,
        encounteredDigest: options.alert.contentDigest,
      },
    };
  }
  const content: EscalationOutcomeContent = {
    schema: ESCALATION_OUTCOME_SCHEMA_NAME,
    schemaVersion: ALERTS_RECORD_VERSION,
    outcomeId: options.outcomeId,
    tenantId: options.tenantId,
    alertId: options.alert.alertId,
    alertDigest: options.alert.contentDigest,
    alertRevision: options.alert.revision,
    escalationLevel: options.escalationLevel,
    outcomeKind: outcomeKindOfDecision(decision),
    proposalId: options.proposal.proposalId,
    proposalDigest,
    decisionMessageId: decision.messageId,
    decisionDigest: canonicalDigest(decision as unknown as JsonValue),
    decidedByRole: decision.decidedBy.role,
    recordedAt: options.recordedAt,
    recordedBy: options.recordedBy,
  };
  return { ok: true, value: { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) } };
}

/**
 * Verify a sealed escalation outcome (envelope admission of externally
 * supplied records): schema + digest recomputation. An outcome record
 * that claims an EXECUTION effect (a `dispatchedEffect` /
 * `executedAt` field) is `gateway-bypass-rejected` — outcome records
 * are data, never execution receipts.
 */
export function verifySealedEscalationOutcome(sealed: unknown): AlertsResult<SealedEscalationOutcome> {
  if (typeof sealed === 'object' && sealed !== null) {
    for (const effectField of ['dispatchedEffect', 'executedAt', 'executionReceipt']) {
      if (effectField in sealed) {
        return {
          ok: false,
          error: gatewayBypassError(effectField, 'decision-missing'),
        };
      }
    }
  }
  const parsed = SealedEscalationOutcomeSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed escalation outcome digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.outcomeId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
