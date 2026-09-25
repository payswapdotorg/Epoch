// Interaction-intent negatives: malformed and unknown intents, version
// skew, and the EXECUTABLE-UI law (the Dynamic UI negative class) —
// agents emit typed intents, never arbitrary executable UI code.
import { describe, expect, it } from 'vitest';
import {
  admitWorldIntent,
  scanExecutableUiViolations,
  EXECUTABLE_UI_KEY_SEGMENTS,
} from '../src/index';
import { expectFailure, intentFixtures } from './fixtures';

describe('world interaction intents (negative)', () => {
  it('an unknown intent kind is rejected with invalid-intent', () => {
    const failure = expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'teleport',
        intentId: 'intent-teleport-1',
      }),
      'invalid-intent',
    );
    expect(failure.issues.length).toBeGreaterThan(0);
  });

  it('a malformed intent (missing required fields) is rejected with invalid-intent', () => {
    const failure = expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'select',
        intentId: 'intent-select-missing-target',
      }),
      'invalid-intent',
    );
    expect(failure.issues[0]?.path).toContain('entityId');
  });

  it('a non-object intent root is rejected with invalid-intent', () => {
    expectFailure(admitWorldIntent('select-wall'), 'invalid-intent');
    expectFailure(admitWorldIntent([1, 2, 3]), 'invalid-intent');
    expectFailure(admitWorldIntent(null), 'invalid-intent');
  });

  it('intent version skew fails fast with version-unsupported', () => {
    const failure = expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 2,
        kind: 'select',
        intentId: 'intent-select-v2',
        entityId: 'wall-north-1',
      }),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1');
    expect(failure.encountered).toBe('2');
  });

  it('unknown vendor fields are rejected (strict objects)', () => {
    expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'select',
        intentId: 'intent-select-vendor',
        entityId: 'wall-north-1',
        vendorEngine: 'threejs',
      }),
      'invalid-intent',
    );
  });

  // -----------------------------------------------------------------------
  // The Dynamic UI law (binding): EXECUTABLE-UI intents are rejected with
  // the dedicated typed code — distinguishable from generic malformation.
  // -----------------------------------------------------------------------

  it('an intent carrying a script field is rejected with executable-ui-rejected (the Dynamic UI law negative)', () => {
    const failure = expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'select',
        intentId: 'intent-select-script',
        entityId: 'wall-north-1',
        script: 'alert("injected")',
      }),
      'executable-ui-rejected',
    );
    expect(failure.offendingKey).toBe('script');
  });

  it('an intent carrying an html field is rejected with executable-ui-rejected', () => {
    const failure = expectFailure(
      admitWorldIntent({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'annotate',
        intentId: 'intent-annotate-html',
        entityId: 'wall-north-1',
        text: 'note',
        html: '<img src=x onerror=alert(1)>',
      }),
      'executable-ui-rejected',
    );
    expect(failure.offendingKey).toBe('html');
  });

  it('executable content nested inside a change-intent value is found by the recursive scan', () => {
    const violations = scanExecutableUiViolations({
      kind: 'change',
      value: { label: 'x', js: 'malicious()' },
    });
    expect(violations.length).toBe(1);
    expect(violations[0]?.offendingKey).toBe('js');
    expect(violations[0]?.path).toEqual(['value', 'js']);
  });

  it('executable content nested inside arrays is found by the recursive scan', () => {
    const violations = scanExecutableUiViolations({
      kind: 'change',
      value: [{ wasm: 'bytes' }, { safe: 1 }],
    });
    expect(violations.map((v) => v.offendingKey)).toEqual(['wasm']);
  });

  it('clean intents produce no executable-ui violations', () => {
    for (const intent of intentFixtures()) {
      expect(scanExecutableUiViolations(intent)).toEqual([]);
    }
  });

  it('the executable-UI gate runs BEFORE schema validation (the violation is distinguishable)', () => {
    // The payload ALSO violates the strict schema (unknown field), but the
    // executable-UI gate fires first with its dedicated typed code.
    const result = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'intent-select-both',
      entityId: 'wall-north-1',
      code: 'deleteEverything()',
    });
    expectFailure(result, 'executable-ui-rejected');
  });

  it('the executable key vocabulary covers the pinned segments', () => {
    expect([...EXECUTABLE_UI_KEY_SEGMENTS].sort()).toEqual([
      'bytecode',
      'code',
      'eval',
      'executable',
      'expression',
      'function',
      'html',
      'javascript',
      'js',
      'lambda',
      'module',
      'script',
      'wasm',
    ]);
  });

  it('hyphenated and dotted executable keys are detected (token-based matching)', () => {
    const violations = scanExecutableUiViolations({ 'inline-script': 1, 'module.code': 2 });
    expect(violations.map((v) => v.offendingKey).sort()).toEqual(['inline-script', 'module.code']);
  });
});
