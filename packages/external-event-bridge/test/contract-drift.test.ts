// Contract drift: BOTH committed artifact sets must be byte-identical to
// what the implementation emits:
// - the in-package full surface under packages/external-event-bridge/schemas
//   (the W006/W007/W009/W023/W036/W041 in-package convention);
// - the public core-record surface under contracts/external-event-bridge
//   (the W012 convention).
// Regeneration is only possible through the documented update mode, so
// artifacts can never drift silently from the schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderExternalEventBridgeContractFiles,
  renderExternalEventBridgePublicContractFiles,
  EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_CONTRACTS_DIR = path.resolve(here, '..', 'schemas');
const PUBLIC_CONTRACTS_DIR = path.resolve(
  here,
  '..',
  '..',
  '..',
  'contracts',
  'external-event-bridge',
);
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

function checkArtifactSet(
  rendered: Readonly<Record<string, string>>,
  contractsDir: string,
  label: string,
): void {
  describe(`${label} drift`, () => {
    it('renders a manifest plus one schema file per surface type', () => {
      const paths = Object.keys(rendered).sort();
      expect(paths).toContain('manifest.json');
      expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(paths.length - 1);
    });

    it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
      const target = path.join(contractsDir, rel);
      if (UPDATE_MODE) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, rendered[rel]!);
        return;
      }
      expect(existsSync(target), `missing committed artifact: ${label}/${rel}`).toBe(true);
      expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
    });

    it('emission is deterministic (two renders are byte-identical)', () => {
      expect(renderExternalEventBridgeContractFiles()).toEqual(
        renderExternalEventBridgeContractFiles(),
      );
    });

    it('every emitted schema declares a versioned $id and draft 2020-12', () => {
      for (const [rel, content] of Object.entries(rendered)) {
        if (rel === 'manifest.json' || path.basename(rel) === 'manifest.json') continue;
        const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
        expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(parsed.$id, rel).toMatch(/^urn:epoch:external-event-bridge:[a-z0-9-]+:1\.0\.0$/);
      }
    });
  });
}

checkArtifactSet(
  renderExternalEventBridgeContractFiles(),
  PACKAGE_CONTRACTS_DIR,
  'packages/external-event-bridge/schemas',
);
checkArtifactSet(
  renderExternalEventBridgePublicContractFiles(),
  PUBLIC_CONTRACTS_DIR,
  'contracts/external-event-bridge',
);

describe('surface registries', () => {
  it('the in-package surface covers every published data type', () => {
    expect(EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE.length).toBeGreaterThanOrEqual(33);
  });

  it('the core-record surface is a subset of the in-package surface', () => {
    const packageTypes = new Set(EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE.map((entry) => entry.type));
    for (const entry of CORE_RECORD_SURFACE) {
      expect(packageTypes.has(entry.type), entry.type).toBe(true);
    }
  });

  it('the core-record surface carries the sealed record families + events + fallback records', () => {
    const coreTypes = new Set(CORE_RECORD_SURFACE.map((entry) => entry.type));
    for (const required of [
      'SealedExternalEvent',
      'SealedObservationIntakeProposal',
      'SealedOutboundRequest',
      'SealedProviderRegistration',
      'SealedDeliveryReceipt',
      'SealedIntakeReceipt',
      'SealedProviderUnavailable',
      'SealedManualQueueRecord',
      'SealedBridgeEvent',
      'LeastPrivilegeProjection',
      'FilteredOutboundPayload',
      'RetryPolicy',
      'ProviderFallbackDirective',
    ]) {
      expect(coreTypes.has(required), required).toBe(true);
    }
  });
});
