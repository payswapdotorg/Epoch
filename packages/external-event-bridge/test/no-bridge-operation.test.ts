// THE NO-BRIDGE OPERATION TEST (the W042 acceptance, second clause):
// "Core project flows remain functional with no bridge installed."
//
// This file deliberately imports ONLY core kernel packages — it NEVER
// imports @epoch/external-event-bridge (not the runtime, not the types,
// not even the shared test fixtures, which import the bridge) — and
// runs their reference fixtures: a REAL W036 observation seals through
// the REAL delivery authority path, a REAL W010 event appends to a
// REAL stream, and a REAL W041 policy seals as data. The bridge being
// absent changes nothing about them.
//
// The second clause is structural: no core package declares a
// dependency on the bridge and no core package source imports it (the
// import direction is one-way — adapters and hosts import the bridge;
// the bridge and the core never import back), so a project runs with
// the bridge uninstalled.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// ONLY core packages — never @epoch/external-event-bridge:
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import { EventLog, sealEvent } from '@epoch/event-log';
import { sealProjectionPolicy } from '@epoch/access-projection';

const here = dirname(fileURLToPath(import.meta.url));

// Inlined fixtures (the shared fixture module imports the bridge; this
// file must not).
const TENANT = 'tenant:globex';
const FIELD_LEAD = 'principal:field-lead';
const T1 = '2026-01-05T09:05:00.000Z';

describe('core project flows run with NO bridge installed', () => {
  it('the REAL W036 observation authority path works without the bridge (seal + digest)', () => {
    const sealed = sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'observation',
      recordId: 'observation:site-a-depth',
      tenantId: TENANT,
      subject: {
        solutionId: 'solution:site-works',
        subjectKind: 'delivery',
        subjectId: 'delivery:site-a',
      },
      measure: { kind: 'quantity', value: '1250', unit: 'mm' },
      payload: {
        deliveryId: 'delivery:site-a',
        observedAt: T1,
        observedBy: FIELD_LEAD,
        evidence: [{ digest: '3a'.repeat(32) }],
      },
      recordedAt: T1,
      recordedBy: FIELD_LEAD,
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'reported' },
        freshness: { state: 'fresh', assessedAt: T1 },
        confidence: { method: 'measured', value: 0.9 },
      },
    });
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.kind).toBe('observation');
      expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('the REAL W010 event log works without the bridge (append + read back)', () => {
    const log = new EventLog({ expectedTenantId: TENANT });
    const sealed = sealEvent({
      schemaVersion: 1,
      streamId: 'stream:delivery-site-a',
      sequence: 1,
      tenantId: TENANT,
      actor: FIELD_LEAD,
      causalParent: null,
      payload: { discriminator: 'delivery:observation-recorded', data: { note: 'depth measured' } },
      occurredAt: T1,
    });
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      const appended = log.appendEvent(sealed.value);
      expect(appended.ok).toBe(true);
      const read = log.readStream('stream:delivery-site-a');
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toHaveLength(1);
    }
  });

  it('the REAL W041 projection-policy data path works without the bridge', () => {
    const sealed = sealProjectionPolicy({
      schema: 'epoch.access-projection.policy',
      schemaVersion: 1,
      policyId: 'policy:site-recipient-view',
      revision: 1,
      tenantId: TENANT,
      title: 'Site recipient minimum-necessary view',
      status: 'active',
      bindings: [
        {
          selector: { principalKind: 'human', role: 'role:site-supervisor' },
          objectClass: 'program-of-work',
          allowedActions: ['view'],
          fieldAllowlist: ['title'],
          redactionRules: [],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: {
            evidence: { mode: 'all' },
            commercial: 'hidden',
            supplier: 'hidden',
          },
        },
      ],
    });
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('structurally: NO core package declares a dependency on the bridge', () => {
    const packagesRoot = join(here, '..', '..');
    const violations: string[] = [];
    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'external-event-bridge') continue; // the bridge itself
      const manifest = join(packagesRoot, entry.name, 'package.json');
      if (!existsSync(manifest)) continue;
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };
      for (const section of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ] as const) {
        if (parsed[section]?.['@epoch/external-event-bridge'] !== undefined) {
          violations.push(`${entry.name}/${section}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('structurally: no core package source imports the bridge', () => {
    const packagesRoot = join(here, '..', '..');
    const violations: string[] = [];
    const walk = (dir: string, pkgName: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'schemas') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, pkgName);
        } else if (entry.isFile() && /\.ts$/.test(entry.name)) {
          const content = readFileSync(full, 'utf8');
          if (content.includes('@epoch/external-event-bridge')) {
            violations.push(`${pkgName}:${entry.name}`);
          }
        }
      }
    };
    for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'external-event-bridge') continue;
      const src = join(packagesRoot, entry.name, 'src');
      if (existsSync(src)) walk(src, entry.name);
    }
    expect(violations).toEqual([]);
  });
});
