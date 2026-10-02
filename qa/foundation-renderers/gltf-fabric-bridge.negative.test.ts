/**
 * THE W060 FOUNDATION & ASSET-BRIDGE BATTERY — NEGATIVE: typed failures
 * and safety invariants of the end-to-end foundation path (the same
 * surface the positive battery proves happy-path).
 *
 * Every failure mode of the asset bridge is produced by a REAL input and
 * is TYPED (a discriminated GltfBridgeFailure code or a RendererFailure
 * code) — never a bare throw at the boundary, never a truncated parse,
 * never a silent drop. The safety invariants exercised hardest here:
 *
 * - MALFORMED INPUT NEVER BINDS: every malformed glTF/GLB shape is a
 *   typed refusal at the trust gate; the only record unvalidated bytes
 *   can produce is an explicit UNTRUSTED tracking binding;
 * - UNTRUSTED ASSETS NEVER MOUNT: every adapter class refuses untrusted
 *   bindings at the real seam (the embedded engine AND the external
 *   sidecar);
 * - DECLARED KINDS ONLY: an asset kind an adapter did not declare is a
 *   typed refusal, never a best-effort mount;
 * - TENANT SCOPE IS SEALED INTO THE RECORD (R12): bindings of the same
 *   bytes for different tenants are distinct, verifiable records;
 * - NO DURABLE SEMANTIC MUTATION: binding an asset never touches the
 *   canonical world — the scene digest, presented semantic ids, and the
 *   fabric session map are unchanged;
 * - BOUNDARY FAILURES NEVER LEAK ASSETS: a sidecar whose self-reported
 *   artifact digest does not match its bytes is refused typed, and
 *   NOTHING re-enters the bridge.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { RendererFailure, RendererAssetBinding } from '../../packages/renderer-runtime/src/index';
import { sealRendererAssetBinding } from '../../packages/renderer-runtime/src/index';
import { RendererFabric } from '../../packages/renderer-fabric/src/index';
import {
  admitGltfAsset,
  gltfRendererAssetBinding,
  gltfUntrustedAssetBinding,
} from '../../adapters/foundations/gltf/src/index';
import {
  buildGlb,
  canonicalGlbBytes,
  canonicalGltfJson,
  trianglePositionBytes,
  withMutation,
} from '../../adapters/foundations/gltf/test/helpers';
import { THREE_RENDERER_ID, ThreeJsRendererAdapter } from '../../adapters/renderers/threejs/src/index';
import { BlenderSidecarRendererAdapter } from '../../adapters/renderers/blender/src/index';
import {
  CLOCK,
  DEVICE,
  ONTOLOGY,
  SCENE,
  TENANT,
  TENANT_OTHER,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  registerRenderer,
} from '../renderer-conformance/fixture';

// ---------------------------------------------------------------------------
// Battery helpers.
// ---------------------------------------------------------------------------

const THREE_SESSION = 'fx-w060-negative-three';
const BLENDER_SESSION = 'fx-w060-negative-blender';

const DOUBLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../adapters/renderers/blender/test/doubles/blender-double.mjs',
);

const workspaces: string[] = [];
afterEach(() => {
  for (const dir of workspaces.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Narrow a fabric failure to its typed code (readable mismatches). */
function expectFailure<C extends RendererFailure['code']>(
  result: { ok: true } | { ok: false; error: RendererFailure },
  code: C,
): Extract<RendererFailure, { code: C }> {
  if (!result.ok) {
    if (result.error.code === code) {
      return result.error as Extract<RendererFailure, { code: C }>;
    }
    throw new Error(
      `expected typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  throw new Error(`expected typed "${code}" failure, got a success`);
}

/** One fabric + the reference renderers + the REAL three.js adapter (mounted session). */
async function mountedThree(): Promise<{
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
}> {
  const three = new ThreeJsRendererAdapter();
  const { fabric } = buildFabric();
  registerRenderer(fabric, three);
  const created = await fabric.createSession({
    rendererId: THREE_RENDERER_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId: THREE_SESSION,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`three.js session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(THREE_SESSION, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`three.js mount failed: ${mounted.error.message}`);
  }
  return { fabric, three };
}

/** One mounted Blender sidecar session over the committed CLI double (plus its fabric). */
async function mountedBlender(
  env?: Readonly<Record<string, string>>,
): Promise<{
  readonly blender: BlenderSidecarRendererAdapter;
  readonly fabric: RendererFabric;
}> {
  const workspace = mkdtempSync(path.join(tmpdir(), 'epoch-w060-negative-'));
  workspaces.push(workspace);
  const blender = new BlenderSidecarRendererAdapter({
    blenderPath: process.execPath,
    argvPrefix: [DOUBLE],
    workspaceDir: workspace,
    ...(env === undefined ? {} : { env }),
  });
  const { fabric } = buildFabric();
  registerRenderer(fabric, blender);
  const created = await fabric.createSession({
    rendererId: blender.identity().rendererId,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId: BLENDER_SESSION,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`sidecar session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(BLENDER_SESSION, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`sidecar mount failed: ${mounted.error.message}`);
  }
  return { blender, fabric };
}

/** Encode one .gltf JSON document as bytes. */
function gltfJsonBytes(json: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

// ---------------------------------------------------------------------------
// The trust gate: malformed input is typed refusal — never a parse, never
// a binding.
// ---------------------------------------------------------------------------

describe('the glTF trust gate (negative: every malformed shape is a typed refusal)', () => {
  it('refuses empty, oversized, and non-glTF input typed', () => {
    // Empty bytes.
    const empty = admitGltfAsset(new Uint8Array(0));
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.code).toBe('input-empty');

    // A document above the size limit (caller-supplied tighter limits —
    // the same typed path the default limit takes).
    const oversized = admitGltfAsset(canonicalGlbBytes(), { maxDocumentBytes: 8 });
    expect(oversized.ok).toBe(false);
    if (oversized.ok) return;
    expect(oversized.error.code).toBe('limit-exceeded');

    // Bytes that are neither a GLB container nor JSON.
    const garbage = admitGltfAsset(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]));
    expect(garbage.ok).toBe(false);
    if (garbage.ok) return;
    expect(garbage.error.code).toBe('malformed-json');
  });

  it('refuses structurally invalid GLB containers typed (version, truncation)', () => {
    // A GLB that declares container version 1.
    const versionOne = new Uint8Array(canonicalGlbBytes());
    new DataView(versionOne.buffer).setUint32(4, 1, true);
    const refused = admitGltfAsset(versionOne);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('glb-invalid');
    expect(refused.error.message).toContain('version');

    // A truncated GLB (the declared total length no longer matches).
    const truncated = admitGltfAsset(canonicalGlbBytes().slice(0, 20));
    expect(truncated.ok).toBe(false);
    if (truncated.ok) return;
    expect(truncated.error.code).toBe('glb-invalid');
  });

  it('refuses non-2.0 documents and external resource URIs typed', () => {
    // asset.version '1.0' — not the glTF 2.0 core subset.
    const oldVersion = withMutation(canonicalGltfJson(), (draft) => {
      (draft.asset as Record<string, unknown>).version = '1.0';
    });
    const refused = admitGltfAsset(gltfJsonBytes(oldVersion));
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('not-gltf2');

    // An EXTERNAL resource URI: the bridge resolves only embedded data URIs
    // and the GLB BIN chunk — acquisition is the HOST's concern, and
    // whatever it acquires re-enters through this same validation.
    const external = withMutation(canonicalGltfJson(), (draft) => {
      draft.buffers = [{ byteLength: 36, uri: 'assets/positions.bin' }];
    });
    const unresolvable = admitGltfAsset(gltfJsonBytes(external));
    expect(unresolvable.ok).toBe(false);
    if (unresolvable.ok) return;
    expect(unresolvable.error.code).toBe('buffer-unresolvable');
    expect(unresolvable.error.message).toContain('non-embedded resource');

    // The SAME discipline holds inside a GLB: a buffer that declares more
    // bytes than the GLB BIN chunk carries is a typed mismatch (a shorter
    // declaration is spec-legal — the BIN chunk may carry padding).
    const mismatched = withMutation(canonicalGltfJson(), (draft) => {
      draft.buffers = [{ byteLength: 1024 }]; // the BIN chunk carries only 36
    });
    const mismatch = admitGltfAsset(buildGlb(mismatched, trianglePositionBytes()));
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.error.code).toBe('buffer-mismatch');
  });

  it('never produces a binding from refused bytes: the only record is UNTRUSTED tracking', () => {
    // A malformed document cannot pass the trust gate, so no admission
    // exists to feed the validated factory (the type requires a
    // GltfAdmission — only admitGltfAsset produces one, only after full
    // validation). The ONLY record these bytes can produce is the explicit
    // UNTRUSTED tracking binding — whose mount the next test proves every
    // adapter refuses.
    const refused = admitGltfAsset(new Uint8Array([0xff, 0xfe, 0xfd]));
    expect(refused.ok).toBe(false);

    const tracking = gltfUntrustedAssetBinding({
      assetBytes: new Uint8Array([0xff, 0xfe, 0xfd]),
      bindingId: 'rab-w060-negative-untrusted-1',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    expect(tracking.trustState).toBe('untrusted');
    expect(tracking.validatedAtMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The mount discipline at the REAL seam (both adapter classes).
// ---------------------------------------------------------------------------

describe('the asset-mount discipline (negative: real seam, both adapter classes)', () => {
  it('refuses untrusted bindings on the embedded engine AND the external sidecar', async () => {
    const { three } = await mountedThree();
    const threeSession = three.adapterSessionOf(THREE_SESSION);
    expect(threeSession).toBeDefined();

    const { blender } = await mountedBlender();
    const blenderSession = blender.adapterSessionOf(BLENDER_SESSION);
    expect(blenderSession).toBeDefined();

    // The SAME untrusted record, offered to both adapter classes.
    const untrusted = gltfUntrustedAssetBinding({
      assetBytes: canonicalGlbBytes(),
      bindingId: 'rab-w060-negative-untrusted-2',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });

    const threeRefusal = expectFailure(await three.bindAsset!(threeSession!, untrusted), 'asset-rejected');
    expect(threeRefusal.reason).toBe('untrusted');

    const blenderRefusal = expectFailure(await blender.bindAsset(blenderSession!, untrusted), 'asset-rejected');
    expect(blenderRefusal.reason).toBe('untrusted');

    // Neither ledger carries anything.
    expect(three.runtimeStateOf(THREE_SESSION)!.boundAssets.size).toBe(0);
    expect(blender.boundAssetDigestsOf(BLENDER_SESSION)).toEqual([]);
  });

  it('refuses asset kinds the adapter did not declare (typed, per adapter)', async () => {
    const { three } = await mountedThree();
    const threeSession = three.adapterSessionOf(THREE_SESSION);
    expect(threeSession).toBeDefined();
    const { blender } = await mountedBlender();
    const blenderSession = blender.adapterSessionOf(BLENDER_SESSION);
    expect(blenderSession).toBeDefined();

    const sealed = (
      overrides: { assetKind: RendererAssetBinding['assetKind']; bindingId: string; fabricSessionId: string },
    ): RendererAssetBinding =>
      sealRendererAssetBinding({
        schema: 'epoch.renderer-asset-binding',
        fabricProtocolVersion: '1.0.0',
        bindingId: overrides.bindingId,
        fabricSessionId: overrides.fabricSessionId,
        tenantScope: { tenantId: TENANT },
        assetDigest: 'd'.repeat(64),
        assetKind: overrides.assetKind,
        byteSize: 128,
        trustState: 'validated',
        validatedAtMs: CLOCK.firstInput,
        boundAtMs: CLOCK.firstInput,
      });

    // The three.js adapter declares material/mesh/texture — 'animation' is
    // a typed refusal.
    const animation = sealed({
      assetKind: 'animation',
      bindingId: 'rab-w060-negative-animation',
      fabricSessionId: THREE_SESSION,
    });
    const threeRefusal = expectFailure(await three.bindAsset!(threeSession!, animation), 'asset-rejected');
    expect(threeRefusal.reason).toBe('undeclared asset kind');

    // The sidecar declares mesh only — a 'texture' binding is a typed
    // refusal there.
    const texture = sealed({
      assetKind: 'texture',
      bindingId: 'rab-w060-negative-texture',
      fabricSessionId: BLENDER_SESSION,
    });
    const blenderRefusal = expectFailure(await blender.bindAsset(blenderSession!, texture), 'asset-rejected');
    expect(blenderRefusal.reason).toBe('undeclared asset kind');
  });
});

// ---------------------------------------------------------------------------
// The tenant-scope discipline (R12: assets never cross tenants).
// ---------------------------------------------------------------------------

describe('the tenant-scope discipline (negative: the record is the carrier)', () => {
  it('seals the tenant into the binding: same bytes, different tenants, distinct verifiable records', () => {
    const bytes = canonicalGlbBytes();
    const admitted = admitGltfAsset(bytes);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;

    const own = gltfRendererAssetBinding({
      admission: admitted.value,
      bindingId: 'rab-w060-tenant-own',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    const foreign = gltfRendererAssetBinding({
      admission: admitted.value,
      bindingId: 'rab-w060-tenant-own',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT_OTHER },
      boundAtMs: CLOCK.firstInput,
    });

    // Same asset content address (the bytes are the same), but the RECORDS
    // are tenant-scoped and digest-distinct: a foreign-tenant binding can
    // never impersonate the fixture tenant's record (the digest covers the
    // tenant scope; the host's per-session binding discipline carries it).
    expect(own.assetDigest).toBe(foreign.assetDigest);
    expect(own.tenantScope).toEqual({ tenantId: TENANT });
    expect(foreign.tenantScope).toEqual({ tenantId: TENANT_OTHER });
    expect(own.digest).not.toBe(foreign.digest);
  });
});

// ---------------------------------------------------------------------------
// No durable semantic mutation (the binding is presentation-scoped).
// ---------------------------------------------------------------------------

describe('the no-durable-mutation proof (negative: binding never touches semantics)', () => {
  it('leaves the canonical world, the presented identity, and the session map untouched', async () => {
    const { fabric, three } = await mountedThree();
    const session = three.adapterSessionOf(THREE_SESSION);
    expect(session).toBeDefined();

    const sceneDigestBefore = SCENE.digest;
    const entityCountBefore = SCENE.entities.length;
    const presentedBefore = [...three.presentationOf(THREE_SESSION)!.presentedEntityIds].sort();
    const sessionsBefore = [...fabric.sessionIds()].sort();

    const admitted = admitGltfAsset(canonicalGlbBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const binding = gltfRendererAssetBinding({
      admission: admitted.value,
      bindingId: 'rab-w060-nodurable-1',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    const bound = await three.bindAsset!(session!, binding);
    expect(bound.ok).toBe(true);

    // The canonical scene (the continuity anchor) is byte-identical.
    expect(SCENE.digest).toBe(sceneDigestBefore);
    expect(SCENE.entities.length).toBe(entityCountBefore);
    // The presented semantic identity is unchanged.
    expect([...three.presentationOf(THREE_SESSION)!.presentedEntityIds].sort()).toEqual(presentedBefore);
    // The fabric holds exactly the sessions it held before the binding.
    expect([...fabric.sessionIds()].sort()).toEqual(sessionsBefore);
    // The snapshot still addresses the same world revision + tenant.
    const snapshot = await fabric.captureSnapshot(THREE_SESSION, CLOCK.snapshotCaptured);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.worldProjection.worldDigest).toBe(SCENE.digest);
    expect(snapshot.value.worldProjection.tenantScope).toEqual({ tenantId: TENANT });
  });
});

// ---------------------------------------------------------------------------
// The sidecar boundary: a lying provider never gets its artifact in.
// ---------------------------------------------------------------------------

describe('the sidecar boundary (negative: boundary failures never leak assets)', () => {
  it('refuses a sidecar whose self-reported digest does not match its bytes — nothing re-enters', async () => {
    // The committed double in 'artifact-lies' mode: the report claims a
    // digest the artifact bytes do not hash to. The boundary RE-COMPUTES
    // and refuses typed — the adapter maps it to a typed session failure
    // (the message carries the digest-mismatch text), no preparation
    // evidence exists, and NO GLB re-enters the bridge.
    const { blender } = await mountedBlender({ BLENDER_DOUBLE_MODE: 'artifact-lies' });
    const session = blender.adapterSessionOf(BLENDER_SESSION);
    expect(session).toBeDefined();

    const prepared = await blender.prepareGltfAsset(session!, { atMs: CLOCK.firstFrame });
    const failure = expectFailure(prepared, 'session-failed');
    expect(failure.message).toContain('digests to');
    expect(failure.message).toContain('the report claimed');

    // No evidence, no bound assets, nothing to re-enter.
    expect(blender.preparationEvidenceOf(BLENDER_SESSION)).toEqual([]);
    expect(blender.boundAssetDigestsOf(BLENDER_SESSION)).toEqual([]);
  });

  it('refuses exports from an unmounted session and never fabricates without a binary', async () => {
    // (a) A mounted-less session (created but not mounted): the export is
    // a typed session failure — never a fabricated GLB. A SECOND session
    // on the SAME adapter+fabric (the first stays mounted).
    const { blender, fabric } = await mountedBlender();
    const unmountedId = 'fx-w060-negative-unmounted';
    const created = await fabric.createSession({
      rendererId: blender.identity().rendererId,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: unmountedId,
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    if (!created.ok) {
      throw new Error(`sidecar session failed: ${created.error.message}`);
    }
    const unmountedSession = blender.adapterSessionOf(unmountedId);
    expect(unmountedSession).toBeDefined();
    const unmountedPrepared = await blender.prepareGltfAsset(unmountedSession!, {
      atMs: CLOCK.firstFrame,
    });
    const unmountedFailure = expectFailure(unmountedPrepared, 'session-failed');
    expect(unmountedFailure.message).toContain('no mounted offscene scene');

    // (b) Without a configured Blender binary the adapter never
    // fabricates: the probe is honestly INCOMPATIBLE and the fabric's
    // session gate refuses typed (never a created-but-broken session).
    const workspace = mkdtempSync(path.join(tmpdir(), 'epoch-w060-no-binary-'));
    workspaces.push(workspace);
    const noBinary = new BlenderSidecarRendererAdapter({ workspaceDir: workspace });
    const { fabric: noBinaryFabric } = buildFabric();
    registerRenderer(noBinaryFabric, noBinary);
    const probed = await noBinaryFabric.probeRenderer(
      noBinary.identity().rendererId,
      DEVICE,
      CLOCK.sessionCreated,
    );
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.compatible).toBe(false);
    expect(probed.value.reason).toContain('no Blender binary configured');
    const refused = await noBinaryFabric.createSession({
      rendererId: noBinary.identity().rendererId,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: 'fx-w060-negative-nobinary',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expectFailure(refused, 'probe-rejected');
  });
});
