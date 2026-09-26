// W017 acceptance: experience mounting — the shell mounts W011 Experience
// Graph projections through W012 compiler artifacts (REAL compiler output
// in fixtures) and drives W013 renderer invocations; admitInvocation is
// honored (never bypassed), and every bypass attempt is a typed
// authority-violation. Tampered digests, cross-tenant offers, and W013
// denials surface as typed errors with the verbatim cause.
import { describe, expect, it } from 'vitest';
import { admitInvocation, bindRendererSession } from '@epoch/renderer-runtime';
import {
  KIND_COMPLETE_RENDERER,
  admitExperienceOffer,
  advanceFrame,
  mountExperience,
  rejectAdmissionBypass,
  submitIntent,
} from '../src/index';
import { DESKTOP_DEVICE } from '../src/index';
import { TENANT_A, TENANT_B, compiledExperience, compiledPlan, expectFailure } from './fixtures';

const CONTEXT_A = { tenantId: TENANT_A };

function boundBinding() {
  const bound = bindRendererSession({
    rendererSessionId: 'rs-alpha',
    renderer: KIND_COMPLETE_RENDERER,
    device: {
      deviceSessionId: 'ds-alpha',
      tenantScope: { tenantId: TENANT_A },
      device: DESKTOP_DEVICE,
    },
    boundAtMs: 0,
  });
  if (!bound.ok) {
    throw new Error(bound.error.message);
  }
  return bound.value;
}

describe('experience-offer admission', () => {
  it('admits a REAL W011 graph + W012 compiled plan for the session tenant', () => {
    const experience = compiledExperience('2d');
    const admitted = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: experience.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.graph.digest).toBe(experience.graph.digest);
      expect(admitted.value.plan.sourceEnvelopeDigest).toBe(experience.graph.digest);
      expect(admitted.value.plan.digest).toBe(experience.plan.digest);
      expect(admitted.value.plan.target.deviceClass).toBe('desktop');
      expect(admitted.value.offeredByEnvelopeId).toBe('env-host-0003');
    }
  });

  it('admits 3d experiences with declared spatial usage from the compiled plan', () => {
    const experience = compiledExperience('3d');
    const admitted = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: experience.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expect(admitted.ok).toBe(true);
  });

  it('rejects a cross-tenant graph with the typed cross-tenant-denied (R12)', () => {
    const foreign = compiledExperience('2d', { tenantScope: { tenantId: TENANT_B } });
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: foreign.graph, plan: foreign.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'cross-tenant-denied');
  });

  it('rejects a plan compiled from a different graph revision (digest-mismatch, chain gate)', () => {
    const experience = compiledExperience('2d');
    const other = compiledExperience('2d', { variant: 2 }); // a DIFFERENT graph
    expect(other.graph.digest).not.toBe(experience.graph.digest);
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: other.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'digest-mismatch');
  });

  it('rejects a tampered plan document (digest-mismatch, tamper detection)', () => {
    const experience = compiledExperience('2d');
    const tampered = {
      ...experience.plan,
      usage: { ...experience.plan.usage, estimatedTriangles: 999 },
    };
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: tampered },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'digest-mismatch');
  });

  it('rejects a plan scoped to another tenant (cross-tenant-denied)', () => {
    const experience = compiledExperience('2d');
    const foreignPlan = {
      ...experience.plan,
      tenantScope: { tenantId: TENANT_B },
    };
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: foreignPlan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'digest-mismatch'); // tampered first (digest covers the scope)
  });

  it('rejects a plan compiled for a non-desktop target (device-mismatch)', () => {
    // Compile the SAME graph with the REAL compiler for a phone-class
    // device: the plan is internally consistent (valid digest, valid
    // chain) but targets a foreign ladder rung.
    const experience = compiledExperience('2d');
    const phonePlan = compiledPlan(experience.graph, {
      device: {
        descriptorVersion: 1,
        deviceClass: 'phone' as const,
        interaction: ['touch'],
        display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
    });
    if (!phonePlan.ok) {
      throw new Error(phonePlan.error.message);
    }
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: phonePlan.value },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'device-mismatch');
  });

  it('rejects a malformed graph with the typed malformed-record', () => {
    const experience = compiledExperience('2d');
    const rejected = admitExperienceOffer(
      CONTEXT_A,
      { graph: { schema: 'epoch.experience-graph' }, plan: experience.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    expectFailure(rejected, 'malformed-record');
  });
});

describe('W013 invocation driving (admitInvocation honored)', () => {
  it('mounts through the enforcement boundary and returns the sealed receipt', () => {
    const experience = compiledExperience('2d');
    const admitted = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: experience.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    if (!admitted.ok) {
      throw new Error(admitted.error.message);
    }
    const mounted = mountExperience({
      binding: boundBinding(),
      experience: admitted.value,
      invocationId: 'inv-alpha-0001',
      atMs: 30,
    });
    expect(mounted.ok).toBe(true);
    if (mounted.ok) {
      expect(mounted.value.receipt.kind).toBe('mount-receipt');
      if (mounted.value.receipt.kind === 'mount-receipt') {
        expect(mounted.value.receipt.graphDigest).toBe(experience.graph.digest);
      }
      expect(mounted.value.binding.mountedStateDigest).toBe(experience.graph.digest);
      expect(mounted.value.binding.invocationCount).toBe(1);
    }
  });

  it('advances frames monotonically and submits intents through the same boundary', () => {
    const binding = boundBinding();
    const frame1 = advanceFrame({ binding, frameIndex: 1, invocationId: 'inv-alpha-0001', atMs: 40 });
    expect(frame1.ok).toBe(true);
    if (!frame1.ok) {
      throw new Error(frame1.error.message);
    }
    const frame2 = advanceFrame({
      binding: frame1.value.binding,
      frameIndex: 2,
      invocationId: 'inv-alpha-0002',
      atMs: 41,
    });
    expect(frame2.ok).toBe(true);
    // Non-monotonic frames are typed W013 rejections with the cause attached.
    const regression = advanceFrame({
      binding: frame2.ok ? frame2.value.binding : binding,
      frameIndex: 2,
      invocationId: 'inv-alpha-0003',
      atMs: 42,
    });
    expectFailure(regression, 'invocation-rejected');
    if (!regression.ok && regression.error.code === 'invocation-rejected') {
      expect(regression.error.cause.code).toBe('invalid-invocation');
    }
    // An intent from an undeclared modality is a typed capability denial.
    const denied = submitIntent({
      binding: frame2.ok ? frame2.value.binding : binding,
      modality: 'gaze',
      intent: { id: 'world.view.refresh', version: '1.0.0' },
      invocationId: 'inv-alpha-0004',
    });
    expectFailure(denied, 'invocation-rejected');
    if (!denied.ok && denied.error.code === 'invocation-rejected') {
      expect(denied.error.cause.code).toBe('capability-denied');
    }
    // A declared modality admits the typed intent.
    const admitted = submitIntent({
      binding: frame2.ok ? frame2.value.binding : binding,
      modality: 'pointer',
      intent: { id: 'world.view.refresh', version: '1.0.0' },
      invocationId: 'inv-alpha-0005',
    });
    expect(admitted.ok).toBe(true);
  });
});

describe('the admission-bypass guard (typed negative surface)', () => {
  it('rejects direct binding writes with the typed authority-violation', () => {
    const rejected = rejectAdmissionBypass({
      kind: 'direct-binding-write',
      detail: 'attempting to set mountedStateDigest without an invocation',
    });
    expectFailure(rejected, 'authority-violation');
  });

  it('rejects unadmitted mounts with the typed authority-violation', () => {
    const rejected = rejectAdmissionBypass({
      kind: 'unadmitted-mount',
      detail: 'mounting a graph digest without an invocation envelope',
    });
    expectFailure(rejected, 'authority-violation');
  });

  it('rejects receipt forgery with the typed authority-violation', () => {
    const rejected = rejectAdmissionBypass({
      kind: 'receipt-forgery',
      detail: 'appending a fabricated receipt to the log',
    });
    expectFailure(rejected, 'authority-violation');
  });

  it('a raw admitInvocation call with a malformed envelope is denied by the W013 boundary itself', () => {
    // The shell never calls admitInvocation with anything but a typed
    // envelope it constructed; this pins that the boundary rejects the
    // shapes a bypass attempt would produce.
    const denied = admitInvocation(boundBinding(), { kind: 'mount-graph' }, {});
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('malformed-invocation');
    }
  });

  it('a mount without the graph document is denied by the W013 boundary (typed cause chain)', () => {
    const experience = compiledExperience('2d');
    const admitted = admitExperienceOffer(
      CONTEXT_A,
      { graph: experience.graph, plan: experience.plan },
      { envelopeId: 'env-host-0003', atMs: 20 },
    );
    if (!admitted.ok) {
      throw new Error(admitted.error.message);
    }
    // Hand-built envelope WITHOUT supplying the graph document — the exact
    // shape an attempted bypass would take.
    const denied = admitInvocation(
      boundBinding(),
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'mount-graph',
        invocationId: 'inv-alpha-0001',
        rendererSessionId: 'rs-alpha',
        graphDigest: experience.graph.digest,
        atMs: 30,
      },
      {},
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('malformed-invocation');
    }
  });
});
