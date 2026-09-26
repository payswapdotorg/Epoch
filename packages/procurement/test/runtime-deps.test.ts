// RUNTIME DEPENDENCY POLICY (frozen by the W037 dispatch pin): the
// kernel's runtime dependencies are EXACTLY @epoch/solution-delivery,
// @epoch/agent-protocol, @epoch/tenancy and zod — NOTHING else. The
// parity devDependencies are @epoch/policy-contracts,
// @epoch/constraint-language, @epoch/event-log, @epoch/evidence,
// @epoch/verification. Evidence: this test reads the package manifest
// and asserts the exact sets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('the frozen runtime dependency policy (W037 pin)', () => {
  it('runtime dependencies are EXACTLY the pinned set', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/agent-protocol',
      '@epoch/solution-delivery',
      '@epoch/tenancy',
      'zod',
    ]);
  });

  it('the parity devDependencies include the pinned kernel set', () => {
    const devDeps = new Set(Object.keys(manifest.devDependencies));
    for (const pinned of [
      '@epoch/policy-contracts',
      '@epoch/constraint-language',
      '@epoch/event-log',
      '@epoch/evidence',
      '@epoch/verification',
    ]) {
      expect(devDeps.has(pinned), pinned).toBe(true);
    }
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
