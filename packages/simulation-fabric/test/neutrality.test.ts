// Provider-neutrality evidence (acceptance criterion: adapter neutrality —
// no vendor names outside adapter seams; the W023/W036 blocklist
// pattern). Source scan: no src file mentions a simulation vendor,
// grid, cloud, or engine product. Artifact scan: no vendor tokens in the
// emitted contract surfaces; no schema property key names a provider,
// gateway, credential, or API surface. The execution-port seam names NO
// vendor anywhere in the core (external backends are adapters).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSimulationFabricContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');
const TEST_FIXTURES_DIR = path.resolve(here);

const VENDOR_BLOCKLIST = [
  // Simulation solver/engine vendors and products:
  'ansys',
  'comsol',
  'matlab',
  'simulink',
  'openfoam',
  'abaqus',
  'dassault',
  'solidworks',
  'catia',
  'altair',
  'hyperworks',
  'ls-dyna',
  'star-ccm',
  'autodesk',
  'bentley',
  'nastran',
  'cfd-ace',
  'simcenter',
  // Compute-grid / cloud vendors:
  'aws',
  'azure',
  'gcp',
  'google-cloud',
  'kubernetes',
  // AI/model vendors (the W036 blocklist):
  'openai',
  'anthropic',
  'gemini',
  // The architecture.md Aurum rule:
  'aurum',
  'aurumchat',
  'aurum-chat',
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('provider neutrality (lock rule 13; adapter-seam neutrality)', () => {
  it('no src file mentions a simulation vendor, grid, cloud, or engine product', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no src file imports a vendor module', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of imports) {
        for (const token of VENDOR_BLOCKLIST) {
          expect(
            specifier.toLowerCase().includes(token),
            `${file} imports "${specifier}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('no emitted artifact mentions a vendor (source scan + artifact scan)', () => {
    const rendered = Object.entries(renderSimulationFabricContractFiles());
    expect(rendered.length).toBeGreaterThan(0);
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const rendered = Object.values(renderSimulationFabricContractFiles());
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|solver|engine|cluster|region|instance)$/i;
    for (const content of rendered) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if (
            'properties' in record &&
            record.properties !== null &&
            typeof record.properties === 'object'
          ) {
            for (const key of Object.keys(record.properties as Record<string, unknown>)) {
              expect(forbiddenKeys.test(key), `declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('the core never names an execution backend (the seam is the only compute boundary)', () => {
    // The port module documents the seam; the words it uses stay generic.
    const portSource = readFileSync(path.join(SRC_DIR, 'port.ts'), 'utf8').toLowerCase();
    expect(portSource.includes('simulationexecutionport')).toBe(true);
    for (const token of VENDOR_BLOCKLIST) {
      expect(portSource.includes(token)).toBe(false);
    }
  });

  it('fixtures stay provider-neutral too (no accidental vendor tokens)', () => {
    const fixtures = listFiles(TEST_FIXTURES_DIR).filter((file) =>
      file.endsWith('fixtures.ts'),
    );
    for (const file of fixtures) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });
});
