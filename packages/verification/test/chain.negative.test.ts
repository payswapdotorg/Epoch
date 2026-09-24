// Negative tests: every broken-chain class the reference validator must
// reject — orphan references at every stage, claims without methods,
// stage confusion (verification vs validation), digest-mismatch evidence,
// self-approval, temporal violations, duplicate ids, attached-provenance
// violations, schema violations, and version skew.
import { describe, expect, it } from 'vitest';
import { computeEvidenceDigest } from '@epoch/evidence';
import { admitChain, parseVerificationChain } from '../src/index';
import {
  EVIDENCE,
  EVIDENCE_DIGEST,
  makeEvidence,
  validationChain,
  verificationChain,
  T0,
  T1,
  T2,
  T4,
} from './helpers';

const dig = (record: ReturnType<typeof makeEvidence>): string => computeEvidenceDigest(record);

describe('orphan references (negative: broken chains rejected at every stage)', () => {
  it('rejects a claim referencing an absent requirement (orphan claim)', () => {
    const result = admitChain(
      verificationChain({
        claims: [{ schemaVersion: 1, claimId: 'claim:orphan', requirementId: 'req:missing', statement: 'x', stage: 'verification' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-requirement' && i.message.includes('req:missing'))).toBe(true);
  });

  it('rejects a method referencing an absent claim (orphan method)', () => {
    const result = admitChain(
      verificationChain({
        methods: [
          { schemaVersion: 1, methodId: 'method:deflection-check', claimId: 'claim:missing', stage: 'verification', description: 'x', deterministic: true },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-claim')).toBe(true);
  });

  it('rejects a run referencing an absent method (orphan run)', () => {
    const chain = verificationChain();
    (chain.runs as Record<string, unknown>[])[0]!.methodId = 'method:missing';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-method')).toBe(true);
  });

  it('rejects a result referencing an absent run (orphan result)', () => {
    const chain = verificationChain();
    (chain.results as Record<string, unknown>[])[0]!.runId = 'run:missing';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-run' && i.message.includes('orphan result'))).toBe(true);
  });

  it('rejects a result referencing an absent claim (orphan result)', () => {
    const chain = verificationChain();
    (chain.results as Record<string, unknown>[])[0]!.claimId = 'claim:missing';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-claim' && i.message.includes('orphan result'))).toBe(true);
  });

  it('rejects an approval referencing an absent result', () => {
    const chain = verificationChain();
    (chain.approvals as Record<string, unknown>[])[0]!.resultId = 'result:missing';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-result')).toBe(true);
  });
});

describe('claims without methods (negative)', () => {
  it('rejects a claim that has no method', () => {
    const result = admitChain(
      verificationChain({
        methods: [
          { schemaVersion: 1, methodId: 'method:other', claimId: 'claim:other', stage: 'verification', description: 'x', deterministic: true },
        ],
        runs: [],
        results: [],
        approvals: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'claim-without-method' && i.message.includes('claim:deflection-check'))).toBe(true);
  });
});

describe('stage confusion (negative: verification/validation never fuse)', () => {
  it('rejects a validation method operationalizing a verification claim', () => {
    const chain = verificationChain();
    (chain.methods as Record<string, unknown>[])[0]!.stage = 'validation';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'stage-mismatch')).toBe(true);
  });

  it('rejects a verification run executing a validation method (and vice versa)', () => {
    const swappedMethod = verificationChain();
    (swappedMethod.methods as Record<string, unknown>[])[0]!.stage = 'validation';
    expect(admitChain(swappedMethod).ok).toBe(false);

    const swappedRun = verificationChain();
    (swappedRun.runs as Record<string, unknown>[])[0]!.stage = 'validation';
    const result = admitChain(swappedRun);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'stage-mismatch')).toBe(true);
  });

  it('rejects a validation result satisfying a verification claim', () => {
    const chain = verificationChain();
    (chain.results as Record<string, unknown>[])[0]!.stage = 'validation';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'stage-mismatch' && i.message.includes('cannot satisfy'))).toBe(true);
  });

  it('rejects a verification result satisfying a validation claim (mirror case)', () => {
    const chain = validationChain();
    (chain.results as Record<string, unknown>[])[0]!.stage = 'verification';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'stage-mismatch')).toBe(true);
  });

  it('an internally consistent validation chain is NOT rejected (distinct, not forbidden)', () => {
    expect(admitChain(validationChain()).ok).toBe(true);
  });
});

describe('evidence discipline (negative: digest mismatches rejected)', () => {
  it('rejects a run citing a digest no evidence record produces (tampered evidence)', () => {
    const tampered = makeEvidence({ observedAt: T4 }); // same subject, different content -> different address
    const tamperedDigest = dig(tampered);
    expect(tamperedDigest).not.toBe(EVIDENCE_DIGEST);
    const chain = verificationChain({
      runs: [
        {
          schemaVersion: 1,
          runId: 'run:stress-check-1',
          methodId: 'method:deflection-check',
          stage: 'verification',
          executedBy: 'actor:solver-01',
          executedByKind: 'software',
          startedAt: T0,
          endedAt: T1,
          status: 'completed',
          producedEvidence: [tamperedDigest],
        },
      ],
      evidence: [EVIDENCE], // the chain carries the ORIGINAL record, the run cites the tampered address
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'evidence-digest-mismatch')).toBe(true);
  });

  it('rejects a result citing evidence produced by a DIFFERENT run', () => {
    const other = makeEvidence({
      producedBy: { runId: 'run:other-run', actorId: 'actor:solver-01', methodId: 'method:deflection-check' },
    });
    const otherDigest = dig(other);
    const chain = verificationChain({
      evidence: [EVIDENCE, other],
      runs: [
        {
          schemaVersion: 1,
          runId: 'run:stress-check-1',
          methodId: 'method:deflection-check',
          stage: 'verification',
          executedBy: 'actor:solver-01',
          executedByKind: 'software',
          startedAt: T0,
          endedAt: T1,
          status: 'completed',
          producedEvidence: [EVIDENCE_DIGEST],
        },
        {
          schemaVersion: 1,
          runId: 'run:other-run',
          methodId: 'method:deflection-check',
          stage: 'verification',
          executedBy: 'actor:solver-01',
          executedByKind: 'software',
          startedAt: T0,
          endedAt: T1,
          status: 'completed',
          producedEvidence: [otherDigest],
        },
      ],
      results: [
        {
          schemaVersion: 1,
          resultId: 'result:res-1',
          claimId: 'claim:deflection-check',
          runId: 'run:stress-check-1',
          stage: 'verification',
          outcome: 'pass',
          evidenceDigests: [otherDigest], // legit record, but produced by run:other-run
          confidence: { distribution: { kind: 'point', value: 0.9 } },
          decidedAt: T2,
        },
      ],
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'evidence-not-produced-by-run')).toBe(true);
  });

  it('rejects evidence that names a different producing run than the run citing it', () => {
    const chain = verificationChain();
    const miscredited = makeEvidence({
      producedBy: { runId: 'run:somewhere-else', actorId: 'actor:solver-01', methodId: 'method:deflection-check' },
    });
    chain.evidence = [miscredited];
    (chain.runs as Record<string, unknown>[])[0]!.producedEvidence = [dig(miscredited)];
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'evidence-run-mismatch')).toBe(true);
  });

  it('rejects evidence that names a different producing method than the run', () => {
    const chain = verificationChain();
    const wrongMethod = makeEvidence({
      producedBy: { runId: 'run:stress-check-1', actorId: 'actor:solver-01', methodId: 'method:someone-elses' },
    });
    chain.evidence = [wrongMethod];
    (chain.runs as Record<string, unknown>[])[0]!.producedEvidence = [dig(wrongMethod)];
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'evidence-method-mismatch')).toBe(true);
  });

  it('rejects two evidence records pinning one revision label to different content', () => {
    const other = makeEvidence({
      kind: 'observation',
      content: { mediaType: 'application/json', data: { note: 'second look' } },
      confidence: { distribution: { kind: 'point', value: 0.8 }, method: 'stated' },
    });
    // Same artifactId+revision as the fixture, but a different subject digest.
    const conflicting = makeEvidence({
      subject: { artifactId: 'artifact:structural-report', revision: 'r3', digest: 'f'.repeat(64) },
      producedBy: { runId: 'run:stress-check-1', actorId: 'actor:solver-01', methodId: 'method:deflection-check' },
    });
    const chain = verificationChain({
      evidence: [EVIDENCE, other, conflicting],
      runs: [
        {
          schemaVersion: 1,
          runId: 'run:stress-check-1',
          methodId: 'method:deflection-check',
          stage: 'verification',
          executedBy: 'actor:solver-01',
          executedByKind: 'software',
          startedAt: T0,
          endedAt: T1,
          status: 'completed',
          producedEvidence: [EVIDENCE_DIGEST, dig(other), dig(conflicting)],
        },
      ],
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'evidence-subject-conflict')).toBe(true);
  });
});

describe('approval authority (negative: results do not self-approve)', () => {
  it('rejects self-approval (approver === run executor)', () => {
    const chain = verificationChain();
    (chain.approvals as Record<string, unknown>[])[0]!.approverId = 'actor:solver-01';
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'self-approval' && i.message.includes('do not self-approve'))).toBe(true);
  });

  it('rejects duplicate approvals of one result by the same approver', () => {
    const chain = verificationChain({
      approvals: [
        {
          schemaVersion: 1,
          approvalId: 'approval:signoff-1',
          resultId: 'result:res-1',
          approverId: 'actor:reviewer-01',
          approverKind: 'person',
          decision: 'approved',
          decidedAt: T2,
        },
        {
          schemaVersion: 1,
          approvalId: 'approval:signoff-1b',
          resultId: 'result:res-1',
          approverId: 'actor:reviewer-01',
          approverKind: 'person',
          decision: 'rejected',
          decidedAt: T4,
        },
      ],
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'duplicate-approval')).toBe(true);
  });

  it('rejects an approval recorded before its result was decided', () => {
    const chain = verificationChain();
    (chain.approvals as Record<string, unknown>[])[0]!.decidedAt = T0;
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'approval-before-result')).toBe(true);
  });
});

describe('actor provenance consistency (negative)', () => {
  it('rejects one actor id carrying two different PROV kinds', () => {
    const chain = verificationChain({
      approvals: [
        {
          schemaVersion: 1,
          approvalId: 'approval:signoff-1',
          resultId: 'result:res-1',
          approverId: 'actor:solver-01', // same actor as the run executor...
          approverKind: 'person', // ...but now declared a person, not software
          decision: 'approved',
          decidedAt: T2,
        },
      ],
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'actor-kind-conflict')).toBe(true);
  });
});

describe('temporal sanity (negative)', () => {
  it('rejects a run that starts after it ends', () => {
    const chain = verificationChain();
    const run = (chain.runs as Record<string, unknown>[])[0]!;
    run.startedAt = T2;
    run.endedAt = T0;
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'run-time-order')).toBe(true);
  });

  it('rejects a result decided before its run ends', () => {
    const chain = verificationChain();
    (chain.results as Record<string, unknown>[])[0]!.decidedAt = T0;
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'result-before-run-end')).toBe(true);
  });
});

describe('duplicate ids (negative)', () => {
  it('rejects duplicate requirement, claim, and run ids', () => {
    const chain = verificationChain({
      requirements: [
        { schemaVersion: 1, requirementId: 'req:struct-001', statement: 'a' },
        { schemaVersion: 1, requirementId: 'req:struct-001', statement: 'b' },
      ],
    });
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'duplicate-id' && i.message.includes('requirements'))).toBe(true);

    const dupClaim = verificationChain({
      claims: [
        { schemaVersion: 1, claimId: 'claim:deflection-check', requirementId: 'req:struct-001', statement: 'a', stage: 'verification' },
        { schemaVersion: 1, claimId: 'claim:deflection-check', requirementId: 'req:struct-001', statement: 'b', stage: 'verification' },
      ],
    });
    const claimResult = admitChain(dupClaim);
    expect(claimResult.ok).toBe(false);
    if (!claimResult.ok) {
      expect(claimResult.issues.some((i) => i.code === 'duplicate-id' && i.message.includes('claims'))).toBe(true);
    }

    const dupApproval = verificationChain({
      approvals: [
        { schemaVersion: 1, approvalId: 'approval:signoff-1', resultId: 'result:res-1', approverId: 'actor:reviewer-01', approverKind: 'person', decision: 'approved', decidedAt: T2 },
        { schemaVersion: 1, approvalId: 'approval:signoff-1', resultId: 'result:res-1', approverId: 'actor:other-01', approverKind: 'person', decision: 'approved', decidedAt: T4 },
      ],
    });
    const approvalResult = admitChain(dupApproval);
    expect(approvalResult.ok).toBe(false);
    if (!approvalResult.ok) {
      expect(approvalResult.issues.some((i) => i.code === 'duplicate-id' && i.message.includes('approvals'))).toBe(true);
    }
  });
});

describe('attached provenance (negative)', () => {
  it('rejects a chain carrying an invalid provenance graph (dangling entity)', () => {
    const result = admitChain(
      verificationChain({
        provenance: [
          {
            schemaVersion: 1,
            agents: [{ agentId: 'actor:x', agentKind: 'person' }],
            activities: [],
            entities: [],
            statements: [{ relation: 'was-attributed-to', entityId: 'evidence:missing', agentId: 'actor:x' }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((i) => i.code === 'provenance-invalid');
    expect(issue).toBeDefined();
    expect(issue?.details?.some((d) => d.code === 'unknown-entity')).toBe(true);
  });
});

describe('schema violations (negative: malformed chains rejected)', () => {
  it('rejects unknown keys on the chain and on records (strict shape)', () => {
    expect(admitChain({ ...verificationChain(), extra: true }).ok).toBe(false);
    const badRun = verificationChain();
    (badRun.runs as Record<string, unknown>[])[0]!.mystery = true;
    expect(admitChain(badRun).ok).toBe(false);
  });

  it('rejects unknown stage, outcome, decision, and status values', () => {
    const badStage = verificationChain();
    (badStage.claims as Record<string, unknown>[])[0]!.stage = 'certification';
    expect(admitChain(badStage).ok).toBe(false);

    const badOutcome = verificationChain();
    (badOutcome.results as Record<string, unknown>[])[0]!.outcome = 'maybe';
    expect(admitChain(badOutcome).ok).toBe(false);

    const badDecision = verificationChain();
    (badDecision.approvals as Record<string, unknown>[])[0]!.decision = 'maybe';
    expect(admitChain(badDecision).ok).toBe(false);

    const badStatus = verificationChain();
    (badStatus.runs as Record<string, unknown>[])[0]!.status = 'paused';
    expect(admitChain(badStatus).ok).toBe(false);
  });

  it('rejects non-canonical timestamps and malformed digests inside records', () => {
    const badTime = verificationChain();
    (badTime.runs as Record<string, unknown>[])[0]!.startedAt = '2025-06-01T08:00:00Z';
    expect(admitChain(badTime).ok).toBe(false);

    const badDigest = verificationChain();
    (badDigest.runs as Record<string, unknown>[])[0]!.producedEvidence = ['nothex'];
    expect(admitChain(badDigest).ok).toBe(false);
  });

  it('rejects a result without evidence (ungrounded judgment)', () => {
    const chain = verificationChain();
    (chain.results as Record<string, unknown>[])[0]!.evidenceDigests = [];
    const result = admitChain(chain);
    expect(result.ok).toBe(false); // schema: min(1) evidence digests
  });

  it('rejects malformed embedded evidence records (chain delegates to @epoch/evidence)', () => {
    const chain = verificationChain();
    // Parsed evidence records are frozen (zod .readonly()); corrupt a copy.
    const corrupted = { ...(chain.evidence as Record<string, unknown>[])[0]!, kind: 'vibes' };
    chain.evidence = [corrupted];
    const result = admitChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'schema' && i.path?.[0] === 'evidence')).toBe(true);
  });

  it('rejects non-array collections', () => {
    expect(admitChain(verificationChain({ runs: 'many' })).ok).toBe(false);
  });
});

describe('version discriminator (negative: version skew rejected distinctly)', () => {
  it('rejects chain schemaVersion 2 with the dedicated version-mismatch code', () => {
    const result = parseVerificationChain(verificationChain({ schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('version-mismatch');
    expect(result.issues[0]?.message).toContain('expected 1');
  });

  it('rejects a nested record with schemaVersion 2, recoded to version-mismatch', () => {
    const chain = verificationChain();
    (chain.runs as Record<string, unknown>[])[0]!.schemaVersion = 2;
    const result = parseVerificationChain(chain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'version-mismatch' && i.path?.[0] === 'runs')).toBe(true);
  });

  it('rejects a missing schemaVersion as a schema issue', () => {
    const bad = verificationChain();
    delete bad.schemaVersion;
    const result = parseVerificationChain(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.every((i) => i.code === 'schema')).toBe(true);
  });
});
