// RUNTIME DEPENDENCY POLICY (the W046 pin): the service's runtime
// dependencies are EXACTLY the composed authority set + the W046 seams +
// zod — NOTHING else. Evidence: this test reads the package manifest and
// asserts the exact sets (the W045 pattern). No pg/pglite reference
// exists (the binding is structural; the catalog pin is pending the Tech
// Lead reconcile — see docs/product-runtime/limitations.md).
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

const EXPECTED_RUNTIME = [
  '@epoch/access-projection',
  '@epoch/action-gateway',
  '@epoch/actualization',
  '@epoch/agent-protocol',
  '@epoch/alerts',
  '@epoch/authentication',
  '@epoch/authorization',
  '@epoch/capability-discovery',
  '@epoch/client-runtime',
  '@epoch/constraint-language',
  '@epoch/event-log',
  '@epoch/evidence',
  '@epoch/execution-tracking',
  '@epoch/identity',
  '@epoch/learning-calibration',
  '@epoch/marketplace',
  '@epoch/object-storage',
  '@epoch/persistence',
  '@epoch/procurement',
  '@epoch/solution-delivery',
  '@epoch/supervision',
  '@epoch/tenancy',
  '@epoch/verification',
  '@epoch/world-model',
  'zod',
];

describe('the frozen runtime dependency policy (W046 pin)', () => {
  it('runtime dependencies are EXACTLY the composed authority set + the W046 seams + zod', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual(EXPECTED_RUNTIME);
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

  it('NO pg / @types/pg / @electric-sql/pglite reference anywhere (structural binding until the catalog materializes)', () => {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const specifier of Object.keys(all)) {
      expect(['pg', '@types/pg', '@electric-sql/pglite'].includes(specifier), `${specifier} must not be referenced (catalog pin pending Tech Lead reconcile)`).toBe(false);
    }
  });

  it('all @epoch runtime deps use workspace: protocol + catalog pins only (no version literals)', () => {
    for (const [specifier, version] of Object.entries(manifest.dependencies)) {
      expect(version === 'workspace:*' || version === 'catalog:', `${specifier} -> ${version}`).toBe(true);
    }
    for (const [specifier, version] of Object.entries(manifest.devDependencies)) {
      expect(version === 'workspace:*' || version === 'catalog:', `${specifier} -> ${version}`).toBe(true);
    }
  });
});
