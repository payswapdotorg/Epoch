#!/usr/bin/env node
// W048 — sync the deterministic product fixtures into the static frontend.
//
// Copies qa/fixtures -> apps/desktop/public/fixtures and VERIFIES every
// file's sha256 against qa/fixtures/registry.json at build time, so the
// webview fixture source (web-fixture-source.ts) loads registry-verified
// bytes (it re-verifies at load time as well — defense in depth).
//
// Deterministic and idempotent: same inputs -> same output tree.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const sourceRoot = path.join(repoRoot, 'qa', 'fixtures');
const targetRoot = path.join(appRoot, 'public', 'fixtures');

if (!existsSync(path.join(sourceRoot, 'registry.json'))) {
  console.error('[sync-fixtures] qa/fixtures/registry.json not found');
  process.exit(1);
}

const registry = JSON.parse(readFileSync(path.join(sourceRoot, 'registry.json'), 'utf8'));

// Fresh target (idempotent output tree).
rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(targetRoot, { recursive: true });

let files = 0;
for (const domain of registry.domains) {
  const domainSource = path.join(sourceRoot, domain.domain);
  const domainTarget = path.join(targetRoot, domain.domain);
  mkdirSync(domainTarget, { recursive: true });
  for (const descriptor of domain.files) {
    const fileSource = path.join(domainSource, descriptor.file);
    const text = readFileSync(fileSource, 'utf8');
    const actual = createHash('sha256').update(text, 'utf8').digest('hex');
    if (actual !== descriptor.sha256) {
      console.error(`[sync-fixtures] digest mismatch for ${domain.domain}/${descriptor.file}: registry=${descriptor.sha256} actual=${actual}`);
      process.exit(1);
    }
    cpSync(fileSource, path.join(domainTarget, descriptor.file));
    files += 1;
  }
}

// The registry itself (byte-identical copy — the webview verifies against it).
cpSync(path.join(sourceRoot, 'registry.json'), path.join(targetRoot, 'registry.json'));

// A small provenance note (build metadata; not read by the product).
writeFileSync(
  path.join(targetRoot, 'synced-from.txt'),
  `synced from qa/fixtures (registry-verified sha256, ${files} files) at build time\n`,
  'utf8',
);

console.log(`[sync-fixtures] synced ${files} fixture files across ${registry.domains.length} domains (all digests verified) -> public/fixtures`);
