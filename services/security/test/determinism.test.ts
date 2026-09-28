// DETERMINISM: two hosts fed the same operations hold byte-identical
// state; zero wall-clock, zero randomness.
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '../src/index';
import {
  EXTENSION_ID,
  POLICY_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  allowAuth,
  conformingSubject,
  expectError,
  listingContent,
  policyContent,
  unwrap,
} from './helpers';

describe('determinism', () => {
  it('two hosts fed the same operations hold byte-identical snapshots + health', () => {
    const feed = (runtime: SecurityRuntime): void => {
      const auth = allowAuth();
      unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
      unwrap(runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }));
      unwrap(
        runtime.admitExtension({
          tenantId: TENANT,
          authorization: auth,
          subject: conformingSubject(),
          admittedAt: T1,
        }),
      );
      unwrap(
        runtime.observeSandboxInvocation({
          tenantId: TENANT,
          authorization: auth,
          observationId: 'observation:invocation-001',
          extensionId: EXTENSION_ID,
          outcome: 'allowed',
          observedAt: T2,
          sourceDigest: 'a'.repeat(64),
        }),
      );
      expectError(
        runtime.admitExtension({
          tenantId: TENANT,
          authorization: auth,
          subject: conformingSubject({ trustClass: 't4' }),
          admittedAt: T3,
        }),
      );
      unwrap(
        runtime.releaseQuarantine({
          tenantId: TENANT,
          authorization: auth,
          quarantineId: 'quarantine:ext-release-001',
          subjectId: EXTENSION_ID,
          reason: 'remediated',
          actedAt: T4,
        }),
      );
      unwrap(
        runtime.runAuditPass({
          tenantId: TENANT,
          authorization: auth,
          auditPassId: 'observation:audit-001',
          auditedAt: T5,
        }),
      );
      unwrap(
        runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T6 }),
      );
    };
    const first = new SecurityRuntime();
    const second = new SecurityRuntime();
    feed(first);
    feed(second);
    expect(JSON.stringify(first.snapshot())).toBe(JSON.stringify(second.snapshot()));
    expect(JSON.stringify(first.health())).toBe(JSON.stringify(second.health()));
    const trailA = unwrap(
      first.readAuditTrail({ tenantId: TENANT, authorization: allowAuth() }),
    );
    const trailB = unwrap(
      second.readAuditTrail({ tenantId: TENANT, authorization: allowAuth() }),
    );
    expect(JSON.stringify(trailA)).toBe(JSON.stringify(trailB));
    const stateA = unwrap(first.projectHealth({ tenantId: TENANT, authorization: allowAuth(), projectedAt: T6 }));
    const stateB = unwrap(second.projectHealth({ tenantId: TENANT, authorization: allowAuth(), projectedAt: T6 }));
    expect(JSON.stringify(stateA.metrics)).toBe(JSON.stringify(stateB.metrics));
    expect(POLICY_ID).toMatch(/^security-policy:/);
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
