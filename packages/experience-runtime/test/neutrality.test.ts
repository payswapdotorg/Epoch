// Provider-neutrality evidence: no vendor-, engine-, renderer-, or
// framework-specific vocabulary may leak into the published in-package
// contract artifacts — neither into the emitted JSON Schemas nor the
// manifest. The host model is abstract typed data (W019 adapts; concrete
// engines are future adapters behind the renderer hosting surface). The
// src tree is additionally asserted free of wall-clock and randomness.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderExperienceRuntimeContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vendor/engine/framework blocklist — none of these tokens may appear
 * anywhere in the emitted contract artifacts. The neutral words
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

describe('experience-runtime provider neutrality', () => {
  it('contains no vendor/engine/framework tokens in any emitted schema or the manifest', () => {
    const rendered = renderExperienceRuntimeContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, engine, renderer, or API surface', () => {
    const rendered = renderExperienceRuntimeContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|engine|renderer|gpu|backend)$/i;
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
