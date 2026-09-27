// W032 — CONTRACT REGISTRY COMPLETENESS: the conformance suite must
// cover EVERY manifest-bearing contract tree under contracts/. Adding a
// new published tree without registering it fails here (the drift net
// can never silently shrink).
//
// Scope (documented in README.md): contracts/world (W002, types-only)
// and contracts/constraints/v1 (W004, hand-maintained declarations) are
// type-declaration surfaces without emission manifests; their parity is
// enforced by their OWNING packages' contract-sync tests
// (packages/world-model, packages/constraint-language,
// packages/policy-contracts — outside this Work Order's frozen
// devDependency set). This test asserts exactly that classification so a
// future manifest appearing in either tree is flagged for registration.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTRACT_TREES } from './registry';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(here, '../../../contracts');

function manifestBearingTrees(): string[] {
  const trees: string[] = [];
  for (const entry of readdirSync(contractsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(contractsRoot, entry.name);
    if (existsSync(path.join(dir, 'manifest.json'))) {
      trees.push(entry.name);
    }
  }
  return trees.sort();
}

/** The declaration-surface trees (no emission manifest, owner-enforced parity). */
const DECLARATION_TREES = ['constraints', 'world'] as const;

describe('contract-registry completeness', () => {
  it('every manifest-bearing contracts/* tree is registered', () => {
    const onDisk = manifestBearingTrees();
    const registered = CONTRACT_TREES.map((entry) => entry.tree).sort();
    expect(registered).toEqual(onDisk);
  });

  it('every registered tree exists on disk', () => {
    for (const entry of CONTRACT_TREES) {
      expect(statSync(path.join(contractsRoot, entry.tree)).isDirectory(), entry.tree).toBe(true);
    }
  });

  it('the declaration-surface trees are exactly the non-manifest trees (classification pinned)', () => {
    const allTrees = readdirSync(contractsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const manifestTrees = manifestBearingTrees();
    const nonManifest = allTrees.filter((tree) => !manifestTrees.includes(tree));
    expect(nonManifest).toEqual([...DECLARATION_TREES]);
    // A declaration tree growing a manifest must be registered (fail loud).
    for (const tree of DECLARATION_TREES) {
      expect(existsSync(path.join(contractsRoot, tree, 'manifest.json')), `${tree} is a declaration surface; a manifest would require registry coverage`).toBe(false);
    }
  });

  it('every registered manifest carries the exact-revision digest anchor vocabulary', () => {
    for (const entry of CONTRACT_TREES) {
      const manifest = JSON.parse(
        readFileSync(path.join(contractsRoot, entry.tree, 'manifest.json'), 'utf8'),
      ) as { contract?: string; schemas?: unknown[] };
      expect(manifest.contract, `${entry.tree}: contract id`).toBe(entry.contractId);
      expect(Array.isArray(manifest.schemas), `${entry.tree}: schemas inventory`).toBe(true);
    }
  });
});
