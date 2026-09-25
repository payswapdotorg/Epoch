// Provider-neutrality evidence: no vendor-, engine-, renderer-, or
// framework-specific vocabulary may leak into the published contract
// surface — neither into the emitted JSON Schemas, the manifest, nor the
// TypeScript declarations. Compiled plan bytes carry no vendor tokens
// either (the vendor-field authority boundary keeps them out at compile
// time; this battery pins the output side).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderExperienceCompilerContractFiles,
  serializeRenderPlan,
  VENDOR_KEY_SEGMENTS,
} from '../src/index';
import { compiledPlan } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'experience-compiler');

/**
 * Vendor/engine/framework blocklist — none of these tokens may appear
 * anywhere in the published contract artifacts or the compiled plan
 * bytes. The neutral words "provider" and "device" are allowed (they
 * name roles, not products).
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

describe('experience-compiler contract provider neutrality', () => {
  it('contains no vendor/engine/framework tokens in any emitted schema or the manifest', () => {
    const rendered = renderExperienceCompilerContractFiles();
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

  it('no schema property key names a vendor, engine, renderer, or API surface', () => {
    const rendered = renderExperienceCompilerContractFiles();
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

  it('the render plan envelope marks the chain and authority-relevant fields required', () => {
    const rendered = renderExperienceCompilerContractFiles();
    const plan = JSON.parse(rendered['schemas/render-plan.schema.json']!) as {
      $defs: { RenderPlan: { required: string[] } };
    };
    for (const field of [
      'schema',
      'protocolVersion',
      'sourceGraphId',
      'sourceGraphKind',
      'sourceEnvelopeDigest',
      'tenantScope',
      'sourceRefs',
      'target',
      'constraints',
      'usage',
      'stages',
      'digest',
    ]) {
      expect(plan.$defs.RenderPlan.required).toContain(field);
    }
  });

  it('the vendor blocklist is a sorted, duplicate-free closed vocabulary', () => {
    expect(VENDOR_KEY_SEGMENTS).toEqual([...VENDOR_KEY_SEGMENTS].sort());
    expect(new Set(VENDOR_KEY_SEGMENTS).size).toBe(VENDOR_KEY_SEGMENTS.length);
  });

  it('compiled plan bytes carry no vendor tokens (output-side pin)', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const serialized = serializeRenderPlan(compiledPlan(kind)).toLowerCase();
      for (const token of BLOCKLIST) {
        expect(serialized.includes(token), `${kind} plan bytes contain "${token}"`).toBe(false);
      }
    }
  });
});
