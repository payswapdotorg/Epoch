// RUNTIME DEPENDENCY POLICY (frozen by the W030 dispatch pin): the
// kernel's runtime dependencies are EXACTLY @epoch/agent-protocol and
// zod — NOTHING else. The parity devDependencies are
// @epoch/tenancy, @epoch/identity, @epoch/event-log,
// @epoch/authorization, @epoch/extension-runtime and
// @epoch/access-projection (the kernel-to-kernel devDep pattern).
// Evidence: this test reads the package manifest and asserts the
// exact sets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('the frozen runtime dependency policy (W030 pin)', () => {
  it('runtime dependencies are EXACTLY the pinned set', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/agent-protocol',
      'zod',
    ]);
  });

  it('the parity devDependencies include the pinned kernel set', () => {
    const devDeps = new Set(Object.keys(manifest.devDependencies));
    for (const pinned of [
      '@epoch/tenancy',
      '@epoch/identity',
      '@epoch/event-log',
      '@epoch/authorization',
      '@epoch/extension-runtime',
      '@epoch/access-projection',
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
  });

  it('the kernel layer is declared (boundary model)', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')) as {
      epoch: { layer: string };
    };
    expect(pkg.epoch.layer).toBe('kernel');
  });
});
