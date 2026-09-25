// Broken evidence chain (negative): every way a stage evidence chain (or
// a derivation routed through it) can break — missing records, tampered
// records, unanchored subjects, mis-staged payloads, wrong evidence
// kinds, out-of-order stages, incomplete chains, uncovered candidates,
// and tenant mismatches inside the chain — each a typed
// `broken-evidence-chain` rejection with the precise reason.
import { describe, expect, it } from 'vitest';
import { computeEvidenceDigest, type EvidenceRecord } from '@epoch/evidence';
import {
  deriveProvisionalDefinitions,
  verifyCandidateProvenance,
  verifyDefinitionProvenance,
  verifyEvidenceChain,
} from '../src/index';
import { jsonFixture, runContext, runStagedPipeline, expectFailure, chainThroughReview } from './fixtures';
import type { ExtractionCandidate, StageEvidenceChain } from '../src/index';

describe('broken evidence chain (negative)', () => {
  const pipeline = runStagedPipeline(jsonFixture());

  function fullChain(): StageEvidenceChain {
    return {
      schemaVersion: 1,
      documentDigest: pipeline.descriptor.digest,
      tenantScope: pipeline.descriptor.tenantScope,
      stages: pipeline.receipts.map((receipt) => receipt.link),
    };
  }

  it('rejects a missing stage record (missing-record)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    records.delete(chain.stages[1]!.evidenceDigest);
    const error = expectFailure(verifyEvidenceChain(chain, records), 'broken-evidence-chain');
    expect(error.reason).toBe('missing-record');
    expect(error.stage).toBe('parsed');
    expect(error.path).toEqual(['evidenceChain', 'stages', 1, 'evidenceDigest']);
  });

  it('rejects a tampered stage record (digest-mismatch on the record content address)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    const original = records.get(chain.stages[0]!.evidenceDigest) as EvidenceRecord;
    const tampered: EvidenceRecord = {
      ...original,
      producedBy: { ...original.producedBy, actorId: 'principal:attacker' },
    };
    // Re-keyed at the ORIGINAL digest: the claimed address no longer
    // matches the content (tamper detection).
    records.set(chain.stages[0]!.evidenceDigest, tampered);
    const error = expectFailure(verifyEvidenceChain(chain, records), 'broken-evidence-chain');
    expect(error.reason).toBe('digest-mismatch');
    expect(error.stage).toBe('uploaded');
  });

  it('rejects a record that is not valid W006 evidence (invalid-record)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    records.set(chain.stages[2]!.evidenceDigest, { not: 'an evidence record' });
    const error = expectFailure(verifyEvidenceChain(chain, records), 'broken-evidence-chain');
    expect(error.reason).toBe('invalid-record');
  });

  it('rejects an unanchored subject (record about a different document)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    const original = records.get(chain.stages[1]!.evidenceDigest) as EvidenceRecord;
    const foreign: EvidenceRecord = {
      ...original,
      subject: { ...original.subject, digest: 'e'.repeat(64), artifactId: `doc:${'e'.repeat(64)}` },
    };
    records.delete(chain.stages[1]!.evidenceDigest);
    records.set(computeEvidenceDigest(foreign), foreign);
    const reAnchored: StageEvidenceChain = {
      ...chain,
      stages: chain.stages.map((link, index) =>
        index === 1
          ? { stage: link.stage, evidenceDigest: computeEvidenceDigest(foreign) }
          : link,
      ),
    };
    const error = expectFailure(verifyEvidenceChain(reAnchored, records), 'broken-evidence-chain');
    expect(error.reason).toBe('unanchored-subject');
  });

  it('rejects a payload that names a different stage (stage-mismatch)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    const original = records.get(chain.stages[2]!.evidenceDigest) as EvidenceRecord;
    const misStaged: EvidenceRecord = {
      ...original,
      content: {
        ...original.content,
        data: { ...(original.content.data as object), stage: 'parsed' },
      },
    };
    records.delete(chain.stages[2]!.evidenceDigest);
    records.set(computeEvidenceDigest(misStaged), misStaged);
    const reKeyed: StageEvidenceChain = {
      ...chain,
      stages: chain.stages.map((link, index) =>
        index === 2
          ? { stage: link.stage, evidenceDigest: computeEvidenceDigest(misStaged) }
          : link,
      ),
    };
    const error = expectFailure(verifyEvidenceChain(reKeyed, records), 'broken-evidence-chain');
    expect(error.reason).toBe('stage-mismatch');
  });

  it('rejects a payload whose tenant scope disagrees with the chain (tenant-mismatch)', () => {
    const chain = fullChain();
    const records = new Map(pipeline.records);
    const original = records.get(chain.stages[0]!.evidenceDigest) as EvidenceRecord;
    const foreignTenant: EvidenceRecord = {
      ...original,
      content: {
        ...original.content,
        data: {
          ...(original.content.data as object),
          tenantScope: { tenantId: 'tenant:beta' },
        },
      },
    };
    records.delete(chain.stages[0]!.evidenceDigest);
    records.set(computeEvidenceDigest(foreignTenant), foreignTenant);
    const reKeyed: StageEvidenceChain = {
      ...chain,
      stages: chain.stages.map((link, index) =>
        index === 0
          ? { stage: link.stage, evidenceDigest: computeEvidenceDigest(foreignTenant) }
          : link,
      ),
    };
    const error = expectFailure(verifyEvidenceChain(reKeyed, records), 'broken-evidence-chain');
    expect(error.reason).toBe('tenant-mismatch');
  });

  it('rejects out-of-order stages (out-of-order)', () => {
    const swapped: StageEvidenceChain = {
      ...fullChain(),
      stages: [fullChain().stages[1]!, fullChain().stages[0]!, fullChain().stages[2]!, fullChain().stages[3]!],
    };
    const error = expectFailure(verifyEvidenceChain(swapped, pipeline.records), 'broken-evidence-chain');
    expect(error.reason).toBe('out-of-order');
    expect(error.path).toEqual(['evidenceChain', 'stages', 0, 'stage']);
  });

  it('rejects a chain that skips a stage (out-of-order at the skip position)', () => {
    const links = fullChain().stages;
    const skipped: StageEvidenceChain = {
      ...fullChain(),
      stages: [links[0]!, links[2]!, links[3]!],
    };
    const error = expectFailure(verifyEvidenceChain(skipped, pipeline.records), 'broken-evidence-chain');
    expect(error.reason).toBe('out-of-order');
    expect(error.stage).toBe('candidates-extracted');
  });

  it('rejects an empty chain (out-of-order)', () => {
    const error = expectFailure(
      verifyEvidenceChain({ ...fullChain(), stages: [] }, pipeline.records),
      'broken-evidence-chain',
    );
    expect(error.reason).toBe('out-of-order');
  });

  it('rejects a candidate verified against an incomplete chain (incomplete-chain)', () => {
    const chain: StageEvidenceChain = {
      ...fullChain(),
      stages: fullChain().stages.slice(0, 2),
    };
    const error = expectFailure(
      verifyCandidateProvenance(pipeline.candidates[0]!, chain, pipeline.records),
      'broken-evidence-chain',
    );
    expect(error.reason).toBe('incomplete-chain');
  });

  it('rejects a candidate whose id is not covered by the extraction evidence (uncovered-candidate)', () => {
    const chain = fullChain();
    const forged: ExtractionCandidate = {
      ...pipeline.candidates[0]!,
      candidateId: `cand:${'ab'.repeat(32)}`,
    };
    const error = expectFailure(
      verifyCandidateProvenance(forged, chain, pipeline.records),
      'broken-evidence-chain',
    );
    expect(error.reason).toBe('uncovered-candidate');
    expect(error.stage).toBe('candidates-extracted');
  });

  it('rejects a candidate that claims a different document than its chain (unanchored-subject)', () => {
    const chain = fullChain();
    const forged: ExtractionCandidate = {
      ...pipeline.candidates[0]!,
      documentDigest: 'e'.repeat(64),
    };
    const error = expectFailure(
      verifyCandidateProvenance(forged, chain, pipeline.records),
      'broken-evidence-chain',
    );
    expect(error.reason).toBe('unanchored-subject');
  });

  it('rejects a definition whose attestation is not the provisional evidence digest', () => {
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [pipeline.candidates[0]!],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const records = new Map(pipeline.records);
    records.set(derived.value.evidence.digest, derived.value.evidence.record);
    const forged = {
      ...derived.value.definitions[0]!,
      registration: {
        ...derived.value.definitions[0]!.registration,
        attestationDigest: 'e'.repeat(64),
      },
    };
    const error = expectFailure(verifyDefinitionProvenance(forged, records), 'broken-evidence-chain');
    expect(error.reason).toBe('digest-mismatch');
    expect(error.stage).toBe('provisional');
    expect(error.path).toEqual(['registration', 'attestationDigest']);
  });

  it('rejects a definition with an incomplete chain (incomplete-chain)', () => {
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [pipeline.candidates[0]!],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const records = new Map(pipeline.records);
    records.set(derived.value.evidence.digest, derived.value.evidence.record);
    const truncated = {
      ...derived.value.definitions[0]!,
      evidenceChain: chainThroughReview(pipeline),
    };
    const error = expectFailure(verifyDefinitionProvenance(truncated, records), 'broken-evidence-chain');
    expect(error.reason).toBe('incomplete-chain');
  });
});
