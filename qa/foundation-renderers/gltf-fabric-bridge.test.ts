/**
 * THE W060 FOUNDATION & ASSET-BRIDGE BATTERY — POSITIVE: the Work Order
 * acceptance proof, run END-TO-END across the foundation packages.
 *
 * Acceptance (W060): "At least one real external foundation path is
 * exercised end-to-end through the Renderer Fabric, without a separate
 * provider UI, with semantic identity and evidence continuity preserved."
 *
 * The path proven here (every stage REAL product machinery, zero doubles
 * on the engine side — the only double is the Blender CLI itself, in the
 * sidecar round-trip test):
 *
 *   UNTRUSTED glTF/GLB bytes
 *     -> @epoch/adapter-foundation-gltf `admitGltfAsset` (validate +
 *        normalize: the trust gate — malformed input is a typed refusal,
 *        never a parse; the output is the content-addressed neutral
 *        projection)
 *     -> `gltfRendererAssetBinding` (the sealed RendererAssetBinding:
 *        content-addressed assetDigest, tenant-scoped, trust-gated — only
 *        an admission can produce a validated binding)
 *     -> `bindAsset` on the REAL W056 fabric seam with a REAL adapter
 *        session (the REAL Three.js adapter — a real engine behind the
 *        frozen seam, mounted through the REAL RendererFabric over the
 *        SHARED canonical fixture)
 *     -> semantic identity + evidence continuity preserved: the presented
 *        semantic entity ids and the canonical world digest are unchanged
 *        by the binding; the bound-asset ledger is digest-addressed.
 *
 * The Blender sidecar leg proves the full EXTERNAL-FOUNDATION round trip:
 * the canonical world -> the sidecar boundary (the committed Node CLI
 * double standing in for the Blender binary; the real-binary battery is
 * env-gated in the adapter package and honestly NOT-VERIFIED-live) ->
 * exported GLB bytes (UNTRUSTED provider output) -> re-entry through the
 * SAME glTF bridge -> validated binding -> bound on the REAL three.js
 * session. Provider-native files never become Epoch authority.
 *
 * Honest headless scope: everything here runs in Node 22 without a GPU —
 * the validation, normalization, content addressing, fabric admission,
 * session lifecycle, and asset-binding seam are the REAL product path; GL
 * rasterization of the bound mesh is the browser path (W061 closes the
 * E2E loop). Zero wall-clock reads, zero randomness in the assertions —
 * every time is the shared fixture's virtual clock; the only wall-clock
 * values are the sidecar boundary's own typed durationMs evidence.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { canonicalDigest } from '../../packages/agent-protocol/src/index';
import { RendererFabric } from '../../packages/renderer-fabric/src/index';
import {
  admitGltfAsset,
  gltfRendererAssetBinding,
  sha256HexOfBytes,
  type GltfAdmission,
} from '../../adapters/foundations/gltf/src/index';
import { canonicalGlbBytes, canonicalGltfDocumentBytes } from '../../adapters/foundations/gltf/test/helpers';
import { THREE_RENDERER_ID, ThreeJsRendererAdapter } from '../../adapters/renderers/threejs/src/index';
import { BlenderSidecarRendererAdapter } from '../../adapters/renderers/blender/src/index';
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
} from '../renderer-conformance/fixture';

// ---------------------------------------------------------------------------
// Battery helpers (deterministic; the shared fixture provides the world).
// ---------------------------------------------------------------------------

/** The REAL three.js fabric session of this battery (the "fx-" grammar). */
const THREE_SESSION = 'fx-w060-three-gltf';

/** The Blender sidecar fabric session of this battery. */
const BLENDER_SESSION = 'fx-w060-blender-export';

/** The committed Blender CLI double (spawned as a REAL subprocess). */
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

/** Admit the canonical GLB or fail readable (the battery's trust gate). */
function admitted(bytes: Uint8Array): GltfAdmission {
  const admitted = admitGltfAsset(bytes);
  if (!admitted.ok) {
    throw new Error(`fixture admission failed: ${admitted.error.message}`);
  }
  return admitted.value;
}

/** One fabric + the reference renderers + the REAL three.js adapter. */
function buildThreeFabric(
  adapter: ThreeJsRendererAdapter = new ThreeJsRendererAdapter(),
): { readonly fabric: RendererFabric; readonly three: ThreeJsRendererAdapter } {
  const { fabric } = buildFabric();
  registerRenderer(fabric, adapter);
  return { fabric, three: adapter };
}

/** Create + mount one REAL three.js session over the SHARED fixture. */
async function mountThreeSession(
  fabric: RendererFabric,
  fabricSessionId: string,
): Promise<void> {
  const created = await fabric.createSession({
    rendererId: THREE_RENDERER_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`three.js session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`three.js mount failed: ${mounted.error.message}`);
  }
}

// ---------------------------------------------------------------------------
// The end-to-end asset bridge: glTF bytes -> validated binding -> REAL
// three.js adapter session (the W060 acceptance path).
// ---------------------------------------------------------------------------

describe('the glTF→fabric asset bridge (end-to-end, positive)', () => {
  it('admits a real GLB, seals a validated binding, and binds it on a REAL three.js adapter session', async () => {
    // 1. THE ASSET: real glTF 2.0 GLB bytes (UNTRUSTED input).
    const glb = canonicalGlbBytes();

    // 2. THE TRUST GATE: validate + normalize. The admission carries the
    //    neutral, content-addressed projection — nothing downstream parses
    //    glTF again.
    const admission = admitted(glb);
    expect(admission.asset.container).toBe('glb');
    expect(admission.asset.meshCount).toBe(1);
    expect(admission.asset.vertexCount).toBe(3);
    expect(admission.asset.triangleCount).toBe(1);
    // Content addressing: the asset's content address is the SHA-256 of the
    // RAW bytes (exactly what a RendererAssetBinding's assetDigest carries).
    expect(admission.asset.assetBytesDigest).toBe(sha256HexOfBytes(glb));
    expect(admission.asset.byteSize).toBe(glb.length);
    // Determinism: the same bytes admit to the identical projection digest.
    const reAdmitted = admitted(canonicalGlbBytes());
    expect(reAdmitted.asset.projectionDigest).toBe(admission.asset.projectionDigest);
    expect(reAdmitted.asset.assetBytesDigest).toBe(admission.asset.assetBytesDigest);

    // 3. THE BINDING: sealed, tenant-scoped, trust-gated by construction
    //    (only a GltfAdmission — the type just admitGltfAsset produces —
    //    can bind validated).
    const binding = gltfRendererAssetBinding({
      admission,
      bindingId: 'rab-w060-gltf-1',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    expect(binding.schema).toBe('epoch.renderer-asset-binding');
    expect(binding.tenantScope).toEqual({ tenantId: TENANT });
    expect(binding.assetKind).toBe('mesh');
    expect(binding.trustState).toBe('validated');
    expect(binding.validatedAtMs).toBe(CLOCK.firstInput);
    expect(binding.assetDigest).toBe(admission.asset.assetBytesDigest);
    expect(binding.byteSize).toBe(glb.length);
    // Sealed verifiably: the digest is the canonical JSON digest of the content.
    const { digest, ...content } = binding;
    expect(digest).toBe(canonicalDigest(content));

    // 4. THE REAL FABRIC SEAM + A REAL ENGINE SESSION: the three.js adapter
    //    registered through the REAL capability registry, the session
    //    created and the canonical projection mounted through the REAL
    //    W013 admission boundary.
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, THREE_SESSION);
    const session = three.adapterSessionOf(THREE_SESSION);
    expect(session).toBeDefined();

    // 5. THE PRE-BIND EVIDENCE (the continuity baseline).
    const presentedBefore = three.presentationOf(THREE_SESSION)!.presentedEntityIds;
    expect(presentedBefore.length).toBeGreaterThan(0);

    // 6. bindAsset ON THE REAL SEAM: the validated, digest-addressed record
    //    crosses the adapter seam (never an untyped byte stream).
    const bound = await three.bindAsset!(session!, binding);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.bound).toBe(true);

    // 7. SEMANTIC IDENTITY PRESERVED: the presented semantic entity ids are
    //    unchanged — an asset binding is presentation-scoped, never a
    //    semantic write.
    const presentedAfter = three.presentationOf(THREE_SESSION)!.presentedEntityIds;
    expect([...presentedAfter].sort()).toEqual([...presentedBefore].sort());

    // 8. THE BOUND-ASSET LEDGER IS DIGEST-ADDRESSED: the adapter tracks the
    //    asset by its content address, not by pointer or filename.
    const runtime = three.runtimeStateOf(THREE_SESSION)!;
    expect([...runtime.boundAssets.keys()]).toEqual([binding.assetDigest]);
    expect(runtime.boundAssets.get(binding.assetDigest)).toBe('mesh');

    // 9. EVIDENCE CONTINUITY: the canonical world digest survives the
    //    binding (the snapshot still addresses the mounted world revision).
    const snapshot = await fabric.captureSnapshot(THREE_SESSION, CLOCK.snapshotCaptured);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.worldProjection.worldDigest).toBe(SCENE.digest);
    expect(snapshot.value.worldProjection.tenantScope).toEqual({ tenantId: TENANT });
  });

  it('takes the same path for a .gltf JSON document (data-URI buffer): container-agnostic admission', () => {
    // The bridge validates BOTH glTF containers: binary GLB and JSON .gltf
    // with an embedded data-URI buffer (external resource URIs are a typed
    // refusal — acquisition is the host's concern; the negative battery
    // proves that side).
    const json = canonicalGltfDocumentBytes();
    const admission = admitted(json);
    expect(admission.asset.container).toBe('gltf');
    expect(admission.asset.triangleCount).toBe(1);
    expect(admission.asset.assetBytesDigest).toBe(sha256HexOfBytes(json));

    // The SAME validated binding path: the projection is the only thing
    // Epoch adopts, and its content address is the raw-byte digest.
    const binding = gltfRendererAssetBinding({
      admission,
      bindingId: 'rab-w060-gltf-json-1',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    expect(binding.trustState).toBe('validated');
    expect(binding.assetDigest).toBe(admission.asset.assetBytesDigest);
  });

  it('content-addresses assets: different bytes -> different digests; byte-identical -> identical', () => {
    const glb = canonicalGlbBytes();
    const tampered = new Uint8Array(glb);
    // Flip one byte inside the BIN chunk (a vertex component): the document
    // still validates, but its content address changes — tamper evidence.
    tampered[glb.length - 4] ^= 0x01;
    const first = admitted(glb);
    const second = admitted(tampered);
    expect(first.asset.assetBytesDigest).not.toBe(second.asset.assetBytesDigest);
    // The projection digest changes too (the geometry facts moved).
    expect(first.asset.projectionDigest).not.toBe(second.asset.projectionDigest);
    // Byte-identical inputs trivially agree on both digests.
    expect(admitted(glb).asset.assetBytesDigest).toBe(first.asset.assetBytesDigest);
  });
});

// ---------------------------------------------------------------------------
// The EXTERNAL-FOUNDATION round trip: the Blender sidecar export re-enters
// through the glTF bridge before anything binds (provider-native files
// never become Epoch authority).
// ---------------------------------------------------------------------------

describe('the Blender sidecar round trip (canonical world → GLB → bridge → binding)', () => {
  it('exports the mounted world through the REAL process boundary and re-admits the GLB as UNTRUSTED bytes', async () => {
    // The sidecar adapter over the committed CLI double: a REAL subprocess
    // boundary (argv-array spawn, timeouts, byte caps, digest-verified
    // artifacts) — only the Blender binary itself is doubled. The
    // real-binary battery is env-gated (EPOCH_BLENDER_PATH +
    // EPOCH_BLENDER_LIVE=1) and honestly NOT-VERIFIED-live.
    const workspace = mkdtempSync(path.join(tmpdir(), 'epoch-w060-blender-'));
    workspaces.push(workspace);
    const blender = new BlenderSidecarRendererAdapter({
      blenderPath: process.execPath,
      argvPrefix: [DOUBLE],
      workspaceDir: workspace,
    });

    // The sidecar session is mounted through the REAL fabric over the SAME
    // shared canonical fixture (semantic identity by reference).
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
    expect(blender.presentedEntityIdsOf(BLENDER_SESSION).length).toBeGreaterThan(0);

    // 1. THE EXPORT: the sidecar writes a GLB through the typed boundary;
    //    the boundary RE-COMPUTES the artifact digest (the provider's
    //    self-report is never trusted).
    const sidecarSession = blender.adapterSessionOf(BLENDER_SESSION);
    expect(sidecarSession).toBeDefined();
    const prepared = await blender.prepareGltfAsset(sidecarSession!, { atMs: CLOCK.firstFrame });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.glbDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(prepared.value.glbBytes).toBe(prepared.value.glbBytesData.length);

    // 2. THE RE-ENTRY (the security invariant): the exported GLB is
    //    UNTRUSTED provider output — it re-enters through the SAME glTF
    //    bridge (validate + normalize) before anything binds anywhere.
    const admission = admitGltfAsset(prepared.value.glbBytesData);
    expect(admission.ok).toBe(true);
    if (!admission.ok) return;
    expect(admission.value.asset.container).toBe('glb');
    expect(admission.value.asset.triangleCount).toBeGreaterThan(0);

    // 3. EVIDENCE CONTINUITY ACROSS THE PROCESS SEAM: the content address
    //    the BRIDGE computed over the re-entered bytes equals the digest
    //    the BOUNDARY verified — the bytes that left the sidecar are
    //    byte-for-byte the bytes Epoch validated.
    expect(admission.value.asset.assetBytesDigest).toBe(prepared.value.glbDigest);

    // 4. THE VALIDATED BINDING (tenant-scoped, digest-addressed).
    const binding = gltfRendererAssetBinding({
      admission: admission.value,
      bindingId: 'rab-w060-blender-export-1',
      fabricSessionId: THREE_SESSION,
      tenantScope: { tenantId: TENANT },
      boundAtMs: CLOCK.firstInput,
    });
    expect(binding.trustState).toBe('validated');
    expect(binding.assetDigest).toBe(prepared.value.glbDigest);

    // 5. BIND ON THE REAL THREE.JS SEAM: the prepared asset mounts on a
    //    REAL engine session (the W060 acceptance — an external foundation
    //    path exercised end-to-end through the fabric, no provider UI).
    const { fabric: threeFabric, three } = buildThreeFabric();
    await mountThreeSession(threeFabric, THREE_SESSION);
    const threeSession = three.adapterSessionOf(THREE_SESSION);
    expect(threeSession).toBeDefined();
    const bound = await three.bindAsset!(threeSession!, binding);
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.bound).toBe(true);
    expect([...three.runtimeStateOf(THREE_SESSION)!.boundAssets.keys()]).toEqual([
      binding.assetDigest,
    ]);

    // 6. AND ON THE SIDECAR SESSION ITSELF (the batch renderer binds mesh
    //    assets too): the export re-enters and binds back at the source.
    const reBound = await blender.bindAsset(sidecarSession!, binding);
    expect(reBound.ok).toBe(true);
    if (!reBound.ok) return;
    expect(reBound.value.bound).toBe(true);
    expect(blender.boundAssetDigestsOf(BLENDER_SESSION)).toEqual([binding.assetDigest]);

    // The preparation evidence records the bound digests at export time
    // (empty then — the binding happened after the export; evidence, not
    // authority).
    expect(prepared.value.boundAssetDigests).toEqual([]);
  });

  it('keeps the boundary evidence digest-addressed across repeated exports (deterministic double)', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'epoch-w060-blender-'));
    workspaces.push(workspace);
    const blender = new BlenderSidecarRendererAdapter({
      blenderPath: process.execPath,
      argvPrefix: [DOUBLE],
      workspaceDir: workspace,
    });
    const { fabric } = buildFabric();
    registerRenderer(fabric, blender);
    const created = await fabric.createSession({
      rendererId: blender.identity().rendererId,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: 'fx-w060-blender-repeat',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    if (!created.ok) {
      throw new Error(`sidecar session failed: ${created.error.message}`);
    }
    const mounted = await fabric.mountScene('fx-w060-blender-repeat', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    if (!mounted.ok) {
      throw new Error(`sidecar mount failed: ${mounted.error.message}`);
    }
    const session = blender.adapterSessionOf('fx-w060-blender-repeat');
    expect(session).toBeDefined();

    const first = await blender.prepareGltfAsset(session!, { atMs: CLOCK.firstFrame });
    const second = await blender.prepareGltfAsset(session!, { atMs: CLOCK.secondInput });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Every export is digest-addressed; the committed double is
    // deterministic, so the same mounted scene exports the same GLB bytes
    // (the REAL Blender binary is not deterministic across machines — its
    // battery is env-gated and makes no such claim).
    expect(second.value.glbDigest).toBe(first.value.glbDigest);
    // Both exports independently re-enter and validate.
    const readmitted = admitGltfAsset(second.value.glbBytesData);
    expect(readmitted.ok).toBe(true);
    if (!readmitted.ok) return;
    expect(readmitted.value.asset.assetBytesDigest).toBe(second.value.glbDigest);
    // The evidence ledger carries one entry per export.
    expect(blender.preparationEvidenceOf('fx-w060-blender-repeat')).toHaveLength(2);
  });
});
