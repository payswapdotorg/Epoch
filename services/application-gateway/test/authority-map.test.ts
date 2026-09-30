// THE AUTHORITY-MAP WALK TEST (W046 acceptance 3): walks the complete
// gateway surface and FAILS on any unmapped operation. Also pins the
// docs table (docs/product-runtime/authority-map.md) and the frozen
// client-runtime vocabulary to the same surface — three-way no drift.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APPLICATION_GATEWAY_OPERATION_NAMES, QUEUEABLE_OPERATIONS } from '@epoch/client-runtime';
import { AUTHORITY_MAP, AUTHORITY_BY_OPERATION, isAuthorityMapped } from '../src/authority-map';
import { ApplicationGateway } from '../src/gateway';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');

describe('the authority map walk test (W046 acceptance 3)', () => {
  it('every operation in the frozen gateway vocabulary has a COMPLETE authority mapping (unmapped operations are forbidden)', () => {
    const unmapped = APPLICATION_GATEWAY_OPERATION_NAMES.filter((name) => !isAuthorityMapped(name));
    expect(unmapped, `operations without a complete authority mapping: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('the authority map declares EXACTLY the gateway surface (no extra, no missing)', () => {
    const mapped = AUTHORITY_MAP.map((mapping) => mapping.operation).sort();
    const surface = [...APPLICATION_GATEWAY_OPERATION_NAMES].sort();
    expect(mapped).toEqual(surface);
  });

  it('every mapped authority is an EXISTING workspace package in the repository', () => {
    for (const mapping of AUTHORITY_MAP) {
      const packageDir = mapping.authority.replace('@epoch/', '');
      const manifest = path.join(REPO_ROOT, 'packages', packageDir, 'package.json');
      const serviceManifest = path.join(REPO_ROOT, 'services', packageDir, 'package.json');
      const exists = existsSync(manifest) || existsSync(serviceManifest);
      expect(exists, `authority ${mapping.authority} is not an existing workspace package`).toBe(true);
      // The declared layer matches the actual package layer.
      const manifestPath = existsSync(manifest) ? manifest : serviceManifest;
      const layer = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { epoch?: { layer?: string } }).epoch?.layer;
      expect(layer, `authority ${mapping.authority} layer`).toBe(mapping.authorityLayer);
    }
  });

  it('every authority mapping names concrete delegation entry points', () => {
    for (const mapping of AUTHORITY_MAP) {
      expect(mapping.delegatesTo.length, mapping.operation).toBeGreaterThan(0);
      expect(mapping.owns.length, mapping.operation).toBeGreaterThan(10);
    }
  });

  it('the ACTION operations map to the Action Gateway (execution authority — lock rule 3)', () => {
    for (const operation of ['action.submit', 'action.approve', 'action.execute', 'action.status']) {
      expect(AUTHORITY_BY_OPERATION[operation]?.authority).toBe('@epoch/action-gateway');
    }
  });

  it('events are READ-ONLY through the gateway (no client-side event append operation exists)', () => {
    const appends = APPLICATION_GATEWAY_OPERATION_NAMES.filter((name) => name.startsWith('events.') && name !== 'events.read');
    expect(appends).toEqual([]);
    expect(AUTHORITY_BY_OPERATION['events.read']?.authority).toBe('@epoch/event-log');
  });

  it('the queueable (offline) operations all route through action-path authorities', () => {
    for (const name of QUEUEABLE_OPERATIONS) {
      const authority = AUTHORITY_BY_OPERATION[name]?.authority;
      expect(['@epoch/action-gateway', '@epoch/execution-tracking', '@epoch/evidence'].includes(authority ?? ''), `${name} -> ${authority}`).toBe(true);
    }
  });

  it('the docs table (docs/product-runtime/authority-map.md) covers EXACTLY the same surface', () => {
    const docs = readFileSync(path.join(REPO_ROOT, 'docs', 'product-runtime', 'authority-map.md'), 'utf8');
    for (const name of APPLICATION_GATEWAY_OPERATION_NAMES) {
      expect(docs.includes(`\`${name}\``), `docs authority-map.md is missing operation ${name}`).toBe(true);
    }
    // The doc's operation rows equal the surface (count the table rows).
    const docRows = docs.split('\n').filter((line) => /^\| `[a-z]/.test(line)).length;
    expect(docRows).toBe(APPLICATION_GATEWAY_OPERATION_NAMES.length);
  });

  it('the gateway implements every operation (the handler registry is complete)', async () => {
    // Constructing the gateway requires an authority bundle; the handler
    // completeness is enforced by dispatching a call per operation and
    // asserting NONE returns operation-unknown. Reads/mutations get
    // minimal envelopes; every operation must fail for a REAL reason
    // (session/auth/payload/authority), never operation-unknown.
    const { buildGateway, issueSession, envelope } = await import('./helpers');
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    for (const operation of APPLICATION_GATEWAY_OPERATION_NAMES) {
      if (operation === 'session.issue') continue; // bootstrap: covered by the session suite
      const result = await gateway.call(envelope(operation, sessionId, { some: 'payload' }));
      if (!result.ok) {
        expect(result.error.code, `${operation} must not be operation-unknown`).not.toBe('operation-unknown');
      } else {
        // A read that succeeded with an arbitrary payload is fine
        // (projection ops ignore payload shape).
        expect(result.ok).toBe(true);
      }
    }
  });

  it('the ApplicationGateway class exists as the composition facade (it orchestrates; it decides nothing semantic)', () => {
    expect(typeof ApplicationGateway).toBe('function');
  });
});
