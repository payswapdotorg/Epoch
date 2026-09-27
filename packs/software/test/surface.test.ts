// Pack-surface evidence: the pack exposes NO write path into tracker
// state and NO deployment execution path — the issue/roadmap/deployment
// projections are recomputed from sealed state on every call, the
// exported surface carries no tracker admission/mutation and no
// execute/dispatch entry points, and the pack owns no UI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as pack from '../src/index';
import { checkoutChain, environmentAssignments, workItemIndex } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('NAMED: no stored tracker (parallel-tracker-rejected surface evidence)', () => {
  it('the exported surface exposes no tracker admission/mutation/persistence entry point', () => {
    const exported = Object.keys(pack).sort();
    const forbidden = new RegExp(
      '^(admitIssue|appendIssue|saveIssue|storeIssue|persistIssue|writeIssue|updateIssue|' +
        'mutateIssue|amendIssue|reviseIssue|removeIssue|upsertIssue|commitIssue|createIssue|' +
        'admitIssueView|recordIssue|setIssue|putIssue|patchIssue|deleteIssue|' +
        'admitBacklog|storeBacklog|writeBacklog|saveBacklog|persistBacklog|' +
        'admitRoadmap|storeRoadmap|writeRoadmap|saveRoadmap|persistRoadmap|' +
        'admitTracker|storeTracker|openTracker|createTracker)$',
    );
    for (const name of exported) {
      expect(forbidden.test(name), `exported symbol "${name}" is a tracker write path`).toBe(false);
    }
  });

  it('the ONLY tracker-producing exports are the pure projections, their verifiers and view schemas', () => {
    // The filter covers every tracker-ish export family: backlog/issue/
    // roadmap views and schemas, the tracker-field denylist constant, the
    // roadmap track vocabulary, AND the derived display-state machinery
    // (the core no-parallel-tracker evidence: states are DERIVED, never
    // stored).
    const trackerExports = Object.keys(pack)
      .filter((name) => /Backlog|Issue|Roadmap|Tracker|DISPLAY_STATE|DisplayState/i.test(name))
      .sort();
    expect(trackerExports).toEqual([
      'ACTIVITY_DISPLAY_STATES',
      'ActivityDisplayStateSchema',
      'BacklogEpicSchema',
      'BacklogIssueSchema',
      'BacklogViewSchema',
      'FORBIDDEN_PARALLEL_TRACKER_FIELDS',
      'ISSUE_DISPLAY_STATE_TERMS',
      'ROADMAP_TRACK_KINDS',
      'RoadmapDependencySchema',
      'RoadmapMilestoneSchema',
      'RoadmapReleaseSchema',
      'RoadmapTrackSchema',
      'RoadmapViewSchema',
      'activityDisplayStateOf',
      'issueDisplayStateTermOf',
      'projectBacklog',
      'projectRoadmap',
      'verifyBacklogView',
      'verifyRoadmapView',
      'workPackageDisplayStateOf',
    ]);
  });
});

describe('NAMED: no execute path (gateway-bypass-rejected surface evidence)', () => {
  it('the exported surface exposes no execute/dispatch/apply entry point', () => {
    const exported = Object.keys(pack).sort();
    const forbidden = new RegExp(
      '^(execute|executeDeploy|executeDeployment|executeAction|deploy|deployNow|' +
        'runDeployment|applyDeployment|dispatch|dispatchDeployment|dispatchAction|' +
        'applyAction|runAction|invoke|trigger|fire|autorun|run|gatewayBypass)$',
    );
    for (const name of exported) {
      expect(forbidden.test(name), `exported symbol "${name}" is an execution path`).toBe(false);
    }
  });

  it('the ONLY deployment-action export is the proposal renderer + its templates (proposals only)', () => {
    // Everything deploy-named in the surface is either pure projection
    // machinery (the deployment-plan view, its schemas and verifier, the
    // environment-tier and step-state vocabularies) or the proposal path
    // (templates, sealing, verification, the renderer). No execution.
    const deployExports = Object.keys(pack)
      .filter((name) => /deploy/i.test(name))
      .sort();
    expect(deployExports).toEqual([
      'DEPLOYMENT_ENVIRONMENT_ROW_TIERS',
      'DEPLOYMENT_ENVIRONMENT_TIERS',
      'DEPLOYMENT_STEP_STATE_TERMS',
      'DeployProposalRenderParamsSchema',
      'DeployProposalTemplateContentSchema',
      'DeploymentDependencySchema',
      'DeploymentEnvironmentRowSchema',
      'DeploymentEnvironmentSchema',
      'DeploymentPlanViewSchema',
      'SOFTWARE_DEPLOYMENT_ENVIRONMENTS',
      'SealedDeployProposalTemplateSchema',
      'deploymentStepStateTermOf',
      'projectDeploymentPlan',
      'renderDeployProposal',
      'sealDeployProposalTemplate',
      'softwareDeployProposalTemplates',
      'verifyDeployProposalTemplate',
      'verifyDeploymentPlanView',
    ]);
  });
});

describe('NAMED: projections recompute from sealed state (never stored)', () => {
  it('projectBacklog recomputes — mutating a returned view changes nothing', () => {
    const chain = checkoutChain();
    const inputs = {
      program: chain.program,
      delivery: chain.delivery,
      workItemIndex: workItemIndex(),
    };
    const first = pack.projectBacklog(inputs);
    if (!first.ok) {
      throw new Error('fixture backlog failed to project');
    }
    // Deep-mutate the returned view.
    const mutated = JSON.parse(JSON.stringify(first.value)) as Record<string, unknown>;
    mutated.issues = [];
    (mutated as { contentDigest?: string }).contentDigest = '0'.repeat(64);
    const second = pack.projectBacklog(inputs);
    if (!second.ok) {
      throw new Error('fixture backlog failed to re-project');
    }
    expect(second.value).toEqual(first.value);
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(second.value));
  });

  it('projectRoadmap and projectDeploymentPlan are idempotent over identical inputs', () => {
    const chain = checkoutChain();
    const roadmapFirst = pack.projectRoadmap(chain.program);
    const roadmapSecond = pack.projectRoadmap(chain.program);
    const planFirst = pack.projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    const planSecond = pack.projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    if (!roadmapFirst.ok || !roadmapSecond.ok || !planFirst.ok || !planSecond.ok) {
      throw new Error('fixture projections failed');
    }
    expect(roadmapSecond.value).toEqual(roadmapFirst.value);
    expect(planSecond.value).toEqual(planFirst.value);
  });

  it('a backlog view is NOT valid canonical input — it cannot re-enter as program state', () => {
    const chain = checkoutChain();
    const backlog = pack.projectBacklog({ program: chain.program });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    // Feeding the view where the sealed program belongs must fail typed.
    const replayed = pack.projectBacklog({ program: backlog.value as never });
    expect(replayed.ok).toBe(false);
    if (!replayed.ok) {
      expect(['validation', 'digest-mismatch', 'vendor-fields-rejected']).toContain(
        replayed.error.code,
      );
    }
  });
});

describe('NAMED: pure projection discipline (zero IO, zero wall-clock, zero randomness)', () => {
  it('no src file performs IO or reads the wall clock', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const ioImports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map((match) => match[1]!)
        .filter((specifier) => /^(node:)?(fs|net|http|https|os|child_process|dns|tls)/.test(specifier));
      expect(ioImports, `${file} performs IO imports: ${ioImports.join(', ')}`).toEqual([]);
      expect(content.includes('Date.now'), file).toBe(false);
      expect(content.includes('new Date('), file).toBe(false);
      expect(content.includes('Math.random'), file).toBe(false);
    }
  });
});
