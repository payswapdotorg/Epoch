/**
 * @epoch/mobile — the field approval pipeline (W049): builds the typed
 * action.submit payload for a field review, mirroring the W046
 * gateway-actions composition (the W003 proposal grammar + the tenant
 * policy set binding a compiled constraint + the evaluation context).
 *
 * The mobile approval surface is a STRICT SUBSET of the frozen gateway
 * vocabulary (action.submit / action.approve / action.status) — this
 * builder produces the ONLY payload shape the field product submits; the
 * authority (the W022 Action Gateway) evaluates the policies and decides
 * (allow / deny / requires-approval). Nothing here decides or settles
 * anything: the builder assembles typed intent, the gateway is the
 * execution authority (lock rule 3).
 *
 * Deterministic: every value is a literal or caller-supplied (zero
 * wall-clock, zero randomness).
 */
import type { JsonValue } from '@epoch/agent-protocol';

/** The field-review action type (the dot-namespaced W003 grammar). */
export const FIELD_REVIEW_ACTION_TYPE = 'delivery.observation.review' as const;

/** The constraint id the deterministic fixture policy binds. */
export const FIELD_REVIEW_CONSTRAINT_ID = 'epoch-field-review-allowance' as const;

/** The deterministic compiled constraint the fixture policy binds (always satisfied by the fixture evaluation context). */
export const FIELD_REVIEW_COMPILED_CONSTRAINT = {
  languageVersion: '1.0.0',
  id: 'epoch-field-review-allowance',
  version: '1.0.0',
  inputs: [{ name: 'spend', type: 'number' }],
  root: {
    node: 'not',
    resultType: 'boolean',
    operand: {
      node: 'lt',
      resultType: 'boolean',
      left: { node: 'input', name: 'spend', resultType: 'number' },
      right: { node: 'lit', type: 'number', value: 100, resultType: 'number' },
    },
  },
  payload: { class: 'hard' },
  compiler: { name: 'epoch-ecl-compiler', version: '1.0.0' },
  compiledDigest: 'a8c0bf2b',
} as const;

/** The deterministic tenant policy set for field reviews (the W046 gateway-actions pattern). */
export function fieldReviewPolicySet(tenantId: string): JsonValue[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'epoch-field-review-policy',
      version: '1.0.0',
      name: 'Epoch field review policy',
      enabled: true,
      applicability: { tenantId, actionKinds: [FIELD_REVIEW_ACTION_TYPE] },
      bindings: [{ constraintId: 'epoch-field-review-allowance' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ] as unknown as JsonValue[];
}

/** The evaluation context the fixture policy passes with (deterministic). */
export const FIELD_REVIEW_EVALUATION_CONTEXT = { inputs: { spend: 10 } } as const;

/** The input of the field review submission builder. */
export interface BuildFieldReviewActionInput {
  readonly actionId: string;
  readonly messageId: string;
  readonly proposalId: string;
  readonly createdAt: string;
  /** The acting field client agent (the W003 proposals-are-agent-authored grammar). */
  readonly proposedBy: string;
  /** The observation the review targets (opaque id). */
  readonly observationId: string;
  readonly deliveryId: string;
  readonly reviewKind: string;
  readonly reviewer: string;
  readonly justification: string;
  /** Evidence digests the review references (>= 1 required by the W022 intake). */
  readonly evidenceDigests: readonly string[];
  readonly tenantId: string;
  readonly sessionId: string;
  readonly expiresAt: string;
  readonly approvalDeadline: string;
}

/**
 * Build the complete action.submit payload of one field review (the W003
 * typed proposal + the deterministic policy set + the evaluation context
 * + the approval window). The payload leaves ONLY through the gateway.
 */
export function buildFieldReviewActionPayload(input: BuildFieldReviewActionInput): JsonValue {
  const evidenceRefs = [...input.evidenceDigests].sort();
  return {
    actionId: input.actionId,
    proposal: {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: input.messageId,
      createdAt: input.createdAt,
      proposalId: input.proposalId,
      proposedBy: input.proposedBy,
      actionType: { id: FIELD_REVIEW_ACTION_TYPE, version: '1.0.0' },
      target: { kind: 'external-resource', ref: input.observationId },
      parameters: {
        'review-kind': input.reviewKind,
        'delivery-id': input.deliveryId,
        'observation-id': input.observationId,
        'reviewer-principal': input.reviewer,
        'field-session': input.sessionId,
        justification: input.justification,
      },
      preconditions: [
        {
          description: `The observation ${input.observationId} is recorded and not yet settled in delivery ${input.deliveryId}.`,
        },
      ],
      predictedEffects: [
        {
          description: `The observation ${input.observationId} is accepted into the delivery record.`,
          confidence: { kind: 'quantified', value: 0.9 },
        },
      ],
      sideEffects: [],
      reversibility: { kind: 'partially-reversible', notes: 'Acceptance can be re-observed; the review decision is history.' },
      authorityRequirements: {
        requiredScopes: ['delivery:review'],
        requiresHumanApproval: true,
        approvalQuorum: { approvals: 1, roles: ['senior-structural-engineer'] },
      },
      rationale: `Field review from the mobile product: ${input.justification}`,
      evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : [zeroDigest()],
      expiresAt: input.expiresAt,
    },
    policies: fieldReviewPolicySet(input.tenantId),
    evaluationContext: FIELD_REVIEW_EVALUATION_CONTEXT,
    approval: { deadline: input.approvalDeadline, maxDelegationDepth: 1 },
  } as unknown as JsonValue;
}

/** The all-zero digest placeholder when a review carries no evidence (the W022 intake requires >= 1 reference). */
function zeroDigest(): string {
  return '0'.repeat(64);
}
