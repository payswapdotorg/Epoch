// Determinism + replay evidence: identical inputs yield identical digests
// for EVERY derived view; input-order permutations never leak; every
// derived digest is a canonical SHA-256.
import { describe, expect, it } from 'vitest';
import { foldCostSchedule, foldResourceSchedule } from '@epoch/solution-delivery';
import {
  digestOutcomeViews,
  foldClassifiedCostSummary,
  foldClassifiedResourceSummary,
  projectBacklog,
  projectDeploymentPlan,
  projectRoadmap,
  projectSoftwareOutcomes,
  renderDeployProposal,
  softwareDeployProposalTemplates,
  softwareVocabularyBundle,
  softwareWorkTemplates,
  SOFTWARE_OUTCOME_TYPES,
} from '../src/index';
import {
  checkoutChain,
  costClassIndex,
  deployProposalParams,
  environmentAssignments,
  outcomeRecords,
  resourceClassIndex,
  workItemIndex,
} from './fixtures';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe('determinism: identical inputs -> identical digests for every derived view', () => {
  const chain = checkoutChain();
  const backlogInputs = {
    program: chain.program,
    delivery: chain.delivery,
    workItemIndex: workItemIndex(),
  };

  it('the roadmap view digest is stable and canonical', () => {
    const first = projectRoadmap(chain.program);
    const second = projectRoadmap(chain.program);
    if (!first.ok || !second.ok) {
      throw new Error('fixture roadmap failed to project');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the backlog view digest is stable and canonical', () => {
    const first = projectBacklog(backlogInputs);
    const second = projectBacklog(backlogInputs);
    if (!first.ok || !second.ok) {
      throw new Error('fixture backlog failed to project');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the deployment-plan view digest is stable and canonical', () => {
    const inputs = { program: chain.program, assignments: environmentAssignments() };
    const first = projectDeploymentPlan(inputs);
    const second = projectDeploymentPlan(inputs);
    if (!first.ok || !second.ok) {
      throw new Error('fixture deployment plan failed to project');
    }
    expect(first.value.contentDigest).toMatch(DIGEST_PATTERN);
    expect(second.value.contentDigest).toBe(first.value.contentDigest);
  });

  it('the outcome-view digest is stable and canonical', () => {
    const first = digestOutcomeViews(projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES));
    const second = digestOutcomeViews(projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES));
    expect(first).toMatch(DIGEST_PATTERN);
    expect(second).toBe(first);
  });

  it('the vocabulary bundle digest is stable across calls', () => {
    const first = softwareVocabularyBundle();
    const second = softwareVocabularyBundle();
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('the work-template catalog digests are stable across calls', () => {
    expect(softwareWorkTemplates()).toEqual(softwareWorkTemplates());
  });

  it('the deploy-proposal template catalog digests are stable across calls', () => {
    expect(softwareDeployProposalTemplates()).toEqual(softwareDeployProposalTemplates());
  });

  it('the rendered deploy proposal is byte-identical on repeat renders', () => {
    const template = softwareDeployProposalTemplates().find(
      (candidate) => candidate.templateId === 'software.deploy.template.release-rollout',
    )!;
    const first = renderDeployProposal(template, deployProposalParams());
    const second = renderDeployProposal(template, deployProposalParams());
    if (!first.ok || !second.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    expect(JSON.stringify(second.value)).toBe(JSON.stringify(first.value));
  });
});

describe('determinism: input-order permutations never leak into folds', () => {
  const chain = checkoutChain();

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
    const forward = projectSoftwareOutcomes(records, SOFTWARE_OUTCOME_TYPES);
    const backward = projectSoftwareOutcomes([...records].reverse(), SOFTWARE_OUTCOME_TYPES);
    expect(backward).toEqual(forward);
  });

  it('independently built but identical fixture chains project identical digests (replay)', () => {
    const first = checkoutChain();
    const second = checkoutChain();
    const roadmapFirst = projectRoadmap(first.program);
    const roadmapSecond = projectRoadmap(second.program);
    const backlogFirst = projectBacklog({
      program: first.program,
      delivery: first.delivery,
      workItemIndex: workItemIndex(),
    });
    const backlogSecond = projectBacklog({
      program: second.program,
      delivery: second.delivery,
      workItemIndex: workItemIndex(),
    });
    if (
      !roadmapFirst.ok ||
      !roadmapSecond.ok ||
      !backlogFirst.ok ||
      !backlogSecond.ok
    ) {
      throw new Error('fixture projections failed');
    }
    expect(roadmapSecond.value.contentDigest).toBe(roadmapFirst.value.contentDigest);
    expect(backlogSecond.value.contentDigest).toBe(backlogFirst.value.contentDigest);
    // The independently built chains are themselves digest-identical (the
    // kernel admission path is deterministic over identical inputs).
    expect(second.program.contentDigest).toBe(first.program.contentDigest);
    expect(second.delivery.contentDigest).toBe(first.delivery.contentDigest);
  });
});
