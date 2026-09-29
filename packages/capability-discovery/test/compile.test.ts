// Acceptance 1: from only task/world/evidence/constraint input, the
// system produces a provider-neutral set of CapabilityDemand records.
// Also: validation negatives + the domain-pack prior semantics (add or
// tighten, never relax — negative d's demand half).
import { describe, expect, it } from 'vitest';
import { compileCapabilityDemands, demandDigestOf } from '../src/compile';
import { DiscoveryInputSchema } from '../src/schema';
import type { CapabilityDemand, DiscoveryInput } from '../src/types';
import {
  CONSTRUCTION_SUBJECT_STRUCTURE,
  constructionInput,
  constructionPack,
  expectFailure,
  softwareInput,
} from './fixtures';

describe('acceptance 1 — the universal demand compiler', () => {
  it('derives provider-neutral demands from construction input only', () => {
    const result = compileCapabilityDemands(constructionInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const demands = result.value.demandSet.demands;
    expect(demands.length).toBeGreaterThanOrEqual(5);

    const byOperation = new Map(demands.map((demand) => [demand.operation.id, demand]));
    const geometry = byOperation.get('engineering.geometry-processing');
    expect(geometry).toBeDefined();
    expect(geometry!.inputRepresentations).toContain('geometry');
    expect(geometry!.outputContract.map((entry) => entry.kind)).toContain('geometry');
    expect(geometry!.lifecycleStage).toBe('understand');
    expect(geometry!.domainRefs).toEqual(['construction']);
    expect(geometry!.affectedRefs).toContain(CONSTRUCTION_SUBJECT_STRUCTURE);

    const stress = byOperation.get('engineering.stress-analysis');
    expect(stress).toBeDefined();
    // The authority constraint signal marked the structural subject.
    expect(stress!.authorityConstraints.requiresHumanCosign).toBe(true);
    expect(stress!.authorityConstraints.executionAuthority).toBe('none');
    // The verification signal marked the same subject's demands.
    expect(stress!.verificationRequired).toBe(true);
    // The universal quality signal (0.95) and the pack template (0.98)
    // folded to the STRICTEST target (same metric).
    expect(stress!.qualityTarget?.metric).toBe('accuracy');
    expect(stress!.qualityTarget?.threshold).toBe(0.98);
    // The failure signal reasserted the demand with its evidence note.
    expect(stress!.derivedFromSignals).toContain('s-stress');
    expect(stress!.derivedFromSignals).toContain('s-failure');
    expect(stress!.derivedFromTemplates).toContain('tpl-structural-analysis');

    const unknown = byOperation.get('investigation.unknown-resolution');
    expect(unknown).toBeDefined();
    expect(unknown!.acceptableUncertaintyConfidence).toBe(0.7);

    // The latency budget constraint (task-wide) reached every demand.
    for (const demand of demands) {
      expect(demand.latencyBudgetMs).toBe(86_400_000);
    }

    // Every demand id is the content digest of its body.
    for (const demand of demands) {
      expect(demand.demandId).toBe(`demand:${demandDigestOf(demand).slice(0, 16)}`);
    }
  });

  it('derives a distinct software demand set from the same machinery', () => {
    const result = compileCapabilityDemands(softwareInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.demandSet.demands.map((demand) => demand.operation.id);
    expect(ids).toContain('software.code-review');
    expect(ids).toContain('software.test-generation');
    expect(ids).toContain('software.security-audit');
    expect(ids).toContain('delivery.artifact-production');
    // The artifact signal produced a deployment-plan output contract.
    const artifact = result.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'delivery.artifact-production',
    );
    expect(artifact!.outputContract.map((entry) => entry.name)).toContain('deployment-plan');
    // The dependency signal wired the artifact demand to the review.
    expect(
      artifact!.dependsOnOperations.map((operation) => operation.id),
    ).toContain('software.code-review');
    // The budget signal attached to the service subject demands.
    const review = result.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'software.code-review',
    );
    expect(review!.costBudget).toEqual({ currency: 'USD', amount: '500' });
    // The pack template's evidence requirement tightened the review demand.
    expect(review!.evidenceRequirements).toContain('review-report');
  });

  it('demands carry no provider/model vocabulary (structural check)', () => {
    const result = compileCapabilityDemands(constructionInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const demand of result.value.demandSet.demands as CapabilityDemand[]) {
      expect(demand.operation.id).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
      expect(demand.authorityConstraints.executionAuthority).toBe('none');
    }
  });

  it('rejects invalid input with typed validation issues', () => {
    const bad = constructionInput() as unknown as Record<string, unknown>;
    delete bad.taskSignals;
    const result = compileCapabilityDemands(bad as unknown as DiscoveryInput);
    const failure = expectFailure(result, 'validation');
    expect(failure.issues.length).toBeGreaterThan(0);
  });

  it('rejects operation signals without an operationRef', () => {
    const input = constructionInput();
    const malformed = DiscoveryInputSchema.safeParse({
      ...input,
      taskSignals: [
        ...input.taskSignals,
        { signalId: 's-bad', kind: 'operation', summary: 'no operation', subjectRefs: [], evidenceRefs: [], constraintRefs: [] },
      ],
    });
    expect(malformed.success).toBe(false);
  });

  it('pack templates can only add or tighten — relaxation attempts are recorded and ignored (negative d, demand half)', () => {
    const base = constructionInput();
    // A hostile pack: tries to RELAX the cosign requirement and the
    // quality target on the universal stress-analysis demand, and tries
    // to relax the accuracy target below the universal 0.95.
    const input: DiscoveryInput = {
      ...base,
      packContributions: [
      constructionPack(),
      {
        packId: 'pack:hostile',
        packVersion: '1.0.0',
        demandTemplates: [
          {
            templateId: 'tpl-hostile-relax',
            summary: 'Attempts to relax universal facets',
            operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
            qualityTarget: { metric: 'accuracy', threshold: 0.1, unit: 'ratio', direction: 'min' },
            requiresHumanCosign: false,
            applicability: { domainRefs: ['construction'], signalKinds: ['operation'] },
          },
        ],
        roleTemplates: [],
        taskSignalBindings: [
          {
            bindingId: 'bind-hostile',
            signalKind: 'operation',
            domainRef: 'construction',
            impliesDemandTemplate: 'tpl-hostile-relax',
          },
        ],
      },
    ]};
    const result = compileCapabilityDemands(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stress = result.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'engineering.stress-analysis',
    )!;
    // The universal derivation stands: cosign still required, quality
    // target still strict (0.98 from the honest template, not 0.1).
    expect(stress.authorityConstraints.requiresHumanCosign).toBe(true);
    expect(stress.qualityTarget?.threshold).toBe(0.98);
    // The relaxation attempt is recorded, and the hostile template is
    // NOT credited with contributing.
    expect(stress.derivedFromTemplates).not.toContain('tpl-hostile-relax');
    expect(
      result.value.templateOverrideRejections.some((rejection) =>
        rejection.includes('tpl-hostile-relax'),
      ),
    ).toBe(true);
  });

  it('pack templates cannot remove universal demands (no second compiler authority)', () => {
    const input = constructionInput();
    // The untriggered quantity-derivation template proves packs can only
    // ADD: no signal of kind 'work' exists, so the template never fires.
    const result = compileCapabilityDemands(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.demandSet.demands.map((demand) => demand.operation.id);
    expect(ids).not.toContain('construction.quantity-derivation');
    // The geometry demand (universal + template) still exists.
    expect(ids).toContain('engineering.geometry-processing');
  });
});
