// RUNTIME PARITY with the sibling kernel vocabularies (the W036
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010 event-log: the mirrored SHA-256 grammar is pattern-identical, the
//   decision digest equals the digest computed by the SHARED canonical
//   machinery (the same machinery W010's computeEventDigest uses), and a
//   real W010 event sealed through the REAL sealEvent carries a digest the
//   action-policy grammar admits;
// - W006 evidence: real evidence exact-revision digests are admitted by
//   the action-policy digest grammar and vice versa;
// - W006 verification: approval digests satisfy the same SHA-256 grammar
//   the verification kernel requires of produced-evidence digests.
import { describe, expect, it } from 'vitest';
import {
  computeEvidenceDigest,
  EvidenceRecordSchema,
  SHA256_HEX_PATTERN as EVIDENCE_SHA256_PATTERN,
} from '@epoch/evidence';
import { sealEvent, SHA256_HEX_PATTERN as EVENT_LOG_SHA256_PATTERN } from '@epoch/event-log';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  ActionPolicyRegistry,
  SHA256_HEX_PATTERN,
} from '../src/index';
import { evaluationInput, plainProposal, TENANT_A, T0, T1, unwrap } from './helpers';

describe('digest grammar parity (runtime)', () => {
  it('the mirrored SHA-256 grammar is pattern-identical to W010 and W006', () => {
    expect(SHA256_HEX_PATTERN.source).toBe(EVENT_LOG_SHA256_PATTERN.source);
    expect(SHA256_HEX_PATTERN.flags).toBe(EVENT_LOG_SHA256_PATTERN.flags);
    expect(SHA256_HEX_PATTERN.source).toBe(EVIDENCE_SHA256_PATTERN.source);
    expect(SHA256_HEX_PATTERN.flags).toBe(EVIDENCE_SHA256_PATTERN.flags);
  });

  it('a decision digest equals the canonical digest computed by the shared machinery', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    // The shared canonical machinery (the same one W010's
    // computeEventDigest and W006's computeEvidenceDigest build on) agrees
    // with the sealed content address.
    const { contentDigest, ...content } = decision;
    expect(canonicalDigest(content as unknown as JsonValue)).toBe(contentDigest);
    expect(SHA256_HEX_PATTERN.test(contentDigest)).toBe(true);
  });

  it('real W006 evidence digests are admitted by the action-policy grammar and vice versa', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    expect(EVIDENCE_SHA256_PATTERN.test(decision.contentDigest)).toBe(true);

    const evidence = {
      schemaVersion: 1,
      kind: 'measurement',
      subject: { artifactId: 'artifact:parity', revision: 'r1', digest: 'a'.repeat(64) },
      producedBy: { runId: 'run:parity', actorId: 'principal:parity-probe' },
      observedAt: T0,
      content: { mediaType: 'application/json', data: { spend: 10 } },
      confidence: { distribution: { kind: 'point', value: 1 }, method: 'measured' },
    };
    const parsed = EvidenceRecordSchema.safeParse(evidence);
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
    if (!parsed.success) return;
    const evidenceDigest = computeEvidenceDigest(parsed.data);
    expect(SHA256_HEX_PATTERN.test(evidenceDigest)).toBe(true);
  });

  it('approval digests satisfy the grammar the W006 verification kernel requires of evidence', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
    const approval = unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: { id: 'principal:eng-lead', role: 'human-approver' },
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    // The W006 verification kernel requires produced-evidence digests to
    // be lowercase hex SHA-256 — the same grammar.
    expect(/^[0-9a-f]{64}$/.test(approval.contentDigest)).toBe(true);
    expect(EVIDENCE_SHA256_PATTERN.test(approval.contentDigest)).toBe(true);
  });

  it('a W010-shaped action event seals through the REAL sealEvent with a grammar-admitted digest', () => {
    const event = {
      schemaVersion: 1,
      streamId: 'stream:action-parity-probe',
      sequence: 1,
      tenantId: TENANT_A,
      actor: 'principal:eng-lead',
      causalParent: null,
      payload: {
        discriminator: 'action:lifecycle',
        data: {
          action: { proposalId: 'prop-parity', canonicalDigest: 'b'.repeat(64) },
          actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
          phase: 'proposed',
        },
      },
      occurredAt: T0,
    };
    const sealed = sealEvent(event);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    // The action-policy grammar admits the W010 event digest.
    expect(SHA256_HEX_PATTERN.test(sealed.value.digest)).toBe(true);
  });
});
