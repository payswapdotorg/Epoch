// Regression test (foundation fix, PR wave1-reconcile): the shared eslint
// config's layerRestrictions() must emit an ESLint-10-valid
// no-restricted-imports object. The W001 version emitted `group`-shaped
// entries under `paths` — `group` is only valid under `patterns` — which
// made ESLint reject the config for any layer with real restrictions
// (kernel/contracts/pack). Reported by the W004 worker (PR #7, arch Q1).
//
// Harness notes:
// - Fixture specifiers are assembled at runtime via join(): a literal
//   `from '@epoch/...'` in this file is a false positive for the static
//   boundary scanner (W001 test-kit convention).
// - Do NOT pass a `files` key in the Linter.verify config: a flat config
//   carrying `files` does not apply to the filename-less verify() context
//   and the rules silently do not run (verified empirically).
import { describe, expect, it } from 'vitest';
import { layerRestrictions } from '@epoch/eslint-config/boundary.mjs';
import { Linter } from 'eslint';

const linter = new Linter();
const LO = { ecmaVersion: 'latest', sourceType: 'module' };
const WEB = ['@epoch', 'web'].join('/');
const WORLD_MODEL = ['@epoch/world', 'model'].join('-');

function ruleOptionsFor(layer) {
  const cfg = layerRestrictions({ layer });
  const rule = cfg.rules?.['no-restricted-imports'];
  return Array.isArray(rule) ? rule[1] : null;
}

function verifyImport(cfg, spec) {
  const code = `import { thing } from '${spec}';\nexport const out = thing;\n`;
  return linter.verify(code, { languageOptions: LO, ...cfg });
}

describe('layerRestrictions emits ESLint-10-valid no-restricted-imports', () => {
  it('uses patterns (not paths) for group-shaped entries', () => {
    const cfg = ruleOptionsFor('kernel');
    expect(cfg).toBeTruthy();
    expect(Array.isArray(cfg.paths)).toBe(false);
    expect(Array.isArray(cfg.patterns)).toBe(true);
    for (const entry of cfg.patterns) {
      expect(Array.isArray(entry.group)).toBe(true);
      expect(typeof entry.message).toBe('string');
    }
  });

  it('ESLint accepts the config and flags a kernel->app import', () => {
    const cfg = layerRestrictions({ layer: 'kernel' });
    const messages = verifyImport(cfg, WEB);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].ruleId).toBe('no-restricted-imports');
    expect(String(messages[0].message)).toContain(`may not import '${WEB}'`);
  });

  it('ESLint accepts the config and allows a kernel->kernel import', () => {
    const cfg = layerRestrictions({ layer: 'kernel' });
    expect(verifyImport(cfg, WORLD_MODEL)).toEqual([]);
  });

  it('tooling layer restricts non-tooling packages per the layer matrix', () => {
    // tooling -> tooling only: a tooling package importing a kernel package
    // must be flagged (the layer matrix, not "no restrictions").
    const cfg = layerRestrictions({ layer: 'tooling' });
    const messages = verifyImport(cfg, WORLD_MODEL);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].ruleId).toBe('no-restricted-imports');
  });
});
