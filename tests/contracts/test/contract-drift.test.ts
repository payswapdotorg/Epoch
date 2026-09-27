// W032 — the GENERATED-PER-SURFACE CONTRACT CONFORMANCE RUNNER.
//
// For every published manifest-bearing contract tree under contracts/
// (the registry), this battery asserts:
//
//   1. BYTE-IDENTITY DRIFT (contract-drift, named per tree): the
//      committed artifact set equals the owning package's
//      render*ContractFiles() emission — file-for-file, byte-for-byte,
//      with no extra and no missing artifacts. Any pack/kernel/contract
//      schema change without re-emission fails here.
//   2. MANIFEST INTEGRITY: every manifest.schemas[] entry's SHA-256
//      matches the actual committed file bytes (the exact-revision
//      evidence anchor), and the manifest's dataTypes inventory equals
//      the owning package's published surface type list.
//   3. VERSION PINNING: manifest.contractVersion === the package's
//      exported contract-version constant; manifest.protocolVersion (when
//      the tree pins one) === the package's exported protocol-version
//      constant.
//   4. ZOD ROUND-TRIP PARITY: for every surface type, the live zod
//      schema's z.toJSONSchema() projection EQUALS the committed JSON
//      Schema document (the committed schemas ARE the packages' zod
//      round-trips), and each committed document round-trips through
//      JSON parse/stringify byte-stably (the emitter's exact format).
//   5. EMISSION DETERMINISM: two renders are byte-identical.
//
// Scope note (see README.md): contracts/world (W002) and
// contracts/constraints/v1 (W004) are type-declaration surfaces whose
// parity is enforced by their OWNING packages' contract-sync tests; they
// carry no emission manifest and are covered by
// contract-registry.test.ts's completeness check instead.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sha256Hex } from '@epoch/agent-protocol';
import { CONTRACTS_ROOT, CONTRACT_TREES, type ContractTreeEntry } from './registry';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(here, CONTRACTS_ROOT);

interface CommittedManifest {
  contract?: string;
  contractVersion?: string;
  protocolVersion?: string;
  dataTypes?: string[];
  schemas?: { type?: string; file?: string; sha256?: string }[];
}

/** The committed file set of a tree (relative path -> bytes), or null when absent. */
function committedFilesOf(tree: string): Readonly<Record<string, string>> | null {
  const dir = path.join(contractsRoot, tree);
  if (!existsSync(dir)) return null;
  const files: Record<string, string> = {};
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.isFile()) {
        files[`${prefix}${entry.name}`] = readFileSync(path.join(current, entry.name), 'utf8');
      }
    }
  };
  walk(dir, '');
  return files;
}

// The generated-per-surface battery: one describe block per registry entry.
for (const entry of CONTRACT_TREES) {
  describe(`contract-drift — contracts/${entry.tree} (${entry.owner})`, () => {
    const rendered = entry.render();
    const committed = committedFilesOf(entry.tree);
    const renderedPaths = Object.keys(rendered).sort();
    // The emission covers manifest.json + schemas/**; the trees also carry
    // hand-maintained declaration artifacts (README.md, index.d.ts,
    // parity.ts) that are NOT part of the emission.
    const isEmittedPath = (rel: string): boolean => rel === 'manifest.json' || rel.startsWith('schemas/');
    const committedEmissionPaths =
      committed === null ? [] : Object.keys(committed).filter(isEmittedPath).sort();

    it('renders a manifest plus one schema file per surface type', () => {
      expect(renderedPaths).toContain('manifest.json');
      const schemaFiles = renderedPaths.filter((rel) => rel.endsWith('.schema.json'));
      expect(schemaFiles.length).toBe(renderedPaths.length - 1);
      expect(schemaFiles.length).toBe(entry.surface.length);
    });

    it('the committed tree exists with exactly the emitted artifact set (no extras, none missing)', () => {
      expect(committed, `contracts/${entry.tree} must exist`).not.toBeNull();
      expect(committedEmissionPaths).toEqual(renderedPaths);
    });

    it.each(renderedPaths)('committed artifact %s matches the emission byte-for-byte', (rel) => {
      expect(committed?.[rel], `contracts/${entry.tree}/${rel}`).toBe(rendered[rel]);
    });

    it('emission is deterministic (two renders are byte-identical)', () => {
      expect(entry.render()).toEqual(rendered);
    });

    it('the manifest exists, parses and pins the tree identity', () => {
      const manifest = JSON.parse(rendered['manifest.json'] ?? '{}') as CommittedManifest;
      expect(manifest.contract).toBe(entry.contractId);
      expect(typeof manifest.contractVersion).toBe('string');
      expect(Array.isArray(manifest.dataTypes)).toBe(true);
    });

    it('VERSION PINNING: the manifest pins the owning package\'s contract + protocol versions exactly', () => {
      const manifest = JSON.parse(rendered['manifest.json'] ?? '{}') as CommittedManifest;
      expect(manifest.contractVersion, `${entry.tree}: contractVersion pin`).toBe(entry.contractVersion);
      if (entry.protocolVersion === null) {
        expect(manifest.protocolVersion ?? null).toBeNull();
      } else {
        expect(manifest.protocolVersion, `${entry.tree}: protocolVersion pin`).toBe(entry.protocolVersion);
      }
    });

    it('MANIFEST INTEGRITY: the dataTypes inventory equals the published surface type list', () => {
      const manifest = JSON.parse(rendered['manifest.json'] ?? '{}') as CommittedManifest;
      const surfaceTypes = entry.surface.map((item) => item.type);
      expect(manifest.dataTypes).toEqual(surfaceTypes);
    });

    it('MANIFEST INTEGRITY: every manifest sha256 matches the committed file bytes (exact-revision anchor)', () => {
      const manifest = JSON.parse(rendered['manifest.json'] ?? '{}') as CommittedManifest;
      const schemaEntries = manifest.schemas ?? [];
      expect(schemaEntries.length).toBe(entry.surface.length);
      for (const schemaEntry of schemaEntries) {
        const rel = schemaEntry.file ?? '';
        const bytes = committed?.[rel];
        expect(bytes, `contracts/${entry.tree}/${rel} must be committed`).toBeDefined();
        expect(schemaEntry.sha256, `${entry.tree}/${rel}: manifest sha256`).toBe(
          sha256Hex(bytes ?? ''),
        );
      }
    });

    it('ZOD ROUND-TRIP PARITY: the live zod surface projects to the committed JSON Schema documents', () => {
      const surfaceWithSchemas = entry.surface as readonly { type: string; schema: z.ZodType }[];
      for (const item of surfaceWithSchemas) {
        const kebab = item.type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const rel = `schemas/${kebab}.schema.json`;
        const committedDoc = committed?.[rel];
        expect(committedDoc, `contracts/${entry.tree}/${rel}`).toBeDefined();
        if (committedDoc === undefined) continue;
        const parsed = JSON.parse(committedDoc) as Record<string, unknown>;
        const projected = z.toJSONSchema(item.schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
        // The committed document is the zod projection plus (for the
        // $id-convention trees) the renderer-injected versioned $id.
        const withoutId: Record<string, unknown> = { ...parsed };
        delete withoutId.$id;
        expect(withoutId).toEqual(projected);
      }
    });

    it('ZOD ROUND-TRIP PARITY: every committed schema document round-trips byte-stably through JSON', () => {
      for (const rel of renderedPaths) {
        if (!rel.endsWith('.schema.json')) continue;
        const bytes = rendered[rel] ?? '';
        const parsed = JSON.parse(bytes) as unknown;
        expect(`${JSON.stringify(parsed, null, 2)}\n`, `${entry.tree}/${rel}: canonical document form`).toBe(bytes);
      }
    });

    it('every emitted schema declares draft 2020-12 with the tree\'s pinned $id convention', () => {
      for (const rel of renderedPaths) {
        if (!rel.endsWith('.schema.json')) continue;
        const parsed = JSON.parse(rendered[rel] ?? '{}') as { $schema?: string; $id?: string };
        expect(parsed.$schema, `${entry.tree}/${rel}: draft`).toBe('https://json-schema.org/draft/2020-12/schema');
        if (entry.schemaIdPrefix === null) {
          expect(parsed.$id ?? null, `${entry.tree}/${rel}: no $id by convention`).toBeNull();
        } else {
          const kebab = path.basename(rel, '.schema.json');
          expect(parsed.$id, `${entry.tree}/${rel}: versioned $id`).toBe(
            `${entry.schemaIdPrefix}:${kebab}:${entry.contractVersion}`,
          );
        }
      }
    });
  });
}

// The battery is generated from the registry — guard against an empty net.
describe('contract-drift — registry sanity', () => {
  it('the registry covers at least the nine published manifest-bearing trees', () => {
    expect(CONTRACT_TREES.length).toBeGreaterThanOrEqual(9);
    const trees = CONTRACT_TREES.map((entry: ContractTreeEntry) => entry.tree).sort();
    expect(trees).toEqual([
      'actions',
      'actualization',
      'agent',
      'execution',
      'experience',
      'experience-compiler',
      'procurement',
      'renderers',
      'solution-delivery',
    ]);
  });
});
