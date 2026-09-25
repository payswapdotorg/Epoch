// Plan admission battery: the consumer-side total entry point
// (parseRenderPlan) admits compiled plans and rejects tampered,
// foreign-version, unsorted, inconsistent, and cross-tenant plan
// documents with typed errors.
import { describe, expect, it } from 'vitest';
import { parseRenderPlan, sealRenderPlan, serializeRenderPlan } from '../src/index';
import { compiledPlan, expectFailure, TENANT_A } from './fixtures';

describe('plan admission (positive)', () => {
  it('admits every compiled plan kind with the owning tenant', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const plan = compiledPlan(kind);
      const admitted = parseRenderPlan(JSON.parse(serializeRenderPlan(plan)), {
        expectedTenantId: TENANT_A,
      });
      expect(admitted.ok, `${kind} plan must admit`).toBe(true);
    }
  });
});

describe('plan admission (negative)', () => {
  it('rejects a plan with a foreign protocolVersion (version-unsupported)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    plan.protocolVersion = '2.0.0';
    const failure = expectFailure(parseRenderPlan(plan), 'version-unsupported');
    expect(failure.expected).toBe('1.0.0');
    expect(failure.encountered).toBe('2.0.0');
  });

  it('rejects a tampered plan digest (digest-mismatch)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    // Tamper AFTER sealing: change a label's text without recomputing the digest.
    for (const stage of plan.stages) {
      if (stage.stage === 'draw-2d') {
        for (const draw of stage.draws) {
          if (draw.op === 'draw-label') draw.text = 'Tampered plan text';
        }
      }
    }
    const failure = expectFailure(parseRenderPlan(plan), 'digest-mismatch');
    expect(failure.path).toEqual(['digest']);
  });

  it('rejects a cross-tenant admission (cross-tenant-denied)', () => {
    const serialized = serializeRenderPlan(compiledPlan('presence'));
    const failure = expectFailure(
      parseRenderPlan(JSON.parse(serialized), { expectedTenantId: 'tenant-beta' }),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe('tenant-beta');
    expect(failure.encounteredTenantId).toBe(TENANT_A);
  });

  it('rejects unsorted draws (canonical ordering is enforced, malformed-descriptor)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    const draw = plan.stages.find((stage: { stage: string }) => stage.stage === 'draw-2d');
    // Swap the two draws (label first -> shape first breaks (zIndex, nodeId) order).
    draw.draws.reverse();
    // Usage/node accounting stays consistent; only the ordering breaks.
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.some((issue) => issue.message.includes('draws must be sorted'))).toBe(
      true,
    );
  });

  it('rejects stages out of canonical pipeline order', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('animation')));
    // Reverse the stage order (animate before place-3d before relate).
    plan.stages.reverse();
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.some((issue) => issue.message.includes('canonical pipeline order'))).toBe(
      true,
    );
  });

  it('rejects a stage foreign to the plan graph kind', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    plan.stages.push({ stage: 'controls', controls: [] });
    // The empty controls stage is itself invalid, but the kind-legality
    // refinement fires first in the issue list order-independent way: any
    // schema failure surfaces as malformed-descriptor.
    expect(parseRenderPlan(plan).ok).toBe(false);
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.length).toBeGreaterThan(0);
  });

  it('rejects inconsistent usage accounting (op node ids vs claimed nodes)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    plan.usage.nodes = 5;
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.some((issue) => issue.message.includes('distinct node ids'))).toBe(true);
  });

  it('rejects inconsistent edge accounting (relate stage vs claimed edges)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    plan.usage.edges = 0;
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.some((issue) => issue.message.includes('usage.edges'))).toBe(true);
  });

  it('rejects a label op anchoring to an unknown plan node (unknown-reference)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    const draw = plan.stages.find((stage: { stage: string }) => stage.stage === 'draw-2d');
    for (const op of draw.draws) {
      if (op.op === 'draw-label') op.anchorNodeIds = ['xn-not-in-plan'];
    }
    // The anchor resolvability violation first breaks at the schema
    // refinement (anchor exists in plan); the parse resolvability gate is
    // the typed backstop. Either way the plan is rejected.
    const result = parseRenderPlan(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['malformed-descriptor', 'unknown-reference']).toContain(result.error.code);
    }
  });

  it('rejects unknown (vendor) fields on the plan root (strict objects)', () => {
    const plan = JSON.parse(serializeRenderPlan(compiledPlan('2d')));
    plan.vendorExtra = 'smuggled';
    const failure = expectFailure(parseRenderPlan(plan), 'malformed-descriptor');
    expect(failure.issues.some((issue) => issue.path === 'vendorExtra')).toBe(true);
  });

  it('sealRenderPlan rejects invalid content with typed issues (total sealing)', () => {
    const failure = expectFailure(
      sealRenderPlan({ schema: 'epoch.render-plan', protocolVersion: '1.0.0' }),
      'malformed-descriptor',
    );
    expect(failure.issues.length).toBeGreaterThan(0);
  });

  it('handles absurd inputs totally (typed errors, no exceptions)', () => {
    for (const input of [null, undefined, 7, 'plan', [], {}, { protocolVersion: 9 }]) {
      const result = parseRenderPlan(input);
      expect(result.ok).toBe(false);
    }
  });
});
