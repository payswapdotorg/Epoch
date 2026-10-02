/**
 * The ENV-GATED LIVE BATTERY (W060) — the ONLY place a REAL Blender binary
 * is exercised. Skipped unless an operator supplies BOTH:
 *
 *   EPOCH_BLENDER_LIVE=1
 *   EPOCH_BLENDER_PATH=/path/to/blender
 *
 * Run (from adapters/renderers/blender, after `pnpm install --no-frozen-lockfile`):
 *
 *   EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=/path/to/blender \
 *     pnpm test:live
 *
 * Status: NOT-VERIFIED-live at W060 delivery time — no Blender binary
 * exists in the working sandbox. CI-verified evidence (the committed Node
 * CLI double) lives in process/jobs/adapter.test.ts; NOTHING here is ever
 * claimed as CI-verified. What this battery proves when a binary IS
 * supplied: the real `--version` probe, a REAL offscreen Cycles render of
 * the shared canonical fixture scene (PNG artifact, digest-addressed), and
 * a REAL glTF/GLB export — whose bytes then validate through the same
 * protocol.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  BlenderSidecarRendererAdapter,
} from '../src/index';
import {
  CLOCK,
  DEVICE,
  ONTOLOGY,
  SCENE,
  TENANT,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  registerRenderer,
} from './helpers';

const DOUBLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'doubles', 'blender-double.mjs');
const LIVE = process.env.EPOCH_BLENDER_LIVE === '1' && (process.env.EPOCH_BLENDER_PATH ?? '') !== '';

const workspace = LIVE
  ? mkdtempSync(path.join(tmpdir(), 'epoch-blender-live-'))
  : null;
afterAll(() => {
  if (workspace !== null) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe.skipIf(!LIVE)('live Blender runs (real binary; never claimed as CI-verified)', () => {
  it('probes the real Blender version', async () => {
    const adapter = new BlenderSidecarRendererAdapter({
      blenderPath: process.env.EPOCH_BLENDER_PATH!,
      workspaceDir: workspace!,
    });
    const probed = await adapter.probe({ device: DEVICE, atMs: 0 });
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.compatible).toBe(true);
    // The live evidence line: record this in the work order closure.
    console.log('[live] probe:', probed.value.reason);
  });

  it('renders the canonical fixture offscreen through real Cycles', async () => {
    const adapter = new BlenderSidecarRendererAdapter({
      blenderPath: process.env.EPOCH_BLENDER_PATH!,
      workspaceDir: workspace!,
      outputWidth: 320,
      outputHeight: 240,
    });
    const { fabric } = buildFabric();
    registerRenderer(fabric, adapter);
    const created = await fabric.createSession({
      rendererId: adapter.identity().rendererId,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: 'fx-blender-live-render',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const mounted = await fabric.mountScene('fx-blender-live-render', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    expect(mounted.ok).toBe(true);
    const frame = await fabric.applyFrame('fx-blender-live-render', { atMs: CLOCK.firstFrame });
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;
    const evidence = adapter.renderEvidenceOf('fx-blender-live-render');
    expect(evidence).toHaveLength(1);
    console.log(
      '[live] render evidence:',
      JSON.stringify({
        imageDigest: evidence[0]!.imageDigest,
        imageBytes: evidence[0]!.imageBytes,
        blenderVersion: evidence[0]!.blenderVersion,
        durationMs: evidence[0]!.durationMs,
      }),
    );
    // A REAL PNG artifact (digest-addressed, boundary-verified).
    expect(evidence[0]!.imageDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('exports a real GLB of the canonical fixture', async () => {
    const adapter = new BlenderSidecarRendererAdapter({
      blenderPath: process.env.EPOCH_BLENDER_PATH!,
      workspaceDir: workspace!,
    });
    const { fabric } = buildFabric();
    registerRenderer(fabric, adapter);
    const created = await fabric.createSession({
      rendererId: adapter.identity().rendererId,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: 'fx-blender-live-export',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const mounted = await fabric.mountScene('fx-blender-live-export', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    expect(mounted.ok).toBe(true);
    const session = adapter.adapterSessionOf('fx-blender-live-export');
    expect(session).toBeDefined();
    const prepared = await adapter.prepareGltfAsset(session!, { atMs: CLOCK.firstFrame });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    console.log(
      '[live] export evidence:',
      JSON.stringify({
        glbDigest: prepared.value.glbDigest,
        glbBytes: prepared.value.glbBytes,
        blenderVersion: prepared.value.blenderVersion,
      }),
    );
    // A REAL GLB container (magic 'glTF').
    expect(prepared.value.glbBytesData[0]).toBe(0x67);
  });
});

describe.skipIf(LIVE)('the live gate (honest status)', () => {
  it('skips without a supplied Blender binary — NOT-VERIFIED-live, never fabricated', () => {
    console.log(
      '[live] SKIPPED: set EPOCH_BLENDER_LIVE=1 and EPOCH_BLENDER_PATH=<blender> to run the real-binary battery',
    );
    console.log('[live] double (CI evidence):', DOUBLE);
    expect(LIVE).toBe(false);
  });
});
