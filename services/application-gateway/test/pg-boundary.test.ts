// THE PG IMPORT BOUNDARY TEST (W046 acceptance 5): the pg driver binding
// is SERVICE-LAYER ONLY. No packages/*, apps/*, adapters/* or packs/*
// source may import 'pg' or '@electric-sql/pglite'; the binding seam
// exists ONLY in services/application-gateway. Also verifies the
// structural bindings (bindPgPool with a stub pool; bindPgliteEngine).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bindPgPool, bindPgliteEngine, PG_DRIVER_MODULE, PGLITE_MODULE } from '../src/postgres-binding';
import { persistenceConformanceCases } from '@epoch/persistence';
import { PostgresPersistence } from '@epoch/persistence';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.turbo', '.next', 'dist', 'build', 'coverage', '.cache', '.pnpm-store']);

/** Walk source files under a tree (bounded to code files). */
function walkSources(dir: string, visit: (file: string) => void): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSources(child, visit);
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) visit(child);
  }
}

/** The import patterns that bind the driver. */
const DRIVER_PATTERNS: Array<{ readonly pattern: RegExp; readonly module: string }> = [
  { pattern: /\bfrom\s*['"]pg['"]/g, module: 'pg' },
  { pattern: /\bimport\s*\(\s*['"]pg['"]\s*\)/g, module: 'pg (dynamic)' },
  { pattern: /\brequire\s*\(\s*['"]pg['"]\s*\)/g, module: 'pg (require)' },
  { pattern: /\bfrom\s*['"]@electric-sql\/pglite['"]/g, module: '@electric-sql/pglite' },
  { pattern: /\bimport\s*\(\s*['"]@electric-sql\/pglite['"]\s*\)/g, module: '@electric-sql/pglite (dynamic)' },
  { pattern: /\brequire\s*\(\s*['"]@electric-sql\/pglite['"]\s*\)/g, module: '@electric-sql/pglite (require)' },
];

describe('the pg import boundary (W046 acceptance 5: service-layer only)', () => {
  it('NO file outside services/application-gateway binds the pg driver or the pglite engine', () => {
    const violations: string[] = [];
    for (const tree of ['packages', 'apps', 'adapters', 'packs', 'runtimes', 'contracts', 'examples', 'tests']) {
      walkSources(path.join(REPO_ROOT, tree), (file) => {
        const content = readFileSync(file, 'utf8');
        for (const { pattern } of DRIVER_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(content)) {
            violations.push(path.relative(REPO_ROOT, file));
            return;
          }
        }
      });
    }
    expect(violations, `driver imports outside the service layer: ${violations.join(', ')}`).toEqual([]);
  });

  it('manifest-level: no package outside services/application-gateway declares pg/pglite dependencies (the one documented deployment-importer exception)', () => {
    // ACR-006 post-credential deployment exception (2026-10-03): apps/web —
    // the DEPLOYMENT IMPORTER — declares the pg dependency because the
    // bundled server resolves the frozen service-layer dynamic import
    // (import(PG_DRIVER_MODULE), kept external per this boundary) against
    // node_modules at RUNTIME from the deployment root. It is a resolution
    // wiring declaration ONLY: no apps/web source imports pg (the source
    // scan above still enforces that), and the driver still binds ONLY at
    // the service-layer seam. Every other manifest keeps the strict rule.
    const DEPLOYMENT_IMPORTER_EXCEPTIONS = new Set(['apps/web/package.json']);
    const violations: string[] = [];
    for (const tree of ['packages', 'apps', 'adapters', 'packs', 'runtimes']) {
      walkSources(path.join(REPO_ROOT, tree), () => undefined);
    }
    const manifests = [
      ...listManifests(path.join(REPO_ROOT, 'packages')),
      ...listManifests(path.join(REPO_ROOT, 'apps')),
      ...listManifests(path.join(REPO_ROOT, 'adapters')),
      ...listManifests(path.join(REPO_ROOT, 'packs')),
      ...listManifests(path.join(REPO_ROOT, 'runtimes')),
    ];
    for (const manifest of manifests) {
      const rel = path.relative(REPO_ROOT, manifest);
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, Record<string, string>>;
      const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}), ...(parsed.optionalDependencies ?? {}) };
      for (const name of Object.keys(deps)) {
        if (name === 'pg' || name === '@electric-sql/pglite' || name === '@types/pg') {
          if (DEPLOYMENT_IMPORTER_EXCEPTIONS.has(rel) && name === 'pg') continue;
          violations.push(`${rel} declares ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the binding seam exists ONLY in services/application-gateway (the structural driver contracts)', () => {
    const bindingFile = path.join(REPO_ROOT, 'services', 'application-gateway', 'src', 'postgres-binding.ts');
    expect(existsSync(bindingFile), 'the service-layer binding seam must exist').toBe(true);
    const content = readFileSync(bindingFile, 'utf8');
    expect(content.includes('bindPgPool')).toBe(true);
    // The binding module itself contains NO static driver import (structural until the catalog materializes).
    for (const { pattern } of DRIVER_PATTERNS) {
      pattern.lastIndex = 0;
      expect(pattern.test(content), 'the binding seam must stay structural (no driver import)').toBe(false);
    }
    expect(PG_DRIVER_MODULE).toBe('pg');
    expect(PGLITE_MODULE).toBe('@electric-sql/pglite');
  });

  it('bindPgPool adapts a pg-shaped pool to the wire port (query + dedicated session with release)', async () => {
    const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
    let released = 0;
    const pool = {
      async query(text: string, values?: readonly unknown[]) {
        queries.push({ text, values });
        return { rows: [], rowCount: 0 };
      },
      async connect() {
        return {
          async query(text: string, values?: readonly unknown[]) {
            queries.push({ text, values });
            return { rows: [], rowCount: 1 };
          },
          release() {
            released += 1;
          },
        };
      },
    };
    const wire = bindPgPool(pool);
    await wire.query('SELECT 1', []);
    await wire.withSession(async (session) => {
      await session.query('BEGIN', []);
      await session.query('COMMIT', []);
    });
    expect(queries.map((entry) => entry.text)).toEqual(['SELECT 1', 'BEGIN', 'COMMIT']);
    expect(released).toBe(1);
  });

  it('bindPgliteEngine adapts an engine-shaped object to the same wire port', async () => {
    const queries: string[] = [];
    const engine = {
      async query(text: string, params?: readonly unknown[]) {
        queries.push(`${text}|${params?.length ?? 0}`);
        return { rows: [], rowCount: 1 };
      },
    };
    const wire = bindPgliteEngine(engine);
    const adapter = new PostgresPersistence(wire);
    await adapter.put('gateway_sessions', 'session:binding', { ok: true });
    expect(queries).toEqual(['INSERT INTO "gateway_sessions" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"|2']);
  });

  it('the SHARED persistence conformance suite passes through the full pg-pool binding (stub engine)', async () => {
    // A tiny in-engine stub that actually EXECUTES the record-store SQL
    // semantics (the real-engine proof runs in the pglite suite).
    const cases = persistenceConformanceCases(() => {
      const engine = new StubSqlEngine();
      return new PostgresPersistence(bindPgliteEngine(engine));
    });
    for (const testCase of cases) {
      await expect(testCase.run()).resolves.toBeUndefined();
    }
  });
});

function listManifests(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const manifest = path.join(dir, entry.name, 'package.json');
    if (existsSync(manifest) && statSync(manifest).isFile()) out.push(manifest);
  }
  return out;
}

/** A deterministic SQL-subset engine executing the adapter's emitted statements (pglite-shaped, WITH transactional semantics). */
class StubSqlEngine {
  private readonly tables = new Map<string, Map<string, string>>();
  private snapshot: Map<string, Map<string, string>> | null = null;

  async query(text: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> {
    const values = (params ?? []).map((value) => String(value));
    if (text === 'BEGIN') {
      this.snapshot = new Map([...this.tables].map(([table, rows]) => [table, new Map(rows)]));
      return { rows: [], rowCount: 0 };
    }
    if (text === 'COMMIT') {
      this.snapshot = null;
      return { rows: [], rowCount: 0 };
    }
    if (text === 'ROLLBACK') {
      if (this.snapshot !== null) {
        this.tables.clear();
        for (const [table, rows] of this.snapshot) this.tables.set(table, new Map(rows));
        this.snapshot = null;
      }
      return { rows: [], rowCount: 0 };
    }
    const createMatch = /^CREATE TABLE IF NOT EXISTS "([^"]+)" /.exec(text);
    if (createMatch !== null) {
      this.tableOf(createMatch[1]!);
      return { rows: [], rowCount: 0 };
    }
    const insertMatch = /^INSERT INTO "([^"]+)" \("key", "value"\) VALUES \(\$1, \$2\) ON CONFLICT \("key"\) DO NOTHING$/.exec(text);
    if (insertMatch !== null) {
      const rows = this.tableOf(insertMatch[1]!);
      if (rows.has(values[0]!)) return { rows: [], rowCount: 0 };
      rows.set(values[0]!, values[1]!);
      return { rows: [], rowCount: 1 };
    }
    const putMatch = /^INSERT INTO "([^"]+)" \("key", "value"\) VALUES \(\$1, \$2\) ON CONFLICT \("key"\) DO UPDATE SET "value" = EXCLUDED\."value"$/.exec(text);
    if (putMatch !== null) {
      this.tableOf(putMatch[1]!).set(values[0]!, values[1]!);
      return { rows: [], rowCount: 1 };
    }
    const getMatch = /^SELECT "value" FROM "([^"]+)" WHERE "key" = \$1$/.exec(text);
    if (getMatch !== null) {
      const raw = this.tableOf(getMatch[1]!).get(values[0]!);
      return raw === undefined ? { rows: [], rowCount: 0 } : { rows: [{ value: JSON.parse(raw) }], rowCount: 1 };
    }
    const deleteMatch = /^DELETE FROM "([^"]+)" WHERE "key" = \$1$/.exec(text);
    if (deleteMatch !== null) {
      const existed = this.tableOf(deleteMatch[1]!).delete(values[0]!);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }
    const listMatch = /^SELECT "key", "value" FROM "([^"]+)" ORDER BY "key" ASC$/.exec(text);
    if (listMatch !== null) {
      const rows = [...this.tableOf(listMatch[1]!).entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([key, raw]) => ({ key, value: JSON.parse(raw) }));
      return { rows, rowCount: rows.length };
    }
    const dropMatch = /^DROP TABLE IF EXISTS "([^"]+)"$/.exec(text);
    if (dropMatch !== null) {
      this.tables.delete(dropMatch[1]!);
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`stub engine: unsupported statement: ${text}`);
  }

  private tableOf(table: string): Map<string, string> {
    let rows = this.tables.get(table);
    if (rows === undefined) {
      rows = new Map<string, string>();
      this.tables.set(table, rows);
    }
    return rows;
  }
}
