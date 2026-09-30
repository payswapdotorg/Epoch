// The bundled-fixture pinning: the native/fixtures/ copies (what the app
// bundles through the toolchain's JSON imports) must be BYTE-IDENTICAL to
// the committed qa/fixtures/construction records, pinned against the
// registry digests (qa/fixtures/registry.json) — drift between the bundle
// and the authoritative fixtures is a test failure, never a silent
// divergence. Also pins the bundled world digest to the registry anchor
// (the J08 cross-device comparison value).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BUNDLED_RECORDS } from '../../native/bootstrap';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..', '..');
const PACKAGE_ROOT = path.resolve(here, '..', '..');

interface RegistryDomain {
  domain: string;
  fixtureId: string;
  worldDigest: string;
  programContentDigest: string;
  deliveryContentDigest: string;
  files: { file: string; sha256: string }[];
}

const registry = JSON.parse(readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'registry.json'), 'utf8')) as {
  domains: RegistryDomain[];
};
const construction = registry.domains.find((domain) => domain.domain === 'construction')!;

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('the bundled fixture records (byte-identical to the committed fixtures)', () => {
  it('every bundled file matches the committed qa/fixtures/construction record (registry digest pinned)', () => {
    for (const entry of construction.files) {
      if (!['tenancy', 'identity', 'world', 'solution', 'program-of-work', 'delivery', 'evidence'].includes(entry.file.replace('.json', ''))) {
        continue; // scenario scripts stay at qa/fixtures (harness-side, not bundled)
      }
      const committed = readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'construction', entry.file));
      const bundled = readFileSync(path.join(PACKAGE_ROOT, 'native', 'fixtures', entry.file));
      expect(sha256(bundled), `native/fixtures/${entry.file} must match the committed fixture byte-for-byte`).toBe(sha256(committed));
      expect(sha256(bundled), `native/fixtures/${entry.file} must match the registry digest`).toBe(entry.sha256);
    }
  });

  it('the bundled records match the committed records as parsed values (tenancy/world/program/delivery/identity/evidence/solution)', () => {
    for (const file of ['tenancy', 'identity', 'world', 'solution', 'program-of-work', 'delivery', 'evidence']) {
      const committed = JSON.parse(readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'construction', `${file}.json`), 'utf8'));
      const bundled = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'native', 'fixtures', `${file}.json`), 'utf8'));
      expect(bundled).toEqual(committed);
    }
  });

  it('BUNDLED_RECORDS carries the committed fixture identity (id, tenant, delivery, solution, program digest)', () => {
    expect(BUNDLED_RECORDS.fixtureId).toBe(construction.fixtureId);
    expect(BUNDLED_RECORDS.tenantId).toBe('tenant:nordstrand');
    expect(BUNDLED_RECORDS.delivery['deliveryId']).toBe('delivery:warehouse-b-001');
    expect(BUNDLED_RECORDS.solution['solutionId']).toBe('solution:warehouse-extension-steel');
    expect(BUNDLED_RECORDS.program['contentDigest']).toBe(construction.programContentDigest);
  });

  it('the bundled world digest equals the registry worldDigest (the J08 cross-device anchor)', () => {
    expect(BUNDLED_RECORDS.world['digest']).toBe(construction.worldDigest);
  });

  it('the fixture principals include the field persona and the approver (the journey actors)', () => {
    const principals = (BUNDLED_RECORDS.identity['principals'] as Array<{ principal: { principalId: string; displayName: string } }>).map(
      (entry) => entry.principal.principalId,
    );
    expect(principals).toContain('principal:delivery-lead');
    expect(principals).toContain('principal:chief-engineer');
    expect(principals).toContain('principal:field-engineer');
  });
});
