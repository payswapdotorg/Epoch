// Provider-neutrality evidence: no vendor-, engine-, renderer-, or
// framework-specific vocabulary may leak into the published contract
// surface at contracts/renderers — neither into the emitted JSON Schemas,
// the manifest, nor the TypeScript declarations. Concrete engines are
// future adapters behind the descriptor contract (lock rule 13). The src
// tree is additionally asserted free of wall-clock and randomness.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderRendererContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'renderers');

/**
 * Vendor/engine/framework blocklist — none of these tokens may appear
 * anywhere in the published contract artifacts. The neutral words
 * "provider" and "device" are allowed (they name roles, not products).
 */
const BLOCKLIST = [
  // Graphics engines / renderers (architecture.md foundation examples).
  'threejs',
  'three.js',
  'babylon',
  'babylonjs',
  'unity',
  'unreal',
  'godot',
  'o3de',
  'cesium',
  'blender',
  'freecad',
  'brlcad',
  'openscad',
  'salome',
  'paraview',
  // Graphics APIs and shader languages.
  'webgl',
  'webgpu',
  'vulkan',
  'directx',
  'opengl',
  'metal',
  'glsl',
  'hlsl',
  'wgsl',
  // UI frameworks and clients.
  'react',
  'react-dom',
  'vue',
  'angular',
  'svelte',
  'electron',
  'tauri',
  'nextjs',
  'next.js',
  // LLM vendors (equally forbidden in the experience surface).
  'openai',
  'anthropic',
  'chatgpt',
  'gpt-',
  'claude',
  'gemini',
  'mistral',
  'llama',
];

/** Wall-clock / randomness / timer tokens forbidden in src (determinism). */
const SRC_FORBIDDEN = [
  'Date.now',
  'new Date(',
  'performance.now',
  'Math.random',
  'crypto.randomUUID',
  'setTimeout',
  'setImmediate',
  'setInterval',
  'process.hrtime',
];

describe('renderer contract provider neutrality', () => {
  it('contains no vendor/engine/framework tokens in any emitted schema or the manifest', () => {
    const rendered = renderRendererContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('contains no vendor/engine/framework tokens in the TypeScript declarations', () => {
    const source = readFileSync(path.join(CONTRACTS_DIR, 'index.d.ts'), 'utf8').toLowerCase();
    for (const token of BLOCKLIST) {
      expect(source.includes(token), `index.d.ts contains "${token}"`).toBe(false);
    }
  });

  it('no schema property key names a vendor, engine, or API surface', () => {
    const rendered = renderRendererContractFiles();
    // "renderer" is intentionally NOT on this package's forbidden list: it
    // names the abstract ROLE this whole contract is about (the renderer
    // descriptor), not a vendor product or engine; vendor/engine leakage
    // is covered by the token blocklist above.
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|engine|gpu|backend)$/i;
    for (const [rel, content] of Object.entries(rendered)) {
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
              expect(forbiddenKeys.test(key), `${rel} declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('the renderer descriptor publishes exactly the neutral typed fields', () => {
    const rendered = renderRendererContractFiles();
    const descriptor = JSON.parse(
      rendered['schemas/renderer-descriptor.schema.json']!,
    ) as {
      $defs: {
        RendererDescriptor: { required: string[]; properties: Record<string, unknown> };
      };
    };
    expect(Object.keys(descriptor.$defs.RendererDescriptor.properties).sort()).toEqual([
      'budgets',
      'descriptorVersion',
      'graphKinds',
      'interaction',
      'output',
      'rendererId',
    ]);
    expect(descriptor.$defs.RendererDescriptor.required).toContain('rendererId');
  });

  it('src contains zero wall-clock, randomness, or timer dependence', () => {
    const srcDir = path.resolve(here, '..', 'src');
    for (const file of readdirRecursive(srcDir)) {
      const source = readFileSync(file, 'utf8');
      for (const token of SRC_FORBIDDEN) {
        expect(source.includes(token), `${path.relative(srcDir, file)} contains "${token}"`).toBe(
          false,
        );
      }
    }
  });
});

function readdirRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readdirRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}
