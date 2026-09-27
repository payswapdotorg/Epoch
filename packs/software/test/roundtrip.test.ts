// Round-trip serialization + digest verification for EVERY public type:
// the sealed profile, the vocabulary bundle (every vocabulary family), the
// work templates, the deploy-proposal templates, the roadmap view, the
// backlog view, the deployment-plan view, and the outcome views.
import { describe, expect, it } from 'vitest';
import { parseActionProposal } from '@epoch/action-protocol';
import {
  BacklogViewSchema,
  DeploymentPlanViewSchema,
  RoadmapViewSchema,
  SealedSoftwareProfileSchema,
  SoftwareOutcomeViewSchema,
  projectBacklog,
  projectDeploymentPlan,
  projectRoadmap,
  projectSoftwareOutcomes,
  renderDeployProposal,
  sealSoftwareProfile,
  softwareDeployProposalTemplates,
  softwarePackProfile,
  softwareVocabularyBundle,
  softwareWorkTemplates,
  SOFTWARE_OUTCOME_TYPES,
  verifyBacklogView,
  verifyDeploymentPlanView,
  verifyRoadmapView,
  verifySoftwareProfile,
  verifyVocabularyBundle,
  verifyWorkTemplate,
  verifyDeployProposalTemplate,
} from '../src/index';
import {
  checkoutChain,
  deployProposalParams,
  environmentAssignments,
  outcomeRecords,
  workItemIndex,
} from './fixtures';

describe('round-trip: every public type survives JSON serialization + digest verification', () => {
  const chain = checkoutChain();

  it('the sealed pack profile round-trips', () => {
    const sealed = sealSoftwareProfile(softwarePackProfile(chain.solution.tenantId));
    const json = JSON.parse(JSON.stringify(sealed));
    expect(SealedSoftwareProfileSchema.safeParse(json).success).toBe(true);
    const verified = verifySoftwareProfile(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed);
    }
  });

  it('the vocabulary bundle round-trips (all eight vocabulary families)', () => {
    const bundle = softwareVocabularyBundle();
    const json = JSON.parse(JSON.stringify(bundle));
    const verified = verifyVocabularyBundle(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.entityBindings).toEqual(bundle.entityBindings);
      expect(verified.value.workItems).toEqual(bundle.workItems);
      expect(verified.value.measurementMethods).toEqual(bundle.measurementMethods);
      expect(verified.value.costClassifications).toEqual(bundle.costClassifications);
      expect(verified.value.verificationMethods).toEqual(bundle.verificationMethods);
      expect(verified.value.constraintDescriptors).toEqual(bundle.constraintDescriptors);
      expect(verified.value.outcomeTypes).toEqual(bundle.outcomeTypes);
      expect(verified.value.deploymentEnvironments).toEqual(bundle.deploymentEnvironments);
    }
  });

  it('every work template round-trips', () => {
    for (const template of softwareWorkTemplates()) {
      const verified = verifyWorkTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('every deploy-proposal template round-trips', () => {
    for (const template of softwareDeployProposalTemplates()) {
      const verified = verifyDeployProposalTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('the roadmap view round-trips through its schema AND its digest verification', () => {
    const roadmap = projectRoadmap(chain.program);
    if (!roadmap.ok) {
      throw new Error('fixture roadmap failed to project');
    }
    const json = JSON.parse(JSON.stringify(roadmap.value));
    expect(RoadmapViewSchema.safeParse(json).success).toBe(true);
    const verified = verifyRoadmapView(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(roadmap.value);
    }
  });

  it('the backlog view round-trips through its schema AND its digest verification', () => {
    const backlog = projectBacklog({
      program: chain.program,
      delivery: chain.delivery,
      workItemIndex: workItemIndex(),
    });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    const json = JSON.parse(JSON.stringify(backlog.value));
    expect(BacklogViewSchema.safeParse(json).success).toBe(true);
    const verified = verifyBacklogView(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(backlog.value);
    }
  });

  it('the deployment-plan view round-trips through its schema AND its digest verification', () => {
    const plan = projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    if (!plan.ok) {
      throw new Error('fixture deployment plan failed to project');
    }
    const json = JSON.parse(JSON.stringify(plan.value));
    expect(DeploymentPlanViewSchema.safeParse(json).success).toBe(true);
    const verified = verifyDeploymentPlanView(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(plan.value);
    }
  });

  it('the outcome views round-trip through their schema', () => {
    const views = projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES);
    for (const view of views) {
      const parsed = SoftwareOutcomeViewSchema.safeParse(JSON.parse(JSON.stringify(view)));
      expect(parsed.success, view.recordId).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual(view);
      }
    }
  });

  it('the rendered deploy proposal round-trips through the W003 admission pipeline', () => {
    const template = softwareDeployProposalTemplates().find(
      (candidate) => candidate.templateId === 'software.deploy.template.release-rollout',
    )!;
    const rendered = renderDeployProposal(template, deployProposalParams());
    if (!rendered.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    const reAdmitted = parseActionProposal(JSON.parse(JSON.stringify(rendered.value)));
    expect(reAdmitted.ok).toBe(true);
    if (reAdmitted.ok) {
      expect(reAdmitted.value).toEqual(rendered.value);
    }
  });
});
