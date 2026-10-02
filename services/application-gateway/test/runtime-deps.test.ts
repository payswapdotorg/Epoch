// RUNTIME DEPENDENCY POLICY: the service's runtime dependencies are
// EXACTLY the composed authority set + the W046/W051 seams + zod + the
// pg 8.23.0 driver (materialized at its single documented binding point
// by the W051 foundation intake — ACR-006; this package remains the ONLY
// pg binding point, enforced by pg-boundary.test.ts). Evidence: this
// test reads the package manifest and asserts the exact sets (the W045
// pattern).
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
  'pg',
  'zod',
];

describe('the frozen runtime dependency policy (W046 pin)', () => {
  it('runtime dependencies are EXACTLY the composed authority set + the W046 seams + zod', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual(EXPECTED_RUNTIME);
  });

  it('no third-party dependency beyond zod + pg (workspace @epoch deps + catalog pins only)', () => {
    for (const specifier of Object.keys(manifest.dependencies)) {
      expect(
        specifier.startsWith('@epoch/') || specifier === 'zod' || specifier === 'pg',
        `${specifier} is not in the frozen policy`,
      ).toBe(true);
    }
    expect(manifest.dependencies.zod).toBe('catalog:');
    expect(manifest.dependencies.pg).toBe('catalog:');
  });

  it('pg is catalog-pinned at its SINGLE binding point (W051 foundation, ACR-006); @types/pg types-only; @electric-sql/pglite remains the TEST-ONLY real engine', () => {
    // The W051 foundation intake materialized the frozen pg 8.23.0 catalog
    // pin at its documented consumer (this package). pg-boundary.test.ts
    // still enforces that NO other package may import the driver.
    expect(manifest.dependencies.pg).toBe('catalog:');
    expect(manifest.devDependencies['@types/pg']).toBe('catalog:');
    expect(manifest.devDependencies['@electric-sql/pglite']).toBe('catalog:');
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
