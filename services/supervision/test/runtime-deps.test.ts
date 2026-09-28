// RUNTIME DEPENDENCY POLICY (frozen by the W043 dispatch pin): the
// supervision-runtime service's runtime dependencies are EXACTLY
// @epoch/authorization, @epoch/supervision, @epoch/alerts,
// @epoch/tenancy and zod — NOTHING else. Evidence: this test reads the
// package manifest and asserts the exact sets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('the frozen runtime dependency policy (W043 pin)', () => {
  it('runtime dependencies are EXACTLY the pinned set', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/alerts',
      '@epoch/authorization',
      '@epoch/supervision',
      '@epoch/tenancy',
      'zod',
    ]);
  });

  it('no third-party dependency beyond zod (workspace @epoch deps + catalog pins only)', () => {
    for (const specifier of [...Object.keys(manifest.dependencies)]) {
      expect(
        specifier.startsWith('@epoch/') || specifier === 'zod',
        `${specifier} is not in the frozen policy`,
      ).toBe(true);
    }
    expect(manifest.dependencies.zod).toBe('catalog:');
  });
});
