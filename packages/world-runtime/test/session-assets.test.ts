// W067 — the in-page foundation path battery (ACR-010): the
// `binding-requested` effect applied through `RendererFabric.bindSessionAsset`
// on the LIVE session, over the REAL fabric with the REAL registered glTF
// interchange bridge as the default (the W060 trust gate, unchanged) and
// the contract-only reference renderers behind the seam.
//
// The canonical fixture is the SAME deterministic GLB the bridge's own
// battery and qa/foundation-renderers drive (one triangle: 3 vertices, 36
// position bytes; 640 container bytes), constructed inline here so this
// package's battery never reaches into another package's test tree — the
// pinned SHA-256 asserts byte-identity with the canonical fixture.
//
// Invariants pinned (the W067 acceptance):
// - the APPLIED path: import (validate → normalize → content-address) →
//   the digest-addressed registry → the typed `bind` intent (W066) → the
//   binding-requested effect → the W065 fabric operation → the sealed
//   receipt + the digest-addressed bound-asset ledger + the journal;
// - NO DURABLE SEMANTIC MUTATION: the canonical world digest, the scene
//   revision, the store, and the presented semantic entity ids are all
//   UNCHANGED by an applied binding (binding is presentation);
// - DETERMINISM: identical inputs produce identical binding + receipt
//   digests (the manual clock; zero randomness);
// - the TYPED REFUSALS surface honestly (journal-recorded, session
//   healthy): malformed bytes at the bridge gate, the empty stream, the
//   unknown digest, the missing session, and the presenting renderer that
//   does not declare the asset kind (the reference adapter's seam);
// - the DECLINED path (a soft adapter decline): the receipt records the
//   neutral reason, the ledger entry carries `declined`, never a failure;
// - SESSION ROTATION: a canonical revision change presents a FRESH session
//   — the re-bind seals a NEW session-addressed binding for the SAME
//   digest-addressed asset (the ledger's continuity key is the ASSET
//   digest, never the session).
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  ReferenceRendererAdapter,
  RendererFabric,
  rendererCapabilityManifestOf,
  type RendererAdapter,
} from '@epoch/renderer-fabric';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import type { RendererCapabilitySet, RendererDescriptor } from '@epoch/renderer-runtime';
import { WorldWorkspaceRuntime } from '../src/workspace';
import { ManualFrameScheduler } from '../src/clock';
import {
  FULL_RENDERER_ID,
  REDUCED_RENDERER_ID,
  FixtureClock,
  workspaceInputs,
} from './fixtures';

// ---------------------------------------------------------------------------
// The canonical glTF fixture (byte-identical to the bridge battery's — the
// digest pin below proves it; see adapters/foundations/gltf/test/helpers.ts).
// ---------------------------------------------------------------------------

/** The canonical fixture triangle: (0,0,0), (1,0,0), (0,1,0) — little-endian floats. */
const TRIANGLE_FLOATS: readonly number[] = [0, 0, 0, 1, 0, 0, 0, 1, 0];

/** The canonical fixture GLB (JSON + 36-byte BIN of the triangle positions). */
function canonicalGlbBytes(): Uint8Array {
  const floats = new Uint8Array(36);
  const floatView = new DataView(floats.buffer, floats.byteOffset, floats.byteLength);
  TRIANGLE_FLOATS.forEach((value, index) => floatView.setFloat32(index * 4, value, true));
  const json = {
    asset: { version: '2.0', generator: 'epoch-gltf-fixture/1' },
    scene: 0,
    scenes: [{ name: 'Fixture scene', nodes: [0] }],
    nodes: [{ name: 'Fixture node', mesh: 0, translation: [1, 0, 0] }],
    meshes: [
      {
        name: 'Fixture mesh',
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
      },
    ],
    materials: [
      {
        name: 'Fixture material',
        pbrMetallicRoughness: { baseColorFactor: [0.8, 0.4, 0.2, 1] },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const binPadding = (4 - (floats.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;
  const binChunkLength = floats.length + binPadding;
  const total = 12 + 8 + jsonChunkLength + 8 + binChunkLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.length + i] = 0x20;
  const binHeader = 20 + jsonChunkLength;
  view.setUint32(binHeader, binChunkLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true); // 'BIN\0'
  out.set(floats, binHeader + 8);
  return out;
}

/** The canonical fixture's pinned content address (byte-identity with the bridge battery). */
const CANONICAL_GLB_DIGEST = '9cfd1b40cadefd283a5048301bd3c449f4dfe057095e11479bc9df45202ad556' as const;

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// ---------------------------------------------------------------------------
// The soft-decline adapter (bindAsset answers bound: false — never a failure).
// ---------------------------------------------------------------------------

const DECLINING_RENDERER_ID = 'rr-workspace-declining';

const DECLINING_DESCRIPTOR: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: DECLINING_RENDERER_ID,
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
  budgets: { maxGraphNodes: 4_096, maxGraphEdges: 8_192, maxTriangles: 1_000_000, maxTextureBytes: 268_435_464 },
};

const DECLINING_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: DECLINING_RENDERER_ID,
  hitTesting: true,
  measurement: true,
  annotation: true,
  frameCapture: false,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['mesh'],
};

/** An adapter whose bindAsset seam accepts the orchestration but declines. */
class DecliningRendererAdapter extends ReferenceRendererAdapter {
  constructor() {
    super({
      identity: {
        capabilityId: 'epoch.renderer.workspace-declining',
        rendererId: DECLINING_RENDERER_ID,
        displayName: 'Workspace Declining Renderer (reference)',
      },
      descriptor: DECLINING_DESCRIPTOR,
      capabilities: DECLINING_CAPABILITIES,
    });
  }

  override async bindAsset(): Promise<{ ok: true; value: { bound: boolean } }> {
    // The soft decline: the orchestration was accepted, the adapter chose
    // not to apply the binding — a typed receipt outcome, never a failure.
    return { ok: true, value: { bound: false } };
  }
}

/** Register one adapter with the fabric through the REAL capability registry. */
function registerRenderer(fabric: RendererFabric, adapter: RendererAdapter): void {
  const identity = adapter.identity();
  const manifest = rendererCapabilityManifestOf({
    capabilityId: identity.capabilityId,
    version: '1.0.0',
    descriptor: adapter.descriptor(),
    capabilities: adapter.capabilities(),
    displayName: identity.displayName,
    description: identity.description ?? 'workspace fixture renderer',
  });
  const sealed = sealCapabilityManifest(manifest);
  if (!sealed.ok) {
    throw new Error(`fixture manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter,
  });
  if (!registered.ok) {
    throw new Error(`fixture renderer failed to register: ${registered.error.message}`);
  }
}

// ---------------------------------------------------------------------------
// The battery helpers.
// ---------------------------------------------------------------------------

async function openWorkspace(preferences?: readonly string[]) {
  const clock = new FixtureClock();
  const scheduler = new ManualFrameScheduler();
  const inputs = workspaceInputs(clock, scheduler);
  const runtime = new WorldWorkspaceRuntime(
    preferences === undefined ? inputs : { ...inputs, rendererPreference: preferences },
  );
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`workspace failed to open: ${opened.error.message}`);
  }
  return { clock, scheduler, runtime, session: opened.value };
}

/** Open a workspace whose presenter DECLINES bindings (the soft-decline path). */
async function openDecliningWorkspace() {
  const clock = new FixtureClock();
  const scheduler = new ManualFrameScheduler();
  const inputs = workspaceInputs(clock, scheduler);
  const fabric = inputs.fabric;
  registerRenderer(fabric, new DecliningRendererAdapter());
  const runtime = new WorldWorkspaceRuntime({
    ...inputs,
    rendererPreference: [DECLINING_RENDERER_ID, FULL_RENDERER_ID, REDUCED_RENDERER_ID],
  });
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`declining workspace failed to open: ${opened.error.message}`);
  }
  return { clock, scheduler, runtime, session: opened.value };
}

/** Import the canonical fixture (fails readable). */
function importCanonical(runtime: WorldWorkspaceRuntime, fileName = 'fixture-triangle.glb') {
  const imported = runtime.importFoundationAsset(canonicalGlbBytes(), { fileName });
  if (!imported.ok) {
    throw new Error(`canonical import failed: ${imported.error.code}: ${imported.error.message}`);
  }
  return imported.value;
}

// ---------------------------------------------------------------------------
// The battery.
// ---------------------------------------------------------------------------

describe('the in-page foundation path (W067) — import through the trust gate', () => {
  it('admits the canonical glTF fixture through the REAL interchange bridge, digest-addressed', async () => {
    const { runtime } = await openWorkspace();
    try {
      // The fixture is byte-identical to the bridge battery's canonical GLB.
      const bytes = canonicalGlbBytes();
      expect(bytes.length).toBe(640);
      expect(sha256Of(bytes)).toBe(CANONICAL_GLB_DIGEST);
      const imported = runtime.importFoundationAsset(bytes, { fileName: 'riser-cap.glb' });
      expect(imported.ok, JSON.stringify(imported)).toBe(true);
      if (!imported.ok) return;
      // The registry entry is content-addressed by the RAW-byte digest.
      expect(imported.value.assetDigest).toBe(CANONICAL_GLB_DIGEST);
      expect(imported.value.assetKind).toBe('mesh');
      expect(imported.value.byteSize).toBe(640);
      expect(imported.value.vertexCount).toBe(3);
      expect(imported.value.triangleCount).toBe(1);
      // The neutral label prefers the asset's own mesh name.
      expect(imported.value.label).toBe('Fixture mesh');
      // The view model surfaces the registry (digest-addressed).
      expect(runtime.viewModel().sessionAssets.imported.map((a) => a.assetDigest)).toEqual([
        CANONICAL_GLB_DIGEST,
      ]);
      // The import is journaled (workspace-command, normalized).
      const journal = runtime.viewModel().journal;
      expect(
        journal.some(
          (entry) =>
            entry.intentKind === 'import-asset' &&
            entry.outcome === 'normalized' &&
            (entry.detail ?? '').includes(CANONICAL_GLB_DIGEST.slice(0, 12)),
        ),
      ).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('re-importing identical bytes is idempotent (one registry entry, one digest)', async () => {
    const { runtime } = await openWorkspace();
    try {
      importCanonical(runtime);
      importCanonical(runtime, 'same-bytes-other-name.glb');
      const imported = runtime.viewModel().sessionAssets.imported;
      expect(imported).toHaveLength(1);
      expect(imported[0]?.assetDigest).toBe(CANONICAL_GLB_DIGEST);
    } finally {
      await runtime.close();
    }
  });

  it('malformed bytes are the bridge\u2019s typed refusal — nothing registers, the session stays healthy', async () => {
    const { runtime } = await openWorkspace();
    try {
      const garbage = new TextEncoder().encode('this is not a glTF container at all');
      const refused = runtime.importFoundationAsset(garbage, { fileName: 'garbage.bin' });
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        // The bridge's typed code, verbatim (the trust gate is the bridge's).
        expect(refused.error.code.length).toBeGreaterThan(0);
        expect(refused.error.message.length).toBeGreaterThan(0);
      }
      // The zero-byte stream is the seam's own typed refusal.
      const empty = runtime.importFoundationAsset(new Uint8Array(0), { fileName: 'empty.glb' });
      expect(empty.ok).toBe(false);
      if (!empty.ok) {
        expect(empty.error.code).toBe('input-empty');
      }
      // Nothing registered; both refusals are journal-recorded.
      expect(runtime.viewModel().sessionAssets.imported).toHaveLength(0);
      const rejected = runtime.viewModel().journal.filter(
        (entry) => entry.intentKind === 'import-asset' && entry.outcome === 'rejected',
      );
      expect(rejected).toHaveLength(2);
      // The session is untouched and healthy (the gate refused BEFORE the fabric).
      expect(runtime.session()?.state).toBe('active');
      expect(runtime.viewModel().renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });

  it('imports need no live session (the registry is presentation-independent)', async () => {
    const clock = new FixtureClock();
    const scheduler = new ManualFrameScheduler();
    const runtime = new WorldWorkspaceRuntime(workspaceInputs(clock, scheduler));
    const imported = runtime.importFoundationAsset(canonicalGlbBytes(), { fileName: 'early.glb' });
    expect(imported.ok).toBe(true);
    // But binding without a session is the typed unknown-session refusal.
    const bound = await runtime.bindFoundationAsset(CANONICAL_GLB_DIGEST);
    expect(bound.ok).toBe(false);
    if (!bound.ok) {
      expect(bound.error.code).toBe('unknown-session');
    }
    await runtime.close();
  });
});

describe('the in-page foundation path (W067) — the applied binding', () => {
  it('applies the typed bind through the W065 fabric operation onto the live session', async () => {
    const { runtime } = await openWorkspace();
    try {
      const imported = importCanonical(runtime);
      const bound = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(bound.ok, JSON.stringify(bound)).toBe(true);
      if (!bound.ok) return;
      // The ledger entry is digest-addressed (the ASSET digest is the key).
      expect(bound.value.assetDigest).toBe(CANONICAL_GLB_DIGEST);
      expect(bound.value.outcome).toBe('applied');
      expect(bound.value.reason).toBeNull();
      expect(bound.value.assetKind).toBe('mesh');
      expect(bound.value.rendererId).toBe(FULL_RENDERER_ID);
      expect(bound.value.fabricSessionId).toBe(runtime.session()?.fabricSessionId);
      // The sealed binding digest (the bind intent's reference) and the
      // receipt digest are content addresses.
      expect(bound.value.bindingDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(bound.value.receiptDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(bound.value.bindingId).toMatch(/^rab-[a-z0-9][a-z0-9-]{0,62}$/);
      // The ledger + journal + effects surfaces all carry the evidence.
      const view = runtime.viewModel();
      expect(view.sessionAssets.ledger).toHaveLength(1);
      expect(view.sessionAssets.ledger[0]?.receiptDigest).toBe(bound.value.receiptDigest);
      expect(
        view.journal.some(
          (entry) => entry.intentKind === 'bind' && entry.outcome === 'applied',
        ),
      ).toBe(true);
      expect(
        view.effects.some(
          (entry) =>
            entry.effect.effect === 'binding-requested' &&
            entry.effect.bindingDigest === bound.value.bindingDigest,
        ),
      ).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('NEVER mutates the canonical world: digest, entities, and revision are unchanged (binding is presentation)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const digestBefore = runtime.currentScene().digest;
      const entitiesBefore = runtime.currentScene().entities.map((e) => e.entityId);
      const sceneBefore = runtime.currentScene();
      const imported = importCanonical(runtime);
      const bound = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(bound.ok).toBe(true);
      // The canonical scene object is the SAME revision (no new presentation
      // cycle: bind is effect-only, so not even the session rotated).
      expect(runtime.currentScene()).toBe(sceneBefore);
      expect(runtime.currentScene().digest).toBe(digestBefore);
      expect(runtime.currentScene().entities.map((e) => e.entityId)).toEqual(entitiesBefore);
      // The view model's semantic surface is unchanged.
      const view = runtime.viewModel();
      expect(view.viewport.worldDigest).toBe(digestBefore);
      expect(view.viewport.entities.map((e) => e.entityId)).toEqual(entitiesBefore);
      // The session is still the same healthy presentation.
      expect(view.renderers.sessionState).toBe('active');
      expect(view.renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });

  it('is deterministic: identical inputs produce identical binding + receipt digests', async () => {
    const first = await openWorkspace();
    const second = await openWorkspace();
    try {
      const firstImport = importCanonical(first.runtime);
      const firstBound = await first.runtime.bindFoundationAsset(firstImport.assetDigest);
      const secondImport = importCanonical(second.runtime);
      const secondBound = await second.runtime.bindFoundationAsset(secondImport.assetDigest);
      expect(firstBound.ok).toBe(true);
      expect(secondBound.ok).toBe(true);
      if (!firstBound.ok || !secondBound.ok) return;
      expect(secondBound.value.bindingDigest).toBe(firstBound.value.bindingDigest);
      expect(secondBound.value.receiptDigest).toBe(firstBound.value.receiptDigest);
      expect(secondBound.value.bindingId).toBe(firstBound.value.bindingId);
    } finally {
      await first.runtime.close();
      await second.runtime.close();
    }
  });

  it('the effect observer receives the binding-requested effect (host routing)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const observed: string[] = [];
      runtime.setEffectObserver((effect) => {
        if (effect.effect === 'binding-requested') {
          observed.push(effect.bindingDigest);
        }
      });
      const imported = importCanonical(runtime);
      const bound = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(bound.ok).toBe(true);
      if (!bound.ok) return;
      expect(observed).toEqual([bound.value.bindingDigest]);
    } finally {
      await runtime.close();
    }
  });
});

describe('the in-page foundation path (W067) — typed refusals + the declined path', () => {
  it('an unknown digest is a typed unknown-asset refusal (journaled, session healthy)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const bound = await runtime.bindFoundationAsset('a'.repeat(64));
      expect(bound.ok).toBe(false);
      if (!bound.ok) {
        expect(bound.error.code).toBe('unknown-asset');
      }
      expect(runtime.viewModel().sessionAssets.ledger).toHaveLength(0);
      expect(
        runtime.viewModel().journal.some(
          (entry) => entry.intentKind === 'bind' && entry.outcome === 'rejected',
        ),
      ).toBe(true);
      expect(runtime.viewModel().renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });

  it('a presenter that does not declare the asset kind refuses typed at the reference seam (no partial application)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const imported = importCanonical(runtime);
      // The REDUCED fixture renderer declares ZERO asset kinds: the fabric
      // operation refuses before the seam (the W065 capability check).
      const switched = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(switched.ok).toBe(true);
      const bound = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(bound.ok).toBe(false);
      if (!bound.ok) {
        expect(bound.error.code).toBe('asset-rejected');
        expect(bound.error.message).toContain('mesh');
      }
      // Nothing was applied anywhere: the ledger stays empty, the journal
      // records the honest two-phase outcome, the session stays healthy.
      expect(runtime.viewModel().sessionAssets.ledger).toHaveLength(0);
      const journal = runtime.viewModel().journal;
      expect(
        journal.some((entry) => entry.intentKind === 'bind' && entry.outcome === 'rejected'),
      ).toBe(true);
      // The bind intent itself was admitted (the effect surfaced).
      expect(
        runtime.viewModel().effects.some((entry) => entry.effect.effect === 'binding-requested'),
      ).toBe(true);
      expect(runtime.viewModel().renderers.health.state).toBe('healthy');
      expect(runtime.session()?.state).toBe('active');
    } finally {
      await runtime.close();
    }
  });

  it('a soft adapter decline is the declined receipt outcome, never a failure', async () => {
    const { runtime } = await openDecliningWorkspace();
    try {
      expect(runtime.session()?.rendererId).toBe(DECLINING_RENDERER_ID);
      const imported = importCanonical(runtime);
      const bound = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(bound.ok, JSON.stringify(bound)).toBe(true);
      if (!bound.ok) return;
      expect(bound.value.outcome).toBe('declined');
      expect(bound.value.reason).toBe('adapter-declined');
      expect(bound.value.rendererId).toBe(DECLINING_RENDERER_ID);
      // The ledger records the decline (digest-addressed, outcome declined).
      const ledger = runtime.viewModel().sessionAssets.ledger;
      expect(ledger).toHaveLength(1);
      expect(ledger[0]?.outcome).toBe('declined');
      // The journal records the normalized outcome with the receipt.
      expect(
        runtime.viewModel().journal.some(
          (entry) => entry.intentKind === 'bind' && entry.outcome === 'normalized',
        ),
      ).toBe(true);
      // The session stays healthy (a decline is not a failure).
      expect(runtime.viewModel().renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });
});

describe('the in-page foundation path (W067) — session rotation continuity', () => {
  it('a canonical revision change presents a FRESH session; the re-bind seals a new binding for the SAME digest-addressed asset', async () => {
    const { runtime } = await openWorkspace();
    try {
      const imported = importCanonical(runtime);
      const first = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const firstSession = runtime.session()?.fabricSessionId;
      expect(firstSession).toBeDefined();
      // A canonical revision change (the annotate intent) rotates the
      // session (the W056 digest-continuity invariant: one session, one
      // exact world revision).
      const annotated = await runtime.composeAnnotation('Clash risk at the riser penetration');
      expect(annotated.ok && annotated.value).toBe(true);
      const secondSession = runtime.session()?.fabricSessionId;
      expect(secondSession).toBeDefined();
      expect(secondSession).not.toBe(firstSession);
      // The re-bind on the FRESH session: a NEW session-addressed binding
      // for the SAME digest-addressed asset.
      const second = await runtime.bindFoundationAsset(imported.assetDigest);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.fabricSessionId).toBe(secondSession);
      expect(second.value.assetDigest).toBe(first.value.assetDigest);
      expect(second.value.bindingDigest).not.toBe(first.value.bindingDigest);
      // The ledger carries both applications, keyed by the asset digest.
      const ledger = runtime.viewModel().sessionAssets.ledger;
      expect(ledger).toHaveLength(2);
      expect(ledger.map((entry) => entry.assetDigest)).toEqual([
        second.value.assetDigest,
        first.value.assetDigest,
      ]);
    } finally {
      await runtime.close();
    }
  });
});
