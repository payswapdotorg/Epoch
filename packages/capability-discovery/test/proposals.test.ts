// R41: discovery can propose new adapters, extensions and domain packs
// WITHOUT silently changing semantic authority — proposals are typed
// records carrying evidence; activation remains Epoch governance.
import { describe, expect, it } from 'vitest';
import {
  deriveEcosystemProposal,
  ecosystemProposalDigestOf,
  reviewEcosystemProposal,
} from '../src/proposals';
import { createCapabilityGap } from '../src/gap';
import { runEcosystemDiscovery, shouldProposeEcosystemArtifact } from '../src/ecosystem';
import { StaticCatalogSourceAdapter } from '../src/adapters';
import { TENANT_A, op, sourceArtifact } from './fixtures';

function recurringGaps() {
  return [
    createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('mechanical.tolerance-analysis'),
      demandSummary: 'Recurring tolerance analysis need',
      lifecycleStage: 'realize',
      triggeringSignalIds: ['m-1', 'm-2', 'm-3'],
      at: '2026-10-05T09:00:00.000Z',
    }),
    createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('mechanical.bom-derivation'),
      demandSummary: 'Recurring BOM derivation need',
      lifecycleStage: 'plan',
      triggeringSignalIds: ['m-4', 'm-5'],
      at: '2026-10-05T09:00:00.000Z',
    }),
  ];
}

describe('the ecosystem proposal mechanism (R41)', () => {
  it('derives a domain-pack proposal with DP1.0 detail from gap evidence', () => {
    const result = deriveEcosystemProposal({
      kind: 'domain-pack',
      summary: 'Propose a mechanical engineering domain pack',
      gaps: recurringGaps(),
      at: '2026-10-05T09:00:00.000Z',
      domainPackDetail: {
        proposedPackId: 'pack:mechanical',
        requiredVocabulary: ['tolerance', 'bom'],
        worldModelBindings: ['mechanical-part', 'mechanical-assembly'],
        capabilityDependencies: ['epoch.capability.cad-geometry'],
        evaluationRequirements: ['tolerance-benchmark-suite'],
        uxProjections: ['bom-view'],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const proposal = result.value;
    expect(proposal.proposalId).toMatch(/^ecoprop:[0-9a-f]{16}$/);
    expect(proposal.status).toBe('proposed');
    expect(proposal.evidence.gapIds).toHaveLength(2);
    expect(proposal.evidence.recurringGapCount).toBe(2);
    expect(proposal.evidence.taskExamples.length).toBeGreaterThan(0);
    expect(proposal.evidence.missingSemantics.length).toBeGreaterThan(0);
    expect(proposal.domainPackDetail?.proposedPackId).toBe('pack:mechanical');
    // The proposal id is the content digest of the body.
    expect(proposal.proposalId).toBe(
      `ecoprop:${ecosystemProposalDigestOf(proposal).slice(0, 16)}`,
    );
  });

  it('derives adapter and extension proposals', () => {
    const adapter = deriveEcosystemProposal({
      kind: 'adapter',
      summary: 'Propose an adapter for a private engineering catalog',
      gaps: recurringGaps().slice(0, 1),
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(adapter.ok).toBe(true);
    const extension = deriveEcosystemProposal({
      kind: 'extension',
      summary: 'Propose a tolerance-analysis extension',
      gaps: recurringGaps().slice(1),
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(extension.ok).toBe(true);
    if (!adapter.ok || !extension.ok) return;
    expect(adapter.value.domainPackDetail).toBeUndefined();
    expect(adapter.value.proposalId).not.toBe(extension.value.proposalId);
  });

  it('domain-pack proposals require the DP1.0 detail (typed validation)', () => {
    const result = deriveEcosystemProposal({
      kind: 'domain-pack',
      summary: 'missing detail',
      gaps: recurringGaps(),
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('review transitions the proposal status without touching semantic authority', () => {
    const result = deriveEcosystemProposal({
      kind: 'adapter',
      summary: 'adapter proposal',
      gaps: recurringGaps(),
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!result.ok) return;
    const reviewed = reviewEcosystemProposal(result.value, {
      status: 'accepted',
      reviewNote: 'approved by governance',
    });
    expect(reviewed.status).toBe('accepted');
    expect(reviewed.reviewNote).toBe('approved by governance');
    // The original record is unchanged (append-only by convention).
    expect(result.value.status).toBe('proposed');
  });

  it('recurring-gap threshold gates proposal derivation', () => {
    expect(shouldProposeEcosystemArtifact(recurringGaps(), 2)).toBe(true);
    expect(shouldProposeEcosystemArtifact(recurringGaps(), 3)).toBe(false);
  });

  it('an ecosystem scan over recurring gaps never activates anything (records only)', () => {
    const gaps = recurringGaps();
    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        sourceArtifact({
          artifactId: 'mech-artifact',
          summary: 'Claims tolerance analysis',
          claims: [
            { operation: op('mechanical.tolerance-analysis'), inputKinds: ['geometry'], outputKinds: ['numeric'] },
          ],
        }),
      ],
    });
    const outcome = runEcosystemDiscovery({
      tenantId: TENANT_A,
      trigger: 'scheduled',
      invokedBy: 'sched-weekly',
      gaps,
      adapters: [adapter],
      existingCandidates: [],
      at: '2026-10-12T09:00:00.000Z',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The outcome contains ONLY: a run record, ingested discovered
    // candidates, gap transitions and duplicate digests. No activation,
    // no registry write, no authority change — those live behind
    // explicit promotion + governance acts.
    expect(outcome.value.run.trigger).toEqual({ trigger: 'scheduled', invokedBy: 'sched-weekly' });
    expect(outcome.value.ingestedCandidates.every((c) => c.evaluationState === 'discovered')).toBe(true);
    expect(Object.keys(outcome.value).sort()).toEqual([
      'duplicateArtifactDigests',
      'ingestedCandidates',
      'run',
      'scanReport',
      'updatedGaps',
    ]);
  });
});
