// Provider-neutrality evidence: no vendor-, engine-, renderer-, or
// framework-specific vocabulary may leak into the published contract
// surface — neither into the emitted JSON Schemas, the manifest, nor the
// TypeScript declarations. The device slot is abstract typed data (W019
// fills it); concrete engines are future adapters (lock rule 13).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderExperienceContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'experience');

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

describe('experience contract provider neutrality', () => {
  it('contains no vendor/engine/framework tokens in any emitted schema or the manifest', () => {
    const rendered = renderExperienceContractFiles();
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
    const rendered = renderExperienceContractFiles();
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

  it('the device descriptor publishes exactly the neutral typed fields', () => {
    const rendered = renderExperienceContractFiles();
    const device = JSON.parse(rendered['schemas/device-descriptor.schema.json']!) as {
      $defs: {
        DeviceDescriptor: { required: string[]; properties: Record<string, unknown> };
        DeviceDisplayCapabilities: { properties: Record<string, unknown> };
        DeviceSpatialCapabilities: { properties: Record<string, unknown> };
      };
    };
    expect(Object.keys(device.$defs.DeviceDescriptor.properties).sort()).toEqual([
      'descriptorVersion',
      'deviceClass',
      'display',
      'interaction',
      'latencyBudgetMs',
      'spatial',
    ]);
    expect(Object.keys(device.$defs.DeviceDisplayCapabilities.properties).sort()).toEqual([
      'colorDepthBits',
      'maxPixels',
      'refreshHz',
      'stereoscopic',
    ]);
    expect(Object.keys(device.$defs.DeviceSpatialCapabilities.properties).sort()).toEqual([
      'maxTextureBytes',
      'maxTriangles',
      'poseTracking',
      'worldAnchored',
    ]);
  });

  it('device classes and interaction modalities are the neutral sets', () => {
    const rendered = renderExperienceContractFiles();
    const deviceClass = JSON.parse(rendered['schemas/device-class.schema.json']!) as {
      $defs: { DeviceClass: { enum: string[] } };
    };
    expect([...deviceClass.$defs.DeviceClass.enum].sort()).toEqual([
      'desktop',
      'headset',
      'laptop',
      'phone',
      'tablet',
      'wall-display',
    ]);
    const interaction = JSON.parse(rendered['schemas/interaction-modality.schema.json']!) as {
      $defs: { InteractionModality: { enum: string[] } };
    };
    expect([...interaction.$defs.InteractionModality.enum].sort()).toEqual([
      'gamepad',
      'gaze',
      'gesture',
      'keyboard',
      'pointer',
      'touch',
      'voice',
    ]);
  });

  it('the graph envelope marks the authority-relevant fields required', () => {
    const rendered = renderExperienceContractFiles();
    const graph = JSON.parse(rendered['schemas/experience-graph.schema.json']!) as {
      $defs: { ExperienceGraph: { required: string[] } };
    };
    for (const field of [
      'schema',
      'protocolVersion',
      'graphId',
      'graphKind',
      'tenantScope',
      'projectedFrom',
      'nodes',
      'edges',
      'device',
      'digest',
    ]) {
      expect(graph.$defs.ExperienceGraph.required).toContain(field);
    }
  });

  it('every node member carries the id, kind, and descriptor fields', () => {
    const rendered = renderExperienceContractFiles();
    const nodes = JSON.parse(rendered['schemas/experience-node.schema.json']!) as {
      $defs: Record<string, { required?: string[] }>;
    };
    // Node members are the defs whose required set includes 'descriptor'.
    const members = Object.entries(nodes.$defs).filter(([, def]) =>
      (def.required ?? []).includes('descriptor'),
    );
    expect(members.length).toBe(10);
    for (const [member, def] of members) {
      expect(def.required).toContain('id');
      expect(def.required).toContain('kind');
      expect(def.required).toContain('descriptor');
      expect(member).toMatch(/^(Shape2d|Spatial3d|Label|AnimationClip|NarrativeBeat|TimelineTrack|TimelineMarker|PresenceSeat|PresenceCursor|Control)Node$/);
    }
  });
});
