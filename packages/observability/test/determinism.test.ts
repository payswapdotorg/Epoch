// DETERMINISM: two stores fed the same operations (in any order where
// the model allows) hold byte-identical state; zero wall-clock, zero
// randomness (every instant is a fixture constant).
import { describe, expect, it } from 'vitest';
import { ObservabilityStore } from '../src/index';
import {
  EXTENSION_ID,
  PRINCIPAL,
  QUARANTINE_ID,
  TENANT,
  sealedAdmissionObservation,
  sealedPolicy,
  sealedViolationObservation,
  unwrap,
} from './fixtures';

describe('determinism', () => {
  it('two stores fed the same operations hold byte-identical snapshots', () => {
    const feed = (store: ObservabilityStore): void => {
      unwrap(store.admitPolicy(sealedPolicy()));
      unwrap(store.admitObservation(sealedAdmissionObservation()));
      unwrap(store.admitObservation(sealedViolationObservation('observation:viol-001')));
      unwrap(
        store.imposeQuarantine({
          schema: 'epoch.observability.quarantine',
          schemaVersion: 1,
          quarantineId: QUARANTINE_ID,
          tenantId: TENANT,
          factKind: 'quarantine-imposed',
          subjectId: EXTENSION_ID,
          reason: 'grant exceeded the trust-class ceiling',
          actedAt: '2026-03-02T09:00:04.000Z',
          actedBy: PRINCIPAL,
        }),
      );
      unwrap(store.appendEvent({
        schemaVersion: 1,
        streamId: 'stream:security-terrain-viewer',
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: null,
        payload: {
          discriminator: 'security:observation-recorded',
          data: {
            observationId: 'observation:ext-admission-001',
            observationDigest: 'a'.repeat(64),
            observationClass: 'sandbox-admission',
            subjectId: EXTENSION_ID,
            outcome: 'allowed',
            observedAt: '2026-03-02T09:00:01.000Z',
          },
        },
        occurredAt: '2026-03-02T09:00:01.000Z',
      }));
    };
    const first = new ObservabilityStore();
    const second = new ObservabilityStore();
    feed(first);
    feed(second);
    expect(JSON.stringify(unwrap(first.snapshot(TENANT)))).toBe(
      JSON.stringify(unwrap(second.snapshot(TENANT))),
    );
    expect(JSON.stringify(unwrap(first.projectState({ tenantId: TENANT })))).toBe(
      JSON.stringify(unwrap(second.projectState({ tenantId: TENANT }))),
    );
  });

  it('the state projection is stable across repeated calls', () => {
    const store = new ObservabilityStore();
    unwrap(store.admitObservation(sealedAdmissionObservation()));
    const first = JSON.stringify(unwrap(store.projectState({ tenantId: TENANT })));
    const second = JSON.stringify(unwrap(store.projectState({ tenantId: TENANT })));
    expect(first).toBe(second);
  });

  it('no Date.now / Math.random usage in src (zero wall-clock, zero randomness)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const here = path.dirname(new URL(import.meta.url).pathname);
    const srcDir = path.resolve(here, '..', 'src');
    const forbidden = [/Date\.now/, /Math\.random/, /performance\.now/, /new Date\(\)/];
    const violations: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const child = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(child, 'utf8');
          for (const pattern of forbidden) {
            if (pattern.test(content)) violations.push(`${path.relative(srcDir, child)}: ${pattern}`);
          }
        }
      }
    };
    walk(srcDir);
    expect(violations).toEqual([]);
  });
});
