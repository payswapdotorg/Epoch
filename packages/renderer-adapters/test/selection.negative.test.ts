// Negative battery: typed rejections — invalid ids, malformed inputs,
// version skew, digest tampering, decision-input mismatch, and
// vendor-field smuggling.
import { describe, expect, it } from 'vitest';
import {
  selectRendererAdapter,
  parseRendererAdapterSelection,
  planMount,
  parseRendererMountPlan,
} from '../src/index';
import {
  boundSession,
  desktopDevice,
  headsetDevice,
  assess,
  FULL_RENDERER,
  expectFailure,
} from './fixtures';

describe('adapter selection (negative)', () => {
  it('rejects an invalid selection id as a typed malformed-record', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-id');
    const result = selectRendererAdapter({ selectionId: 'not-an-id', binding, assessment });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toBe('$');
  });

  it('rejects a malformed binding (W013 admission wraps typed with paths)', () => {
    const assessment = assess(desktopDevice(), 'dca-neg-binding');
    const result = selectRendererAdapter({
      selectionId: 'ras-neg-binding',
      binding: { nope: true },
      assessment,
    });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toContain('binding');
  });

  it('rejects a binding with a vendor field at a precise typed path', () => {
    const binding = { ...boundSession(FULL_RENDERER), engine: 'some-engine' } as unknown;
    const assessment = assess(desktopDevice(), 'dca-neg-vendor');
    const result = selectRendererAdapter({ selectionId: 'ras-neg-vendor', binding, assessment });
    const error = expectFailure(result, 'malformed-record');
    expect(
      error.issues.some((issue) => issue.path.includes('engine') || issue.message.includes('engine')),
    ).toBe(true);
  });

  it('rejects a malformed assessment (device-capabilities admission wraps typed)', () => {
    const binding = boundSession(FULL_RENDERER);
    const result = selectRendererAdapter({
      selectionId: 'ras-neg-assessment',
      binding,
      assessment: { nope: true },
    });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toContain('assessment');
  });

  it('rejects an assessment that does not assess the binding device (integrity gate)', () => {
    const binding = boundSession(FULL_RENDERER); // desktop device
    const otherAssessment = assess(headsetDevice(), 'dca-neg-mismatch'); // headset device
    const result = selectRendererAdapter({
      selectionId: 'ras-neg-mismatch',
      binding,
      assessment: otherAssessment,
    });
    const error = expectFailure(result, 'assessment-device-mismatch');
    expect(error.message).toContain('same device');
  });

  it('rejects a tampered assessment digest (content addressing integrity)', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-tamper');
    const tampered = { ...assessment, digest: 'f'.repeat(64) };
    const result = selectRendererAdapter({
      selectionId: 'ras-neg-tamper',
      binding,
      assessment: tampered,
    });
    expectFailure(result, 'malformed-record');
  });

  it('rejects version skew before schema validation (version-unsupported)', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-version');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-version', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const skewed = { ...selection.value, protocolVersion: '2.0.0' };
    const error = expectFailure(parseRendererAdapterSelection(skewed), 'version-unsupported');
    expect(error.expected).toBe('1.0.0');
    expect(error.encountered).toBe('2.0.0');
  });

  it('rejects a tampered selection digest', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-digest');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-digest', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const tampered = { ...selection.value, digest: '0'.repeat(64) };
    const error = expectFailure(parseRendererAdapterSelection(tampered), 'digest-mismatch');
    expect(error.expected).toBe(selection.value.digest);
  });

  it('rejects a hand-edited decision trace (canonical consistency)', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-trace');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-trace', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    // Drop a trace entry: the trace must cover every technique.
    const edited = {
      ...selection.value,
      trace: selection.value.trace.slice(0, 3),
    };
    expectFailure(parseRendererAdapterSelection(edited), 'malformed-record');
  });

  it('rejects a fallback chain that carries an ineligible technique', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-chain');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-chain', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    // immediate-2d is ineligible (kind-not-hosted) on this binding.
    const edited = {
      ...selection.value,
      fallbackChain: [...selection.value.fallbackChain, 'immediate-2d'],
    };
    expectFailure(parseRendererAdapterSelection(edited), 'malformed-record');
  });

  it('rejects a chosen technique the trace marks ineligible', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-chosen');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-chosen', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const edited = { ...selection.value, technique: 'immediate-2d' };
    expectFailure(parseRendererAdapterSelection(edited), 'malformed-record');
  });

  it('rejects cross-tenant admission', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-x-tenant');
    const selection = selectRendererAdapter({ selectionId: 'ras-neg-x-tenant', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    expectFailure(
      parseRendererAdapterSelection(selection.value, { expectedTenantId: 'tenant-beta' }),
      'cross-tenant-denied',
    );
  });

  it('rejects a non-object root', () => {
    expectFailure(parseRendererAdapterSelection(null), 'malformed-record');
    expectFailure(parseRendererAdapterSelection([1, 2]), 'malformed-record');
  });
});

describe('mount planning (negative)', () => {
  function selectionFixture() {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-plan-neg');
    const selection = selectRendererAdapter({ selectionId: 'ras-plan-neg', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    return selection.value;
  }

  it('rejects an invalid plan id', () => {
    const result = planMount({
      planId: 'not-a-plan',
      invocationId: 'inv-plan-neg-1',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toBe('$');
  });

  it('rejects an invalid invocation id', () => {
    const result = planMount({
      planId: 'rmp-plan-neg-2',
      invocationId: 'bad invocation id',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    expectFailure(result, 'malformed-record');
  });

  it('rejects a malformed selection', () => {
    const result = planMount({
      planId: 'rmp-plan-neg-3',
      invocationId: 'inv-plan-neg-3',
      selection: { nope: true },
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toContain('selection');
  });

  it('rejects an invalid graph digest', () => {
    const result = planMount({
      planId: 'rmp-plan-neg-4',
      invocationId: 'inv-plan-neg-4',
      selection: selectionFixture(),
      graphDigest: 'not-a-digest',
      graphKind: '3d',
    });
    expectFailure(result, 'malformed-record');
  });

  it('rejects cross-tenant planning', () => {
    const result = planMount(
      {
        planId: 'rmp-plan-neg-5',
        invocationId: 'inv-plan-neg-5',
        selection: selectionFixture(),
        graphDigest: 'a'.repeat(64),
        graphKind: '3d',
      },
      { expectedTenantId: 'tenant-beta' },
    );
    expectFailure(result, 'cross-tenant-denied');
  });

  it('rejects version skew on plan admission', () => {
    const planned = planMount({
      planId: 'rmp-plan-neg-6',
      invocationId: 'inv-plan-neg-6',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    if (!planned.ok) throw new Error('fixture failed');
    const skewed = { ...planned.value, protocolVersion: '2.0.0' };
    expectFailure(parseRendererMountPlan(skewed), 'version-unsupported');
  });

  it('rejects a tampered plan digest', () => {
    const planned = planMount({
      planId: 'rmp-plan-neg-7',
      invocationId: 'inv-plan-neg-7',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    if (!planned.ok) throw new Error('fixture failed');
    const tampered = { ...planned.value, digest: '0'.repeat(64) };
    expectFailure(parseRendererMountPlan(tampered), 'digest-mismatch');
  });

  it('rejects a vendor field on the plan (strict admission)', () => {
    const planned = planMount({
      planId: 'rmp-plan-neg-8',
      invocationId: 'inv-plan-neg-8',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    if (!planned.ok) throw new Error('fixture failed');
    const vendored = { ...planned.value, engine: 'some-engine' };
    expectFailure(parseRendererMountPlan(vendored), 'malformed-record');
  });

  it('rejects a negative virtual instant', () => {
    const result = planMount({
      planId: 'rmp-plan-neg-9',
      invocationId: 'inv-plan-neg-9',
      selection: selectionFixture(),
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
      atMs: -1,
    });
    expectFailure(result, 'malformed-record');
  });
});

describe('selection integrity edge (tampered binding digest)', () => {
  it('a binding whose digest was tampered fails W013 admission before selection', () => {
    // The binding is re-validated by the REAL W013 schema at selection
    // admission; digest tampering surfaces as a typed malformed-record.
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neg-binding-digest');
    const tampered = { ...binding, digest: 'f'.repeat(64) };
    const result = selectRendererAdapter({
      selectionId: 'ras-neg-binding-digest',
      binding: tampered,
      assessment,
    });
    expectFailure(result, 'malformed-record');
  });
});
