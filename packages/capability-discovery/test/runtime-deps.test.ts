// RUNTIME DEPENDENCY POLICY (frozen by the W045 dispatch pin): the
// kernel's runtime dependencies are EXACTLY @epoch/agent-protocol,
// @epoch/capability-registry and zod — NOTHING else. Evidence: this test
// reads the package manifest and asserts the exact sets. The pinned
// devDependencies are tooling only (no @epoch parity devDeps are needed:
// the mirrored grammars are pattern-pinned by tests, the W020 pattern).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.resolve(here, '..', 'package.json'), 'utf8'),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('the frozen runtime dependency policy (W045 pin)', () => {
  it('runtime dependencies are EXACTLY the pinned set', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/agent-protocol',
      '@epoch/capability-registry',
      'zod',
    ]);
  });

  it('no third-party dependency beyond zod (workspace @epoch deps + catalog pins only)', () => {
    for (const specifier of Object.keys(manifest.dependencies)) {
      expect(
        specifier.startsWith('@epoch/') || specifier === 'zod',
        `${specifier} is not in the frozen policy`,
      ).toBe(true);
    }
    expect(manifest.dependencies.zod).toBe('catalog:');
  });

  it('the scheduler is NOT a dependency (contract + in-memory driver only)', () => {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const specifier of Object.keys(all)) {
      expect(/cron|temporal|scheduler/i.test(specifier), `${specifier}`).toBeFalsy();
    }
  });
});
