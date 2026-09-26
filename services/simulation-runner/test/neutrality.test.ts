// Provider-neutrality evidence (acceptance criterion: adapter neutrality —
// no vendor names outside adapter seams; the W023/W036 blocklist pattern).
// Source scan: no src file mentions a simulation vendor, grid, cloud, or
// engine product; the runner delegates ALL compute to the fabric's
// SimulationExecutionPort seam.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const VENDOR_BLOCKLIST = [
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
  'simcenter',
  'aws',
  'azure',
  'gcp',
  'google-cloud',
  'kubernetes',
  'openai',
  'anthropic',
  'gemini',
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

describe('provider neutrality (lock rule 13; the service never names a backend)', () => {
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
          expect(specifier.toLowerCase().includes(token), `${file} imports "${specifier}"`).toBe(
            false,
          );
        }
      }
    }
  });

  it('the runner holds no HTTP server and no transport vocabulary', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      // The service is a typed library surface with a driver, not an HTTP
      // server (the W021 pin).
      for (const token of ['httpserver', 'listen(', 'express', 'fastify']) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });
});
