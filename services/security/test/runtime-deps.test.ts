// RUNTIME DEPENDENCY POLICY (frozen by the W030 dispatch pin): the
// host's runtime dependencies are EXACTLY @epoch/authorization,
// @epoch/extension-runtime, @epoch/marketplace, @epoch/observability,
// @epoch/tenancy and zod — NOTHING else. The parity devDependencies
// pin compatibility with W003/W004/W007/W010/W020/W021/W022/W036/W041
// (the service-layer devDep pattern).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  epoch: { layer: string };
};

describe('the frozen runtime dependency policy (W030 pin)', () => {
  it('runtime dependencies are EXACTLY the pinned set', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/authorization',
      '@epoch/extension-runtime',
      '@epoch/marketplace',
      '@epoch/observability',
      '@epoch/tenancy',
      'zod',
    ]);
  });

  it('the parity devDependencies include the pinned upstream set', () => {
    const devDeps = new Set(Object.keys(manifest.devDependencies));
    for (const pinned of [
      '@epoch/access-projection',
      '@epoch/action-gateway',
      '@epoch/action-protocol',
      '@epoch/agent-orchestration',
      '@epoch/agent-runtime',
      '@epoch/capability-registry',
      '@epoch/event-log',
      '@epoch/policy-contracts',
      '@epoch/simulation-fabric',
      '@epoch/simulation-protocol',
      '@epoch/solution-delivery',
    ]) {
      expect(devDeps.has(pinned), pinned).toBe(true);
    }
  });

  it('no third-party runtime dependency beyond zod', () => {
    for (const specifier of Object.keys(manifest.dependencies)) {
      expect(
        specifier.startsWith('@epoch/') || specifier === 'zod',
        `${specifier} is not in the frozen policy`,
      ).toBe(true);
    }
  });

  it('the service layer is declared (boundary model)', () => {
    expect(manifest.epoch.layer).toBe('service');
  });
});
