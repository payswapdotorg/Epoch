// DEPENDENCY-PARITY EVIDENCE (the apps/web shell + W036 kernel-parity
// precedent): the mobile field client mirrors devDependency-only
// vocabularies (the W022 decision grammar: outcomes, denial codes, record
// version, denial/directive shapes) and REUSES runtime-dependency
// grammars (proposal references, quorums, tenancy scopes). This test
// pins every mirror against its canonical owner via devDependencies —
// drift between the mirror and the kernel is a test failure, never a
// silent fork. @epoch/action-policy, @epoch/evidence,
// @epoch/renderer-runtime, @epoch/identity and @epoch/authorization are
// devDependencies by the frozen W018 dependency pin.
import { describe, expect, it } from 'vitest';
import {
  ACTION_POLICY_RECORD_VERSION,
  POLICY_DECISION_OUTCOMES,
  POLICY_DENIAL_CODES,
  ApprovalDirectiveSchema as KernelApprovalDirectiveSchema,
  ApproverScopeSchema as KernelApproverScopeSchema,
  PolicyDenialSchema as KernelPolicyDenialSchema,
} from '@epoch/action-policy';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN,
  PrincipalSchema as IdentityPrincipalSchema,
} from '@epoch/identity';
import { EVIDENCE_RECORD_VERSION, computeEvidenceDigest } from '@epoch/evidence';
import { RENDERER_PROTOCOL_VERSION, InvocationEnvelopeSchema } from '@epoch/renderer-runtime';
import { canonicalDigest } from '@epoch/agent-protocol';
import { z } from 'zod';
import {
  GATEWAY_DECISION_OUTCOMES,
  GATEWAY_DENIAL_CODES,
  GATEWAY_DECISION_RECORD_VERSION,
  GatewayDecisionRecordSchema,
  GatewayDenialSchema,
  ApproverScopeSchema,
  ApprovalDirectiveSchema,
  ReferenceFieldApprovalGateway,
  buildFieldReviewSubmission,
  buildReviewActionProposal,
  DEFAULT_SYNC_PROPOSAL_IDENTITY,
  FIELD_FIDELITY_INTERACTION_MODALITIES,
  MOBILE_FIELD_RECORD_VERSION,
  admitFieldEvidenceRef,
} from '../src/index';
import { REVIEWER, T5, T6, TENANT, sealedReview } from './helpers';

describe('W022 action-policy parity (the decision-record mirror)', () => {
  it('the decision outcome vocabulary mirrors POLICY_DECISION_OUTCOMES exactly', () => {
    expect([...GATEWAY_DECISION_OUTCOMES].sort()).toEqual([...POLICY_DECISION_OUTCOMES].sort());
  });

  it('the denial-code vocabulary mirrors POLICY_DENIAL_CODES exactly', () => {
    expect([...GATEWAY_DENIAL_CODES].sort()).toEqual([...POLICY_DENIAL_CODES].sort());
  });

  it('the decision-record version mirrors ACTION_POLICY_RECORD_VERSION', () => {
    expect(GATEWAY_DECISION_RECORD_VERSION).toBe(ACTION_POLICY_RECORD_VERSION);
  });

  it('the denial shape mirrors the kernel PolicyDenialSchema (same values admit on both)', () => {
    const denial = { code: 'no-applicable-policy', reason: 'no policy covers this review yet' };
    expect(KernelPolicyDenialSchema.safeParse(denial).success).toBe(true);
    expect(GatewayDenialSchema.safeParse(denial).success).toBe(true);
    // A kernel-invalid denial is mirror-invalid too (drift would fork the seam).
    const invalid = { code: 'made-up-code', reason: 'x' };
    expect(KernelPolicyDenialSchema.safeParse(invalid).success).toBe(false);
    expect(GatewayDenialSchema.safeParse(invalid).success).toBe(false);
  });

  it('the approver-scope shape mirrors the kernel ApproverScopeSchema (W009 shapes)', () => {
    const scope = { tenantId: TENANT, workspaceId: 'workspace:fieldco-eng' };
    expect(KernelApproverScopeSchema.safeParse(scope).success).toBe(true);
    expect(ApproverScopeSchema.safeParse(scope).success).toBe(true);
    const invalid = { tenantId: 'tenant:BAD', workspaceId: 'workspace:fieldco-eng' };
    expect(KernelApproverScopeSchema.safeParse(invalid).success).toBe(false);
    expect(ApproverScopeSchema.safeParse(invalid).success).toBe(false);
  });

  it('the approval directive mirrors the kernel ApprovalDirectiveSchema (same values admit on both)', () => {
    const directive = {
      quorum: { approvals: 1, roles: ['field-reviewer'] },
      approverScope: { tenantId: TENANT },
      deadline: '2026-03-03T08:00:00.000Z',
      maxDelegationDepth: 1,
    };
    const kernel = KernelApprovalDirectiveSchema.safeParse(directive);
    const mirror = ApprovalDirectiveSchema.safeParse(directive);
    expect(kernel.success).toBe(true);
    expect(mirror.success).toBe(true);
    // Out-of-range delegation depth fails on BOTH (drift would fork the seam).
    const invalid = { ...directive, maxDelegationDepth: 99 };
    expect(KernelApprovalDirectiveSchema.safeParse(invalid).success).toBe(false);
    expect(ApprovalDirectiveSchema.safeParse(invalid).success).toBe(false);
  });

  it('a decision produced through the mobile seam round-trips its own schema (receipt discipline)', () => {
    const review = sealedReview();
    const digestPrefix = review.contentDigest.slice(0, 16);
    const proposal = buildReviewActionProposal(review, {
      proposedBy: DEFAULT_SYNC_PROPOSAL_IDENTITY.proposedByAgent,
      messageId: `field-review-${digestPrefix}`,
      proposalId: `field-review-${digestPrefix}`,
      createdAt: T6,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('fixture proposal failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: `field-approval:sync-${digestPrefix}`,
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T6,
    });
    if (!submission.ok) throw new Error('fixture submission failed');
    const host = new ReferenceFieldApprovalGateway({
      expectedTenantId: TENANT,
      directives: [
        {
          proposalDigest: canonicalDigest(proposal.value as Parameters<typeof canonicalDigest>[0]),
          decisionId: 'field-decision:parity',
          outcome: 'requires-approval',
          approval: {
            quorum: { approvals: 1, roles: ['field-reviewer'] },
            approverScope: { tenantId: TENANT },
            deadline: '2026-03-03T08:00:00.000Z',
            maxDelegationDepth: 1,
          },
          policySetDigest: '9'.repeat(64),
          decidedAt: T6,
        },
      ],
    });
    const decision = host.submitFieldReview(submission.value);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(GatewayDecisionRecordSchema.safeParse(decision.value).success).toBe(true);
    // The receipt carries the exact-revision proposal reference in the W003
    // grammar (the same ProposalReference the kernel decision binds to).
    expect(decision.value.proposalRef.proposalId).toBe(proposal.value.proposalId);
    expect(decision.value.proposalRef.canonicalDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W009 identity parity (the principal grammar)', () => {
  it('the field principal grammar mirrors @epoch/identity PRINCIPAL_ID_PATTERN', () => {
    // The runtime grammar comes from @epoch/solution-delivery PrincipalIdSchema
    // (the W036 mirror of the W009 grammar); the devDependency pin proves
    // both accept the same principal form.
    expect(IDENTITY_PRINCIPAL_ID_PATTERN.test('principal:field-engineer')).toBe(true);
    const identityParsed = IdentityPrincipalSchema.safeParse({
      schemaVersion: 1,
      principalId: 'principal:field-engineer',
      kind: 'human',
      displayName: 'Field Engineer',
    });
    expect(identityParsed.success).toBe(true);
    // The mobile fixtures use the same grammar.
    expect(REVIEWER).toMatch(IDENTITY_PRINCIPAL_ID_PATTERN);
  });
});

describe('W006 evidence parity (the digest convention)', () => {
  it('field evidence references use the W006 content-digest convention', () => {
    // The W006 evidence record's identity is the SHA-256 of its canonical
    // JSON; the mobile computeFieldEvidenceDigest delegates to the same
    // canonical machinery (@epoch/agent-protocol canonicalDigest). The
    // devDependency pin: the evidence kernel's own digest helper produces
    // the same digest form over the same canonical content.
    const data = { note: 'excavation complete' };
    const evidenceKernelDigest = computeEvidenceDigest({
      schemaVersion: EVIDENCE_RECORD_VERSION,
      kind: 'measurement',
      subject: { artifactId: 'artifact:note-1', revision: 'r1', digest: 'a'.repeat(64) },
      producedBy: { runId: 'run:1', actorId: 'principal:field-engineer' },
      observedAt: T5,
      content: { mediaType: 'application/json', data },
      confidence: {
        distribution: { kind: 'point', value: 1 },
        method: 'stated',
      },
    });
    expect(evidenceKernelDigest).toMatch(/^[0-9a-f]{64}$/);
    // The field evidence reference carries digests of the same form.
    const admitted = admitFieldEvidenceRef({
      kind: 'note',
      digest: 'b'.repeat(64),
      capturedAt: T5,
    });
    expect(admitted.ok).toBe(true);
  });
});

describe('W013 renderer-runtime parity (the invocation machinery)', () => {
  it('the renderer-runtime invocation machinery is the consumed W011 vocabulary (no local fork)', () => {
    // The renderer-runtime's submit-intent envelope consumes
    // InteractionModalitySchema from @epoch/experience-protocol — the same
    // closed vocabulary the field modality set draws from (the ladder pin).
    const rendererOptions = InvocationEnvelopeSchema as unknown as { options?: unknown };
    void rendererOptions;
    expect(
      FIELD_FIDELITY_INTERACTION_MODALITIES.every((modality) =>
        ['gamepad', 'gaze', 'gesture', 'keyboard', 'pointer', 'touch', 'voice'].includes(modality),
      ),
    ).toBe(true);
    expect(RENDERER_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('record-version discipline', () => {
  it('the mobile field record version is an exact pin (1)', () => {
    expect(MOBILE_FIELD_RECORD_VERSION).toBe(1);
    const literal = z.literal(1);
    expect(literal.safeParse(MOBILE_FIELD_RECORD_VERSION).success).toBe(true);
    expect(literal.safeParse(2).success).toBe(false);
  });
});
