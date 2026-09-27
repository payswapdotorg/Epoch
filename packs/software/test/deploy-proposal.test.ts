// NAMED: the deploy-proposal seam — deployment actions leave the pack as
// typed W003 action proposals ONLY (renderDeployProposal -> the W003
// admission pipeline -> the W022 Action Gateway). The pack has NO execute
// path: gateway-bypass-rejected classifies execution attempts at the pack
// admission surfaces, and the exported surface exposes no execution entry
// point (surface.test.ts).
import { describe, expect, it } from 'vitest';
import { parseActionProposal } from '@epoch/action-protocol';
import {
  renderDeployProposal,
  sealDeployProposalTemplate,
  softwareDeployProposalTemplates,
  verifyDeployProposalTemplate,
} from '../src/index';
import { deployProposalParams, T5 } from './fixtures';

const TEMPLATE_IDS = [
  'software.deploy.template.infrastructure-change',
  'software.deploy.template.release-rollout',
  'software.deploy.template.rollback',
];

describe('NAMED POSITIVE: the deploy-proposal template catalog', () => {
  it('the catalog carries the three deploy proposal templates, sealed and sorted', () => {
    const templates = softwareDeployProposalTemplates();
    expect(templates.map((template) => template.templateId)).toEqual(TEMPLATE_IDS);
    for (const template of templates) {
      expect(template.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every template carries the REQUIRED W003 safety metadata', () => {
    for (const template of softwareDeployProposalTemplates()) {
      expect(template.predictedEffects.length).toBeGreaterThanOrEqual(1);
      expect(template.authorityRequirements.requiredScopes.length).toBeGreaterThanOrEqual(1);
      expect(template.authorityRequirements.requiresHumanApproval).toBe(true);
      expect(template.authorityRequirements.approvalQuorum).toBeDefined();
      expect(template.reversibility.kind).toBeDefined();
    }
  });

  it('every template round-trips through seal -> JSON -> verify', () => {
    for (const template of softwareDeployProposalTemplates()) {
      const verified = verifyDeployProposalTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('the catalog is deterministic across calls', () => {
    expect(softwareDeployProposalTemplates()).toEqual(softwareDeployProposalTemplates());
  });
});

describe('NAMED POSITIVE: renderDeployProposal routes through the W003 admission pipeline', () => {
  const template = softwareDeployProposalTemplates().find(
    (candidate) => candidate.templateId === 'software.deploy.template.release-rollout',
  )!;

  it('the fixture params render into a proposal that ADMITS through W003', () => {
    const rendered = renderDeployProposal(template, deployProposalParams());
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    const proposal = rendered.value;
    expect(proposal.messageKind).toBe('action.proposal');
    expect(proposal.protocolVersion).toBe('1.0.0');
    expect(proposal.proposalId).toBe('checkout-v1-production-rollout');
    expect(proposal.proposedBy).toBe('agent:delivery-orchestrator');
    expect(proposal.actionType).toEqual({ id: 'software.deploy.release-rollout', version: '1.0.0' });
    expect(proposal.target).toEqual({
      kind: 'external-resource',
      ref: 'deployment:checkout-production-v1',
    });
    expect(proposal.parameters).toEqual({
      environment: 'software.environment.production',
      release_unit: 'release-checkout-v1',
      rollout_step: 'activity:deploy-production',
    });
    expect(proposal.authorityRequirements.requiredScopes).toEqual(['external:deployment:write']);
  });

  it('the rendered proposal re-admits through the W003 pipeline independently', () => {
    const rendered = renderDeployProposal(template, deployProposalParams());
    if (!rendered.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    const reAdmitted = parseActionProposal(JSON.parse(JSON.stringify(rendered.value)));
    expect(reAdmitted.ok).toBe(true);
  });

  it('the rendered proposal is deterministic (byte-identical on repeat renders)', () => {
    const first = renderDeployProposal(template, deployProposalParams());
    const second = renderDeployProposal(template, deployProposalParams());
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(second.value)).toBe(JSON.stringify(first.value));
    }
  });

  it('a parameter the template does not declare is a typed validation error', () => {
    const rendered = renderDeployProposal(template, {
      ...deployProposalParams(),
      parameters: {
        environment: 'software.environment.production',
        release_unit: 'release-checkout-v1',
        rollout_step: 'activity:deploy-production',
        rogue_parameter: 'nope',
      },
    });
    expect(rendered.ok).toBe(false);
    if (!rendered.ok) {
      expect(rendered.error.code).toBe('validation');
    }
  });

  it('a missing declared parameter is a typed validation error', () => {
    const rendered = renderDeployProposal(template, {
      ...deployProposalParams(),
      parameters: {
        environment: 'software.environment.production',
        release_unit: 'release-checkout-v1',
      },
    });
    expect(rendered.ok).toBe(false);
    if (!rendered.ok) {
      expect(rendered.error.code).toBe('validation');
    }
  });

  it('a malformed agent identity is a typed validation error (never a crash)', () => {
    const rendered = renderDeployProposal(template, {
      ...deployProposalParams(),
      proposedBy: 'not-an-agent',
    });
    expect(rendered.ok).toBe(false);
    if (!rendered.ok) {
      expect(rendered.error.code).toBe('validation');
    }
  });

  it('a tampered template seal is rejected by verification (digest-mismatch)', () => {
    const tampered = { ...template, templateVersion: '9.9.9' };
    const verified = verifyDeployProposalTemplate(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});

describe('NAMED NEGATIVE: gateway-bypass-rejected (the pack NEVER executes)', () => {
  it('a deploy-proposal template carrying executeDeploy is rejected at seal time', () => {
    const content = {
      ...softwareDeployProposalTemplates()[0]!,
    };
    delete (content as Partial<typeof content>).contentDigest;
    const sealed = sealDeployProposalTemplate({ ...content, executeDeploy: true });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('gateway-bypass-rejected');
      if (sealed.error.code === 'gateway-bypass-rejected') {
        expect(sealed.error.field).toBe('executeDeploy');
      }
    }
  });

  it('render params carrying a gatewayOverride field are rejected', () => {
    const template = softwareDeployProposalTemplates().find(
      (candidate) => candidate.templateId === 'software.deploy.template.release-rollout',
    )!;
    const rendered = renderDeployProposal(template, {
      ...deployProposalParams(),
      gatewayOverride: 'skip-the-gateway',
    });
    expect(rendered.ok).toBe(false);
    if (!rendered.ok) {
      expect(rendered.error.code).toBe('gateway-bypass-rejected');
    }
  });

  it('a template carrying deployNow is rejected at seal time', () => {
    const content = {
      ...softwareDeployProposalTemplates()[0]!,
    };
    delete (content as Partial<typeof content>).contentDigest;
    const sealed = sealDeployProposalTemplate({ ...content, deployNow: true });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('gateway-bypass-rejected');
    }
  });

  it('the rendered proposal carries NO execution vocabulary (proposals only)', () => {
    const template = softwareDeployProposalTemplates().find(
      (candidate) => candidate.templateId === 'software.deploy.template.rollback',
    )!;
    const rendered = renderDeployProposal(template, {
      proposalId: 'checkout-v1-rollback',
      proposedBy: 'agent:delivery-orchestrator',
      createdAt: T5,
      targetRef: 'deployment:checkout-production-v1',
      parameters: {
        environment: 'software.environment.production',
        release_unit: 'release-checkout-v1',
        target_step: 'activity:rollback-plan',
      },
    });
    if (!rendered.ok) {
      throw new Error('rollback proposal failed to render');
    }
    const json = JSON.stringify(rendered.value);
    expect(json.includes('execute')).toBe(false);
    expect(json.includes('dispatch')).toBe(false);
  });
});
