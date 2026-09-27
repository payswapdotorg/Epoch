// Determinism + replay evidence: identical inputs yield identical digests
// for EVERY derived view; input-order permutations never leak; every
// derived digest is a canonical SHA-256.
import { describe, expect, it } from 'vitest';
import {
  foldCostSchedule,
  foldResourceSchedule,
} from '@epoch/solution-delivery';
import {
  constructionVocabularyBundle,
  constructionWorkTemplates,
  CONSTRUCTION_OUTCOME_TYPES,
  digestOutcomeViews,
  foldClassifiedCostSummary,
  foldClassifiedResourceSummary,
  foldDeliveryLinks,
  projectBoq,
  projectConstructionOutcomes,
  projectConstructionProgramme,
} from '../src/index';
import { costClassIndex, outcomeRecords, resourceClassIndex, warehouseChain } from './fixtures';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe('determinism: identical inputs -> identical digests for every derived view', () => {
  const chain = warehouseChain();
  const inputs = {
    solution: chain.solution,
    program: chain.program,
    acquisitions: chain.acquisitions,
    delivery: chain.delivery,
    worldEntities: chain.worldEntities,
  };

  it('the BOQ view digest is stable and canonical', () => {
    const first = projectBoq(inputs);
    const second = projectBoq(inputs);
    if (!first.ok || !second.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the programme view digest is stable and canonical', () => {
    const first = projectConstructionProgramme(chain.program);
    const second = projectConstructionProgramme(chain.program);
    if (!first.ok || !second.ok) {
      throw new Error('fixture programme failed to project');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the delivery-link index digest is stable and canonical', () => {
    const first = foldDeliveryLinks(inputs);
    const second = foldDeliveryLinks(inputs);
    if (!first.ok || !second.ok) {
      throw new Error('fixture links failed to fold');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the outcome-view digest is stable and canonical', () => {
    const first = digestOutcomeViews(projectConstructionOutcomes(outcomeRecords(), CONSTRUCTION_OUTCOME_TYPES));
    const second = digestOutcomeViews(projectConstructionOutcomes(outcomeRecords(), CONSTRUCTION_OUTCOME_TYPES));
    expect(first).toMatch(DIGEST_PATTERN);
    expect(second).toBe(first);
  });

  it('the vocabulary bundle digest is stable across calls', () => {
    const first = constructionVocabularyBundle();
    const second = constructionVocabularyBundle();
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('the work-template catalog digests are stable across calls', () => {
    expect(constructionWorkTemplates()).toEqual(constructionWorkTemplates());
  });
});

describe('determinism: input-order permutations never leak into folds', () => {
  const chain = warehouseChain();

  it('the BOQ digest is invariant under acquisition permutation', () => {
    const forward = projectBoq({
      solution: chain.solution,
      acquisitions: chain.acquisitions,
    });
    const permuted = projectBoq({
      solution: chain.solution,
      acquisitions: [...chain.acquisitions].reverse(),
    });
    if (!forward.ok || !permuted.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    expect(permuted.value.contentDigest).toBe(forward.value.contentDigest);
  });

  it('the BOQ digest is invariant under world-entity permutation', () => {
    const forward = projectBoq({
      solution: chain.solution,
      worldEntities: chain.worldEntities,
    });
    const permuted = projectBoq({
      solution: chain.solution,
      worldEntities: [...chain.worldEntities].reverse(),
    });
    if (!forward.ok || !permuted.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    expect(permuted.value.contentDigest).toBe(forward.value.contentDigest);
  });

  it('the classified cost/resource summaries are invariant under row permutation', () => {
    const schedule = foldCostSchedule(chain.program);
    const resources = foldResourceSchedule(chain.program);
    const costForward = foldClassifiedCostSummary(schedule, costClassIndex());
    const costPermuted = foldClassifiedCostSummary(
      { ...schedule, rows: [...schedule.rows].reverse() },
      costClassIndex(),
    );
    expect(costPermuted).toEqual(costForward);
    const resourceForward = foldClassifiedResourceSummary(resources, resourceClassIndex());
    const resourcePermuted = foldClassifiedResourceSummary(
      { ...resources, rows: [...resources.rows].reverse() },
      resourceClassIndex(),
    );
    expect(resourcePermuted).toEqual(resourceForward);
  });

  it('the outcome views are invariant under record permutation', () => {
    const records = outcomeRecords();
    const forward = projectConstructionOutcomes(records, CONSTRUCTION_OUTCOME_TYPES);
    const backward = projectConstructionOutcomes([...records].reverse(), CONSTRUCTION_OUTCOME_TYPES);
    expect(backward).toEqual(forward);
  });
});
