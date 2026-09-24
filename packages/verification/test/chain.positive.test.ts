// Positive tests: full-chain round trip, content-addressed evidence
// lookup through the chain, approval flow, stage-distinct chains, chain
// digests, and provenance construction from a validated chain.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import { computeEvidenceDigest, EvidenceStore } from '@epoch/evidence';
import { validateProvenanceGraph } from '@epoch/provenance';
import {
  admitChain,
  chainProvenance,
  computeChainDigest,
  parseVerificationChain,
  validateChain,
} from '../src/index';
import {
  ARTIFACT_DIGEST,
  EVIDENCE_DIGEST,
  validationChain,
  verificationChain,
} from './helpers';

describe('full-chain round trip (positive)', () => {
  it('admits a complete Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval chain', () => {
    const result = admitChain(verificationChain());
    expect(result.ok).toBe(true);
  });

  it('parses to the typed chain model and round-trips semantic validation', () => {
    const parsed = parseVerificationChain(verificationChain());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.chain.requirements).toHaveLength(1);
    expect(parsed.chain.claims[0]?.stage).toBe('verification');
    expect(parsed.chain.runs[0]?.producedEvidence).toEqual([EVIDENCE_DIGEST]);
    const validation = validateChain(parsed.chain);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.chain).toBe(parsed.chain);
    }
  });

  it('admits a complete validation-stage chain (stage: validation)', () => {
    const result = admitChain(validationChain());
    expect(result.ok).toBe(true);
  });

  it('admits partial-but-consistent chains (no workflow engine)', () => {
    // A run without a result, and a result without an approval, are valid.
    expect(admitChain(verificationChain({ results: [], approvals: [] })).ok).toBe(true);
    expect(admitChain(verificationChain({ approvals: [] })).ok).toBe(true);
    // A run without any result yet, plus its evidence, is a valid prefix.
    const prefix = verificationChain();
    delete prefix.results;
    delete prefix.approvals;
    expect(admitChain({ ...prefix, results: [], approvals: [] }).ok).toBe(true);
  });

  it('admits an empty chain (vacuously valid)', () => {
    const result = admitChain({
      schemaVersion: 1,
      requirements: [],
      claims: [],
      methods: [],
      runs: [],
      evidence: [],
      results: [],
      approvals: [],
    });
    expect(result.ok).toBe(true);
  });

  it('admits multiple approvals of one result by different approvers (quorum)', () => {
    const result = admitChain(
      verificationChain({
        approvals: [
          {
            schemaVersion: 1,
            approvalId: 'approval:signoff-1',
            resultId: 'result:res-1',
            approverId: 'actor:reviewer-01',
            approverKind: 'person',
            decision: 'approved',
            decidedAt: '2025-06-01T12:00:00.000Z',
          },
          {
            schemaVersion: 1,
            approvalId: 'approval:signoff-2',
            resultId: 'result:res-1',
            approverId: 'actor:chief-engineer-01',
            approverKind: 'person',
            decision: 'approved',
            decidedAt: '2025-06-01T12:30:00.000Z',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a rejected approval decision (rejection is a legal authority act)', () => {
    const result = admitChain(
      verificationChain({
        approvals: [
          {
            schemaVersion: 1,
            approvalId: 'approval:veto-1',
            resultId: 'result:res-1',
            approverId: 'actor:reviewer-01',
            approverKind: 'person',
            decision: 'rejected',
            decidedAt: '2025-06-01T12:00:00.000Z',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('content-addressed evidence through the chain (positive)', () => {
  it('a result cites exactly the digest its evidence record produces', () => {
    const parsed = parseVerificationChain(verificationChain());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const record = parsed.chain.evidence[0]!;
    expect(computeEvidenceDigest(record)).toBe(parsed.chain.results[0]?.evidenceDigests[0]);
  });

  it('chain evidence loads into an EvidenceStore and is retrievable by digest and artifact revision', () => {
    const parsed = parseVerificationChain(verificationChain());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const store = EvidenceStore.create();
    for (const record of parsed.chain.evidence) {
      const added = store.add(record);
      expect(added.ok).toBe(true);
    }
    const firstResult = parsed.chain.results[0];
    expect(firstResult).toBeDefined();
    const cited = firstResult?.evidenceDigests[0];
    expect(cited).toBeDefined();
    if (cited === undefined) return;
    expect(store.has(cited)).toBe(true);
    // Exact-revision lookup: filter by the SUBJECT artifact digest (what the
    // record is about), and by the revision label.
    const receipts = store.byArtifact('artifact:structural-report', { revisionDigest: ARTIFACT_DIGEST });
    expect(receipts).toHaveLength(1);
    expect(store.byArtifact('artifact:structural-report', { revision: 'r3' })).toHaveLength(1);
    expect(store.byDigest(cited)).toBeDefined();
  });
});

describe('chain digests (positive)', () => {
  it('a chain digests to the SHA-256 of its canonical JSON form', () => {
    const parsed = parseVerificationChain(verificationChain());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(computeChainDigest(parsed.chain)).toBe(canonicalDigest(parsed.chain as never));
    expect(computeChainDigest(parsed.chain)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('provenance construction (positive)', () => {
  it('builds a valid PROV-style graph from a verified chain', () => {
    const result = chainProvenance(verificationChain());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.graph;
    // Agents: solver (software) + reviewer (person).
    expect(graph.agents.map((a) => a.agentId).sort()).toEqual(['actor:reviewer-01', 'actor:solver-01']);
    // Activities: the verification run + the approval.
    expect(graph.activities.map((a) => a.activityKind).sort()).toEqual(['approval', 'verification-run']);
    // Entities: requirement, claim, method, evidence (content-addressed), result.
    const kinds = graph.entities.map((e) => e.entityKind).sort();
    expect(kinds).toEqual(['claim', 'evidence', 'method', 'requirement', 'result']);
    const evidenceEntity = graph.entities.find((e) => e.entityKind === 'evidence');
    expect(evidenceEntity?.digest).toBe(EVIDENCE_DIGEST);
    // The constructed graph is itself valid (checked internally, re-checked here).
    expect(validateProvenanceGraph(graph).ok).toBe(true);
    // All six relation kinds except delegation appear in the chain story.
    const relations = new Set(graph.statements.map((s) => s.relation));
    expect(relations.has('was-generated-by')).toBe(true);
    expect(relations.has('used')).toBe(true);
    expect(relations.has('was-associated-with')).toBe(true);
    expect(relations.has('was-derived-from')).toBe(true);
  });

  it('derives claims from requirements and results from evidence in the graph', () => {
    const result = chainProvenance(verificationChain());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const derivations = result.graph.statements.filter((s) => s.relation === 'was-derived-from');
    expect(
      derivations.some(
        (s) =>
          s.relation === 'was-derived-from' &&
          s.generatedEntityId === 'claim:claim:deflection-check' && // graph ids namespace the fixture ids
          s.usedEntityId === 'requirement:req:struct-001',
      ),
    ).toBe(true);
    expect(
      derivations.some(
        (s) =>
          s.relation === 'was-derived-from' &&
          s.generatedEntityId === 'result:result:res-1' && // graph ids namespace the fixture ids
          s.usedEntityId === `evidence:${EVIDENCE_DIGEST}`,
      ),
    ).toBe(true);
  });

  it('marks the stage distinction in activity kinds (verification-run vs validation-run)', () => {
    const verification = chainProvenance(verificationChain());
    const validation = chainProvenance(validationChain());
    expect(verification.ok && validation.ok).toBe(true);
    if (!verification.ok || !validation.ok) return;
    expect(verification.graph.activities.some((a) => a.activityKind === 'verification-run')).toBe(true);
    expect(validation.graph.activities.some((a) => a.activityKind === 'validation-run')).toBe(true);
  });

  it('rejects provenance construction for an invalid chain (no provenance from a broken chain)', () => {
    const result = chainProvenance(verificationChain({ claims: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-requirement' || i.code === 'unknown-claim')).toBe(true);
  });
});

describe('attached provenance graphs (positive)', () => {
  it('admits a chain carrying an attached valid provenance graph', () => {
    const graph = chainProvenance(verificationChain());
    expect(graph.ok).toBe(true);
    if (!graph.ok) return;
    const result = admitChain(verificationChain({ provenance: [graph.graph] }));
    expect(result.ok).toBe(true);
  });

  it('admits chains without any attached provenance (field is optional)', () => {
    const chain = verificationChain();
    delete chain.provenance;
    expect(admitChain(chain).ok).toBe(true);
    expect(admitChain(verificationChain({ provenance: [] })).ok).toBe(true);
  });
});
