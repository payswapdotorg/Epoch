// Provider-neutrality evidence: no vendor-, engine-, renderer-, or
// framework-specific vocabulary may leak into the published contract
// surface — neither into the emitted JSON Schemas, the manifest, nor the
// serialized scene/intent/envelope bytes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderWorldExperienceContractFiles } from '../src/contract-emission';
import { serializeWorldScene, sealWorldScene } from '../src/serialize';
import { compileWorldScene, compileIntentSubmission } from '../src/compile';
import { admitWorldIntent } from '../src/intent';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { desktopDevice, referenceOntology, sceneContent, intentFixtures } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'schemas');

/**
 * Vendor/engine/framework blocklist — none of these tokens may appear
 * anywhere in the published contract artifacts or the serialized world
 * documents. The neutral words "provider", "renderer" (the ROLE), and
 * "device" are allowed (they name roles/surfaces, not products).
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
  // Cloud/vendor hosting.
  'aws',
  'azure',
  'gcp',
  'google-cloud',
  // Databases and infra (not part of this layer, must not leak in).
  'postgres',
  'mysql',
  'redis',
  'mongodb',
  'kafka',
  'nats',
  'temporal',
];

function assertNeutral(content: string, label: string): void {
  const haystack = content.toLowerCase();
  for (const token of BLOCKLIST) {
    expect(haystack.includes(token), `${label} must not contain vendor token "${token}"`).toBe(false);
  }
}

describe('provider neutrality', () => {
  it('the emitted contract artifacts carry no vendor/engine tokens', () => {
    const rendered = renderWorldExperienceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      assertNeutral(content, `schemas/${rel}`);
    }
  });

  it('the committed contract artifacts carry no vendor/engine tokens', () => {
    const rendered = renderWorldExperienceContractFiles();
    for (const rel of Object.keys(rendered)) {
      const committed = readFileSync(path.join(CONTRACTS_DIR, rel), 'utf8');
      assertNeutral(committed, `schemas/${rel}`);
    }
  });

  it('serialized scene bytes carry no vendor/engine tokens', () => {
    const sealed = sealWorldScene(sceneContent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    assertNeutral(serializeWorldScene(sealed.value), 'serialized scene');
  });

  it('serialized intent + envelope bytes carry no vendor/engine tokens', () => {
    for (const intent of intentFixtures()) {
      assertNeutral(JSON.stringify(intent), `intent ${intent.kind}`);
      const envelope = compileIntentSubmission(intent, {
        modality: 'pointer',
        invocationId: `w016-neutral-${intent.kind}`,
        rendererSessionId: 'rs-world-alpha',
      });
      assertNeutral(JSON.stringify(envelope), `submit-intent envelope ${intent.kind}`);
    }
  });

  it('compiled graph + envelope bytes carry no vendor/engine tokens', () => {
    const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const compiled = compileWorldScene(created.value.scene, {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: { invocationId: 'w016-neutral-mount', rendererSessionId: 'rs-world-alpha', atMs: 0 },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    assertNeutral(JSON.stringify(compiled.value.graphs), 'compiled graphs');
    assertNeutral(JSON.stringify(compiled.value.mountEnvelopes), 'mount envelopes');
    assertNeutral(JSON.stringify(compiled.value.advanceEnvelope), 'advance envelope');
  });

  it('the executable-UI admission keeps script content OUT of admitted intents (Dynamic UI law)', () => {
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'w016-neutral-select',
      entityId: 'wall-north-1',
      script: 'steal()',
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('executable-ui-rejected');
  });
});
