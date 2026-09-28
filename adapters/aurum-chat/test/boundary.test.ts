// THE KERNEL-IMPORT BOUNDARY TEST (`kernel-import-rejected`, the W042
// dispatch pin): the adapter is ISOLATED from Epoch kernel contracts —
// its source imports ONLY the bridge's provider contract
// (@epoch/external-event-bridge), the adapter SDK (@epoch/adapter-sdk)
// and the shared protocol/tenancy primitives (@epoch/agent-protocol,
// @epoch/tenancy), plus zod and relative/node modules. ANY other
// @epoch/* import in the adapter source is a kernel-import violation
// and fails this test.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The frozen allow-list (the adapter's declared runtime surface). */
const ALLOWED_EPOCH_IMPORTS = new Set([
  '@epoch/external-event-bridge',
  '@epoch/adapter-sdk',
  '@epoch/agent-protocol',
  '@epoch/tenancy',
]);

/** The parity module is type-only and deliberately NOT part of the runtime surface. */
const PARITY_FILE = join(__dirname, '..', 'src', 'parity.ts');

function sourceFiles(): string[] {
  const srcDir = join(__dirname, '..', 'src');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.ts')) {
        files.push(full);
      }
    }
  };
  walk(srcDir);
  return files.sort();
}

function epochImportsOf(content: string): string[] {
  const hits = new Set<string>();
  const patterns = [
    /\bfrom\s*(['"])(@epoch\/[^'"\n]+)\1/g,
    /\bimport\s*(['"])(@epoch\/[^'"\n]+)\1/g,
    /\brequire\s*\(\s*(['"])(@epoch\/[^'"\n]+)\1\s*\)/g,
    /\bimport\s*\(\s*(['"])(@epoch\/[^'"\n]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      hits.add(match[2]!.split('/')[0] === '@epoch'
        ? match[2]!.split('/').slice(0, 2).join('/')
        : match[2]!);
    }
  }
  return [...hits].sort();
}

describe('kernel-import-rejected (the adapter boundary)', () => {
  it('the adapter source imports ONLY the bridge provider contract + the SDK + protocol/tenancy primitives', () => {
    const violations: string[] = [];
    for (const file of sourceFiles()) {
      if (file === PARITY_FILE) continue; // type-only pin module (devDep names, never runtime)
      const content = readFileSync(file, 'utf8');
      for (const imported of epochImportsOf(content)) {
        if (!ALLOWED_EPOCH_IMPORTS.has(imported)) {
          violations.push(`${file}: "${imported}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the package manifest declares exactly the frozen runtime dependency set', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@epoch/adapter-sdk',
      '@epoch/agent-protocol',
      '@epoch/external-event-bridge',
      '@epoch/tenancy',
      'zod',
    ]);
  });

  it('the quarantined provider layer itself stays free of kernel imports', () => {
    const violations: string[] = [];
    for (const file of sourceFiles()) {
      if (!file.startsWith(join(__dirname, '..', 'src', 'provider'))) continue;
      const content = readFileSync(file, 'utf8');
      for (const imported of epochImportsOf(content)) {
        violations.push(`${file}: "${imported}"`);
      }
    }
    expect(violations).toEqual([]);
  });
});
