// Acceptance 8: every discovery result is reproducible and
// content-addressed. Determinism: shuffled authoring order yields
// identical digests and run ids; the lineage chain is tamper-detecting.
import { describe, expect, it } from 'vitest';
import {
  canonicalDiscoveryInput,
  discoveryInputDigest,
  discoveryRunIdOf,
  runProblemDrivenDiscovery,
  verifyDiscoveryRun,
} from '../src/run';
import { contentDigest } from '../src/canonical';
import type { DiscoveryRunArtifact } from '../src/types';
import {
  constructionCandidates,
  constructionInput,
  declaredCriteria,
  softwareCandidates,
  softwareInput,
} from './fixtures';

function constructionRun(): DiscoveryRunArtifact {
  const result = runProblemDrivenDiscovery(constructionInput(), {
    at: '2026-10-05T09:00:00.000Z',
    candidates: Object.values(constructionCandidates()),
    criteria: declaredCriteria(),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('acceptance 8 — reproducible, content-addressed discovery runs', () => {
  it('the run id is content-addressed over (kind, tenant, inputDigest, compilerVersion)', () => {
    const artifact = constructionRun();
    const inputDigest = discoveryInputDigest(artifact.input);
    expect(artifact.run.runId).toBe(discoveryRunIdOf('problem-driven', artifact.run.tenantId, inputDigest));
    expect(artifact.run.runId).toMatch(/^discrun:[0-9a-f]{16}$/);
  });

  it('the lineage chain covers all seven stages with linked digests', () => {
    const artifact = constructionRun();
    expect(artifact.run.stages.map((stage) => stage.stage)).toEqual([
      'inputs',
      'demands',
      'roles',
      'resolution',
      'organizations',
      'evaluation',
      'selection',
    ]);
    expect(artifact.run.stages[0]!.previousStageDigest).toBeNull();
    for (let index = 1; index < artifact.run.stages.length; index += 1) {
      expect(artifact.run.stages[index]!.previousStageDigest).toBe(
        artifact.run.stages[index - 1]!.stageDigest,
      );
    }
  });

  it('verifyDiscoveryRun accepts the honest artifact', () => {
    const artifact = constructionRun();
    expect(verifyDiscoveryRun(artifact).ok).toBe(true);
  });

  it('verifyDiscoveryRun rejects a tampered demand record even with recomputed set digest', () => {
    const artifact = constructionRun();
    const tamperedDemands = artifact.demandSet.demands.map((demand) =>
      demand.operation.id === 'engineering.stress-analysis'
        ? { ...demand, summary: 'tampered summary' }
        : demand,
    );
    // Recompute the set digest so only the CONTENT lies.
    const tampered: DiscoveryRunArtifact = {
      ...artifact,
      demandSet: {
        demands: tamperedDemands,
        setDigest: contentDigest(
          tamperedDemands.map((demand) => {
            const body = { ...demand, demandId: undefined };
            return [demand.demandId, contentDigest(body)];
          }),
        ),
      },
    };
    const verification = verifyDiscoveryRun(tampered);
    expect(verification.ok).toBe(false);
    if (verification.ok || verification.error.code !== 'lineage-mismatch') {
      throw new Error('expected a lineage-mismatch failure');
    }
    expect(verification.error.brokenStages).toContain('demands');
  });

  it('verifyDiscoveryRun rejects a tampered role and a broken stage link', () => {
    const artifact = constructionRun();
    const tamperedRole: DiscoveryRunArtifact = {
      ...artifact,
      roleProposals: artifact.roleProposals.map((role) =>
        role.satisfiesDemands.length > 0
          ? { ...role, mission: 'tampered mission' }
          : role,
      ),
    };
    const roleVerification = verifyDiscoveryRun(tamperedRole);
    expect(roleVerification.ok).toBe(false);
    if (roleVerification.ok || roleVerification.error.code !== 'lineage-mismatch') {
      throw new Error('expected a lineage-mismatch failure');
    }
    expect(roleVerification.error.brokenStages).toContain('roles');

    const brokenLink: DiscoveryRunArtifact = {
      ...artifact,
      run: {
        ...artifact.run,
        stages: artifact.run.stages.map((stage, index) =>
          index === 3 ? { ...stage, previousStageDigest: '0'.repeat(64) } : stage,
        ),
      },
    };
    const linkVerification = verifyDiscoveryRun(brokenLink);
    expect(linkVerification.ok).toBe(false);
    if (!linkVerification.ok) {
      expect(linkVerification.error.code).toBe('lineage-mismatch');
    }
  });

  it('verifyDiscoveryRun rejects a swapped input (identity mismatch)', () => {
    const artifact = constructionRun();
    const verification = verifyDiscoveryRun({
      ...artifact,
      input: { ...artifact.input, task: { ...artifact.input.task, summary: 'swapped task' } },
    });
    expect(verification.ok).toBe(false);
  });

  it('shuffled authoring order yields byte-identical canonical input, digests and run id', () => {
    const original = constructionInput();
    const shuffled = {
      ...original,
      worldRefs: [...original.worldRefs].reverse(),
      evidenceSignals: [...original.evidenceSignals].reverse(),
      constraintSignals: [...original.constraintSignals].reverse(),
      taskSignals: [...original.taskSignals].reverse(),
      packContributions: original.packContributions.map((pack) => ({
        ...pack,
        demandTemplates: [...pack.demandTemplates].reverse(),
        roleTemplates: [...pack.roleTemplates].reverse(),
        taskSignalBindings: [...pack.taskSignalBindings].reverse(),
      })),
    };
    expect(canonicalDiscoveryInput(shuffled)).toEqual(canonicalDiscoveryInput(original));
    expect(discoveryInputDigest(shuffled)).toBe(discoveryInputDigest(original));

    const runA = runProblemDrivenDiscovery(original, {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    const runB = runProblemDrivenDiscovery(shuffled, {
      at: '2026-10-05T09:00:00.000Z',
      candidates: [...Object.values(constructionCandidates())].reverse(),
      criteria: [...declaredCriteria()].reverse(),
    });
    expect(runA.ok).toBe(true);
    expect(runB.ok).toBe(true);
    if (!runA.ok || !runB.ok) return;
    expect(runB.value.run.runId).toBe(runA.value.run.runId);
    expect(runB.value.run.inputDigest).toBe(runA.value.run.inputDigest);
    expect(runB.value.run.stages).toEqual(runA.value.run.stages);
    expect(runB.value.demandSet).toEqual(runA.value.demandSet);
    expect(runB.value.roleProposals).toEqual(runA.value.roleProposals);
    expect(runB.value.selection).toEqual(runA.value.selection);
  });

  it('the createdAt instant does NOT affect the run identity (records verify across instants)', () => {
    const runA = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    const runB = runProblemDrivenDiscovery(constructionInput(), {
      at: '2027-01-01T00:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    if (!runA.ok || !runB.ok) return;
    expect(runB.value.run.runId).toBe(runA.value.run.runId);
    // ...but the recorded creation instant is the caller-supplied one.
    expect(runB.value.run.createdAt).toBe('2027-01-01T00:00:00.000Z');
    expect(verifyDiscoveryRun(runB.value).ok).toBe(true);
  });

  it('distinct inputs derive distinct run ids (construction vs software)', () => {
    const construction = constructionRun();
    const software = runProblemDrivenDiscovery(softwareInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(softwareCandidates()),
      criteria: declaredCriteria(),
    });
    if (!software.ok) return;
    expect(software.value.run.runId).not.toBe(construction.run.runId);
    expect(software.value.run.inputDigest).not.toBe(construction.run.inputDigest);
  });
});
