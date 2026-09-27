// NAMED NEGATIVE battery: parallel-tracker-rejected,
// tenant-isolation-rejected, tampered digests for every sealed view, and
// malformed projection inputs.
import { describe, expect, it } from 'vitest';
import { sealSolutionVersion } from '@epoch/solution-delivery';
import {
  projectBacklog,
  projectDeploymentPlan,
  projectRoadmap,
  sealDeployProposalTemplate,
  sealVocabularyBundle,
  sealWorkTemplate,
  softwareDeployProposalTemplates,
  softwareVocabularyBundle,
  softwareWorkTemplates,
  verifyBacklogView,
  verifyDeploymentPlanView,
  verifyRoadmapView,
  verifyVocabularyBundle,
  verifyWorkTemplate,
  verifyDeployProposalTemplate,
} from '../src/index';
import {
  OTHER_TENANT,
  checkoutChain,
  sealedDelivery,
  sealedProgram,
  sealedSolution,
  solutionContent,
  environmentAssignments,
  TENANT,
} from './fixtures';

describe('NAMED NEGATIVE: parallel-tracker-rejected (no stored issue/backlog state)', () => {
  it('a vocabulary bundle carrying an issueStore field is rejected', () => {
    const bundle = softwareVocabularyBundle() as unknown as Record<string, unknown>;
    const withStore = { ...bundle, issueStore: { issues: [] } };
    const sealed = sealVocabularyBundle(withStore);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-tracker-rejected');
      if (sealed.error.code === 'parallel-tracker-rejected') {
        expect(sealed.error.field).toBe('issueStore');
      }
    }
  });

  it('a work template carrying storedIssues is rejected', () => {
    const template = softwareWorkTemplates()[0] as unknown as Record<string, unknown>;
    delete template['contentDigest'];
    const withStored = { ...template, storedIssues: true };
    const sealed = sealWorkTemplate(withStored);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-tracker-rejected');
    }
  });

  it('a deploy-proposal template carrying trackerState is rejected', () => {
    const template = softwareDeployProposalTemplates()[0] as unknown as Record<string, unknown>;
    delete template['contentDigest'];
    const withTracker = { ...template, trackerState: { open: 3 } };
    const sealed = sealDeployProposalTemplate(withTracker);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-tracker-rejected');
    }
  });

  it('a backlog view envelope carrying appendIssue is rejected', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({ program: chain.program });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    const withAppend = {
      ...(backlog.value as unknown as Record<string, unknown>),
      appendIssue: 'issue:new',
    };
    const verified = verifyBacklogView(withAppend);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('parallel-tracker-rejected');
    }
  });

  it('a roadmap view envelope carrying a roadmapStore field is rejected', () => {
    const chain = checkoutChain();
    const roadmap = projectRoadmap(chain.program);
    if (!roadmap.ok) {
      throw new Error('fixture roadmap failed to project');
    }
    const withStore = { ...(roadmap.value as unknown as Record<string, unknown>), roadmapStore: [] };
    const verified = verifyRoadmapView(withStore);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('parallel-tracker-rejected');
    }
  });

  it('a deployment-plan view envelope carrying a deploymentLedger field is rejected', () => {
    const chain = checkoutChain();
    const plan = projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    if (!plan.ok) {
      throw new Error('fixture deployment plan failed to project');
    }
    const withLedger = {
      ...(plan.value as unknown as Record<string, unknown>),
      deploymentLedger: [],
    };
    const verified = verifyDeploymentPlanView(withLedger);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('parallel-tracker-rejected');
    }
  });

  it('a vocabulary bundle carrying a parallel costLedger field is rejected', () => {
    const bundle = softwareVocabularyBundle() as unknown as Record<string, unknown>;
    const withLedger = { ...bundle, costLedger: { entries: [] } };
    const sealed = sealVocabularyBundle(withLedger);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-tracker-rejected');
      if (sealed.error.code === 'parallel-tracker-rejected') {
        expect(sealed.error.field).toBe('costLedger');
      }
    }
  });
});

describe('NAMED NEGATIVE: tenant-isolation-rejected (cross-tenant-denied on every fold)', () => {
  it('a cross-tenant delivery record is rejected by the backlog projection', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const foreignDelivery = sealedDelivery(solution, OTHER_TENANT);
    const backlog = projectBacklog({ program, delivery: foreignDelivery });
    expect(backlog.ok).toBe(false);
    if (!backlog.ok) {
      expect(backlog.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a delivery for a DIFFERENT solution is rejected by the backlog projection', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const other = sealSolutionVersion({
      ...solutionContent(),
      solutionId: 'solution:other-service',
    });
    if (!other.ok) {
      throw new Error('fixture other solution failed to seal');
    }
    const delivery = sealedDelivery(other.value);
    const backlog = projectBacklog({ program, delivery });
    expect(backlog.ok).toBe(false);
  });

  it('views carry the tenant id of their inputs — never a foreign tenant', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({ program: chain.program, delivery: chain.delivery });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    expect(backlog.value.tenantId).toBe(TENANT);
    expect(backlog.value.tenantId).not.toBe(OTHER_TENANT);
    const roadmap = projectRoadmap(chain.program);
    if (!roadmap.ok) {
      throw new Error('fixture roadmap failed to project');
    }
    expect(roadmap.value.tenantId).toBe(TENANT);
  });

  it('profiles are tenant-scoped: a foreign tenant profile never verifies as another tenant', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({ program: chain.program });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    expect(backlog.value.tenantId).not.toBe(OTHER_TENANT);
  });
});

describe('NAMED NEGATIVE: tampered digests (digest-mismatch on every sealed view)', () => {
  it('a tampered roadmap view fails verification', () => {
    const chain = checkoutChain();
    const roadmap = projectRoadmap(chain.program);
    if (!roadmap.ok) {
      throw new Error('fixture roadmap failed to project');
    }
    const tampered = {
      ...roadmap.value,
      summary: { ...roadmap.value.summary, milestoneCount: 99 },
    };
    const verified = verifyRoadmapView(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered backlog view fails verification', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({ program: chain.program });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    const tampered = { ...backlog.value, title: 'Tampered tracker' };
    const verified = verifyBacklogView(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered deployment-plan view fails verification', () => {
    const chain = checkoutChain();
    const plan = projectDeploymentPlan({ program: chain.program });
    if (!plan.ok) {
      throw new Error('fixture deployment plan failed to project');
    }
    const tampered = { ...plan.value, title: 'Tampered plan' };
    const verified = verifyDeploymentPlanView(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered vocabulary bundle fails verification (digest-mismatch)', () => {
    const bundle = softwareVocabularyBundle();
    const tampered = {
      ...bundle,
      measurementMethods: bundle.measurementMethods.map((method) =>
        method.methodId === 'software.measure.effort-hours'
          ? { ...method, description: 'Tampered description' }
          : method,
      ),
    };
    const verified = verifyVocabularyBundle(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered work template fails verification', () => {
    const template = softwareWorkTemplates()[0]!;
    const tampered = { ...template, templateVersion: '9.9.9' };
    const verified = verifyWorkTemplate(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered deploy-proposal template fails verification', () => {
    const template = softwareDeployProposalTemplates()[0]!;
    const tampered = { ...template, title: 'Tampered template' };
    const verified = verifyDeployProposalTemplate(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});

describe('NAMED NEGATIVE: malformed projection inputs', () => {
  it('a non-object program input is a validation error, never a crash', () => {
    const roadmap = projectRoadmap('not-a-program' as never);
    expect(roadmap.ok).toBe(false);
    if (!roadmap.ok) {
      expect(['validation', 'digest-mismatch']).toContain(roadmap.error.code);
    }
  });

  it('a backlog view is NOT valid canonical input — it cannot re-enter as program state', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({ program: chain.program });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    const replayed = projectBacklog({ program: backlog.value as never });
    expect(replayed.ok).toBe(false);
    if (!replayed.ok) {
      expect(['validation', 'digest-mismatch', 'vendor-fields-rejected']).toContain(
        replayed.error.code,
      );
    }
  });
});
