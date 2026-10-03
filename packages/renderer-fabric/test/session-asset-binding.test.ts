/**
 * THE W065 SESSION-ASSET-BINDING BATTERY (ACR-010) — the deterministic
 * proof of the contract-v1.2.0 fabric-level operation
 * (`RendererFabric.bindSessionAsset`) over the contract-only REFERENCE
 * adapter, plus every typed refusal path.
 *
 * What this battery proves (the W065 work-order acceptance):
 * - the POSITIVE path: a validated, tenant-scoped, declared-kind sealed
 *   binding binds through the REAL fabric operation (session resolution →
 *   tenant verification → capability/asset-kind check → the UNCHANGED
 *   adapter-seam `bindAsset` application) and yields the sealed,
 *   digest-addressed, tenant-scoped `RendererAssetBindingReceipt` —
 *   content-addressed by the sealed binding's digest, carrying the
 *   adapter's rendererId and the applied/declined outcome;
 * - the DECLINED path: an adapter soft-decline (bound: false) is a typed
 *   `declined` receipt, never a failure;
 * - EVERY negative path refuses typed (never a raw throw, no partial
 *   application): unknown session, disposed session, malformed sealed
 *   binding, binding/session mismatch, tenant-scope mismatch, undeclared
 *   asset kind, absent optional seam, adapter refusal (the seam's trust
 *   gate refusing an untrusted binding — propagated VERBATIM);
 * - binding is PRESENTATION, never semantics: the sealed session record is
 *   unchanged by bindings and refusals alike (no W013 invocation is
 *   admitted — there is no hosting-surface invocation kind for asset
 *   binding; the operation is fabric-level by design);
 * - determinism: identical inputs produce byte-identical receipts (zero
 *   wall-clock, zero randomness — every time is the fixture's virtual
 *   clock).
 *
 * Honest scope: the reference adapter is the contract-only seam template
 * (zero engines — its "presentation" is a typed in-memory index); the
 * REAL-adapter session-level proof (Three.js/Babylon.js) rides the
 * qa/foundation-renderers composition, which lives outside W065's owned
 * surfaces, and the in-page host path is W067's. The engine adapters'
 * `bindAsset` implementations are exercised by their OWN batteries and by
 * qa/foundation-renderers; what is pinned HERE is the fabric orchestration
 * around the seam — over the same seam every real adapter implements.
 */
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import {
  sealRendererAssetBinding,
  type DeviceSessionSnapshot,
  type PortableViewState,
  type RendererAssetBinding,
  type RendererAssetBindingContent,
  type RendererCapabilitySet,
  type RendererDescriptor,
  type RendererFrameEnvelope,
  type RendererInputEnvelope,
} from '@epoch/renderer-runtime';
import {
  admitWorldScene,
  registerOntologyRecords,
  sealWorldSceneContent,
  type WorldOntology,
  type WorldOntologyRecord,
  type WorldScene,
  type WorldSceneContent,
} from '@epoch/world-experience';
import {
  ReferenceRendererAdapter,
  RendererFabric,
  RendererAssetBindingReceiptContentSchema,
  rendererCapabilityManifestOf,
  sealRendererAssetBindingReceipt,
  type RendererAdapter,
  type RendererAdapterSession,
  type RendererAssetBindingReceiptContent,
  type RendererMountInput,
  type RendererProbeInput,
  type RendererSessionContext,
  type RendererSnapshotCaptureInput,
  type ReferenceRendererAdapterOptions,
} from '../src/index';

// ---------------------------------------------------------------------------
// Battery helpers (deterministic; a minimal self-contained fixture — the
// shared conformance fixture lives outside this package and cannot be
// imported from a workspace package without a new dependency edge).
// ---------------------------------------------------------------------------

/** The tenant the fixture world and bindings belong to. */
const TENANT = 'tenant-w065-asset';

/** A second tenant (the cross-tenant negative path only). */
const TENANT_OTHER = 'tenant-w065-foreign';

/** The full renderer id (declares material/mesh/texture asset kinds). */
const FULL_RENDERER_ID = 'rr-w065-full';

/** The no-asset-kinds renderer id (the zero-declaration negative path). */
const BARE_RENDERER_ID = 'rr-w065-bare';

/** The fabric session of this battery (the "fx-" grammar). */
const SESSION = 'fx-w065-asset-1';

/** The shared virtual clock (fixed, deterministic). */
const CLOCK = {
  created: 1_000,
  mounted: 2_000,
  validated: 2_500,
  bound: 3_000,
  boundAgain: 3_500,
  disposed: 4_000,
} as const;

/** A deterministic desktop device session for the fixture tenant. */
const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-w065-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: {
      poseTracking: 'none',
      worldAnchored: false,
      maxTriangles: 1_000_000,
      maxTextureBytes: 268_435_456,
    },
  },
};

const ONTOLOGY_RECORDS: WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-w065-rep-box',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-w065' },
    appliesTo: ['w065:structure'],
    primitive: 'box',
  },
];

const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, ONTOLOGY_RECORDS);
  if (!registered.ok) {
    throw new Error(`fixture ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

const SCENE_CONTENT: WorldSceneContent = {
  schema: 'epoch.world-scene',
  protocolVersion: '1.0.0',
  sceneId: 'wsc-w065-asset-1',
  tenantScope: { tenantId: TENANT },
  name: 'W065 Asset-Binding Fixture World',
  entities: [
    {
      entityId: 'we-w065-alpha',
      contentDigest: 'aa'.repeat(32),
      entityType: 'w065:structure',
      representationRecordId: 'ont-w065-rep-box',
      label: 'Fixture slab',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
  ],
  focusedEntityIds: [],
  overlays: [],
  appliedOverlays: [],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [],
    trackLabel: 'W065 fixture track',
    trackStartMs: 0,
    trackEndMs: 1_000,
    position: { atMs: 0, frameIndex: 0, paused: true },
  },
  camera: { mode: 'orbit', position: [12, 9, 12], target: [0, 0, 0] },
  participants: [],
  agents: [],
  evidenceReferences: [],
  controls: [],
};

/** The canonical fixture scene (admitted + sealed through the REAL W016 total admission). */
const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`fixture scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The canonical world projection reference (identity continuity triple). */
const WORLD_PROJECTION = {
  sceneId: SCENE.sceneId,
  worldDigest: SCENE.digest,
  tenantScope: SCENE.tenantScope,
};

const DESCRIPTOR: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: FULL_RENDERER_ID,
  graphKinds: ['2d', '3d', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 1_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/** The full renderer's capability set (binds material/mesh/texture assets). */
const CAPABILITIES_FULL: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: FULL_RENDERER_ID,
  hitTesting: true,
  measurement: true,
  annotation: false,
  frameCapture: false,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['material', 'mesh', 'texture'],
};

/** A zero-asset-declaration capability set (same renderer identity shape). */
const CAPABILITIES_BARE: RendererCapabilitySet = {
  ...CAPABILITIES_FULL,
  rendererId: BARE_RENDERER_ID,
  assetKinds: [],
};

function fullRendererOptions(): ReferenceRendererAdapterOptions {
  return {
    identity: {
      capabilityId: 'epoch.renderer.w065-full',
      rendererId: FULL_RENDERER_ID,
      displayName: 'W065 Full Renderer (reference)',
      description: 'Contract-only reference renderer: asset-binding capable.',
    },
    descriptor: DESCRIPTOR,
    capabilities: CAPABILITIES_FULL,
  };
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
    description: identity.description,
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

/** Build the standard battery fabric (the full reference renderer registered). */
function buildFabric(): { readonly fabric: RendererFabric; readonly full: ReferenceRendererAdapter } {
  const fabric = new RendererFabric();
  const full = new ReferenceRendererAdapter(fullRendererOptions());
  registerRenderer(fabric, full);
  return { fabric, full };
}

/** Create + mount the full renderer session (the standard flow). */
async function mountSession(fabric: RendererFabric, sessionId = SESSION): Promise<void> {
  const created = await fabric.createSession({
    rendererId: FULL_RENDERER_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    fabricSessionId: sessionId,
    atMs: CLOCK.created,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`fixture session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(sessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.mounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`fixture mount failed: ${mounted.error.message}`);
  }
}

/** Build one sealed asset-binding content with overrides. */
function bindingContent(overrides?: Partial<RendererAssetBindingContent>): RendererAssetBindingContent {
  return {
    schema: 'epoch.renderer-asset-binding',
    fabricProtocolVersion: '1.0.0',
    bindingId: 'rab-w065-1',
    fabricSessionId: SESSION,
    tenantScope: { tenantId: TENANT },
    assetDigest: 'bb'.repeat(32),
    assetKind: 'mesh',
    byteSize: 1_024,
    trustState: 'validated',
    validatedAtMs: CLOCK.validated,
    boundAtMs: CLOCK.validated,
    ...overrides,
  };
}

/** One VALIDATED mesh binding sealed for the battery session + tenant. */
function validatedBinding(overrides?: Partial<RendererAssetBindingContent>): RendererAssetBinding {
  return sealRendererAssetBinding(bindingContent(overrides));
}

/**
 * An adapter implementing the seam EXCEPT `bindAsset` (the optional seam
 * deliberately ABSENT — the W065 absent-seam negative path). Delegates
 * everything to a contract-only reference instance.
 */
class SeamAbsentRendererAdapter implements RendererAdapter {
  private readonly delegate: ReferenceRendererAdapter;

  constructor(delegate: ReferenceRendererAdapter) {
    this.delegate = delegate;
  }

  identity() {
    return this.delegate.identity();
  }
  descriptor() {
    return this.delegate.descriptor();
  }
  capabilities() {
    return this.delegate.capabilities();
  }
  probe(input: RendererProbeInput) {
    return this.delegate.probe(input);
  }
  createSession(context: RendererSessionContext) {
    return this.delegate.createSession(context);
  }
  mountProjection(session: RendererAdapterSession, input: RendererMountInput) {
    return this.delegate.mountProjection(session, input);
  }
  applyFrame(session: RendererAdapterSession, envelope: RendererFrameEnvelope) {
    return this.delegate.applyFrame(session, envelope);
  }
  translateInput(session: RendererAdapterSession, input: RendererInputEnvelope) {
    return this.delegate.translateInput(session, input);
  }
  captureSnapshot(session: RendererAdapterSession, input: RendererSnapshotCaptureInput) {
    return this.delegate.captureSnapshot(session, input);
  }
  restoreViewState(session: RendererAdapterSession, viewState: PortableViewState) {
    return this.delegate.restoreViewState(session, viewState);
  }
  // bindAsset: deliberately NOT implemented (the optional seam is absent).
  dispose(session: RendererAdapterSession) {
    return this.delegate.dispose(session);
  }
  health(session: RendererAdapterSession, atMs: number) {
    return this.delegate.health(session, atMs);
  }
}

/** An adapter whose seam SOFT-DECLINES every binding (bound: false, never a failure). */
class DecliningRendererAdapter extends ReferenceRendererAdapter {
  override async bindAsset(): Promise<{ ok: true; value: { bound: boolean } }> {
    return { ok: true, value: { bound: false } };
  }
}

// ---------------------------------------------------------------------------
// The positive path (deterministic, over the reference adapter).
// ---------------------------------------------------------------------------

describe('the W065 bindSessionAsset operation (positive, over the reference adapter)', () => {
  it('binds a validated, tenant-scoped, declared-kind asset and seals the digest-addressed receipt', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const binding = validatedBinding();

    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding,
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;

    const receipt = bound.value;
    expect(receipt.schema).toBe('epoch.renderer-asset-binding-receipt');
    expect(receipt.fabricProtocolVersion).toBe('1.0.0');
    expect(receipt.fabricSessionId).toBe(SESSION);
    expect(receipt.rendererId).toBe(FULL_RENDERER_ID);
    expect(receipt.tenantScope).toEqual({ tenantId: TENANT });
    expect(receipt.bindingId).toBe(binding.bindingId);
    // Content addressing: the receipt addresses the SEALED BINDING by its digest.
    expect(receipt.bindingDigest).toBe(binding.digest);
    expect(receipt.assetDigest).toBe(binding.assetDigest);
    expect(receipt.assetKind).toBe('mesh');
    expect(receipt.outcome).toBe('applied');
    expect(receipt.reason).toBeUndefined();
    expect(receipt.atMs).toBe(CLOCK.bound);
    // Sealed verifiably: the digest is the canonical JSON digest of the content.
    const { digest, ...content } = receipt;
    expect(digest).toBe(canonicalDigest(content));
    // The receipt round-trips its contract schema.
    expect(RendererAssetBindingReceiptContentSchema.safeParse(content).success).toBe(true);
  });

  it('is deterministic: identical inputs produce byte-identical receipts; different assets produce distinct ones', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const binding = validatedBinding();

    const first = await fabric.bindSessionAsset({ sessionId: SESSION, binding, atMs: CLOCK.bound });
    const second = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding,
      atMs: CLOCK.bound,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(second.value.digest).toBe(first.value.digest);

    // A different asset (different content address) yields a distinct receipt.
    const other = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding({
        bindingId: 'rab-w065-2',
        assetDigest: 'cc'.repeat(32),
        byteSize: 2_048,
      }),
      atMs: CLOCK.bound,
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.value.bindingDigest).not.toBe(first.value.bindingDigest);
    expect(other.value.assetDigest).toBe('cc'.repeat(32));
  });

  it('is presentation, never semantics: the sealed session record is unchanged by the binding', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const before = fabric.session(SESSION);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding(),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(true);

    const after = fabric.session(SESSION);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    // The sealed record is byte-identical: no state transition, no invocation
    // count bump (no W013 invocation is admitted — asset binding is
    // fabric-level orchestration, not a hosting-surface invocation).
    expect(after.value).toEqual(before.value);
    expect(after.value.digest).toBe(before.value.digest);
    expect(after.value.state).toBe('active');
    expect(after.value.invocationCount).toBe(before.value.invocationCount);
    // The canonical world digest survives the binding (continuity anchor).
    expect(after.value.worldProjection.worldDigest).toBe(SCENE.digest);
  });

  it('records the declined outcome when the adapter soft-declines (bound: false — never a failure)', async () => {
    const fabric = new RendererFabric();
    const declining = new DecliningRendererAdapter(fullRendererOptions());
    registerRenderer(fabric, declining);
    await mountSession(fabric);

    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding(),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.outcome).toBe('declined');
    expect(bound.value.reason).toBe('adapter-declined');
    expect(bound.value.bindingDigest).toBe(validatedBinding().digest);
    // The declined receipt still round-trips its contract schema.
    const { digest, ...content } = bound.value;
    expect(digest).toBe(canonicalDigest(content));
    expect(RendererAssetBindingReceiptContentSchema.safeParse(content).success).toBe(true);
    // And the session stays healthy and unchanged.
    const record = fabric.session(SESSION);
    expect(record.ok).toBe(true);
    if (record.ok) {
      expect(record.value.state).toBe('active');
    }
  });
});

// ---------------------------------------------------------------------------
// The typed refusal paths (every negative path; never a raw throw, no
// partial application).
// ---------------------------------------------------------------------------

describe('the W065 bindSessionAsset typed refusals (negative)', () => {
  it('unknown session → typed unknown-session', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const bound = await fabric.bindSessionAsset({
      sessionId: 'fx-w065-nonexistent',
      binding: validatedBinding({ fabricSessionId: 'fx-w065-nonexistent' }),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('unknown-session');
    expect(bound.error).toMatchObject({ encounteredFabricSessionId: 'fx-w065-nonexistent' });
  });

  it('disposed session → typed session-disposed', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const disposed = await fabric.disposeSession(SESSION, CLOCK.disposed);
    expect(disposed.ok).toBe(true);

    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding(),
      atMs: CLOCK.disposed + 1,
    });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('session-disposed');
    expect(bound.error).toMatchObject({ fabricSessionId: SESSION });
  });

  it('malformed sealed binding → typed invalid-fabric-record (schema validation, never a raw throw)', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    // A "validated" binding without its validation time fails the sealed
    // record's consistency refinement.
    const malformed = {
      ...bindingContent(),
      validatedAtMs: undefined,
    } as unknown as RendererAssetBinding;

    const bound = await fabric.bindSessionAsset({ sessionId: SESSION, binding: malformed, atMs: CLOCK.bound });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('invalid-fabric-record');
    if (bound.error.code !== 'invalid-fabric-record') return;
    expect(bound.error.issues.length).toBeGreaterThan(0);
    expect(bound.error.issues.some((issue) => issue.path.startsWith('binding'))).toBe(true);
  });

  it('binding/session mismatch → typed invalid-fabric-record (the sealed binding addresses THIS session)', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding({ fabricSessionId: 'fx-w065-other-session' }),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('invalid-fabric-record');
    if (bound.error.code !== 'invalid-fabric-record') return;
    expect(bound.error.issues).toContainEqual({
      path: 'binding.fabricSessionId',
      message: `expected "${SESSION}"`,
    });
  });

  it('tenant-scope mismatch → typed cross-tenant-denied (R12)', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding({ tenantScope: { tenantId: TENANT_OTHER } }),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('cross-tenant-denied');
    expect(bound.error).toMatchObject({
      expectedTenantId: TENANT,
      encounteredTenantId: TENANT_OTHER,
    });
  });

  it('undeclared asset kind → typed asset-rejected (the W008 permission pattern)', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const binding = validatedBinding({ assetKind: 'animation' });

    const bound = await fabric.bindSessionAsset({ sessionId: SESSION, binding, atMs: CLOCK.bound });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('asset-rejected');
    expect(bound.error).toMatchObject({
      assetDigest: binding.assetDigest,
      reason: 'undeclared asset kind',
    });

    // The zero-declaration renderer refuses the same way for EVERY kind.
    const bareFabric = new RendererFabric();
    registerRenderer(
      bareFabric,
      new ReferenceRendererAdapter({
        identity: {
          capabilityId: 'epoch.renderer.w065-bare',
          rendererId: BARE_RENDERER_ID,
          displayName: 'W065 Bare Renderer (reference)',
          description: 'Contract-only reference renderer: zero asset-kind declarations.',
        },
        descriptor: { ...DESCRIPTOR, rendererId: BARE_RENDERER_ID },
        capabilities: CAPABILITIES_BARE,
      }),
    );
    const created = await bareFabric.createSession({
      rendererId: BARE_RENDERER_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: SESSION,
      atMs: CLOCK.created,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const mesh = validatedBinding();
    const refused = await bareFabric.bindSessionAsset({
      sessionId: SESSION,
      binding: mesh,
      atMs: CLOCK.bound,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('asset-rejected');
    expect(refused.error).toMatchObject({
      assetDigest: mesh.assetDigest,
      reason: 'undeclared asset kind',
    });
  });

  it('absent optional seam → typed adapter-unavailable (never a silent no-op)', async () => {
    const fabric = new RendererFabric();
    registerRenderer(fabric, new SeamAbsentRendererAdapter(new ReferenceRendererAdapter(fullRendererOptions())));
    await mountSession(fabric);

    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding(),
      atMs: CLOCK.bound,
    });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error.code).toBe('adapter-unavailable');
    expect(bound.error).toMatchObject({
      rendererId: FULL_RENDERER_ID,
      reason: 'optional seam absent',
    });
  });

  it('adapter refusal propagates VERBATIM (the seam trust gate: untrusted assets never mount)', async () => {
    const { fabric, full } = buildFabric();
    await mountSession(fabric);
    const untrusted = sealRendererAssetBinding({
      ...bindingContent(),
      trustState: 'untrusted',
      validatedAtMs: undefined,
    });

    // The seam's own refusal, called directly, is the exact failure the
    // fabric must propagate (adapters are never re-trusted or re-wrapped).
    const adapterSession = full.adapterSessionOf(SESSION);
    expect(adapterSession).toBeDefined();
    const direct = await full.bindAsset!(adapterSession!, untrusted);
    expect(direct.ok).toBe(false);
    if (direct.ok) return;

    const bound = await fabric.bindSessionAsset({ sessionId: SESSION, binding: untrusted, atMs: CLOCK.bound });
    expect(bound.ok).toBe(false);
    if (bound.ok) return;
    expect(bound.error).toEqual(direct.error);
    expect(bound.error.code).toBe('asset-rejected');
    expect(bound.error).toMatchObject({
      assetDigest: untrusted.assetDigest,
      reason: 'untrusted',
    });
  });

  it('no partial application: after a refusal the session record is unchanged and a valid bind still succeeds', async () => {
    const { fabric } = buildFabric();
    await mountSession(fabric);
    const before = fabric.session(SESSION);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    // A refused binding (tenant mismatch)...
    const refused = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding({ tenantScope: { tenantId: TENANT_OTHER } }),
      atMs: CLOCK.bound,
    });
    expect(refused.ok).toBe(false);

    // ...leaves the session record byte-identical...
    const after = fabric.session(SESSION);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value).toEqual(before.value);

    // ...and does not poison the session: the valid binding still applies.
    const bound = await fabric.bindSessionAsset({
      sessionId: SESSION,
      binding: validatedBinding(),
      atMs: CLOCK.boundAgain,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.outcome).toBe('applied');
  });
});

// ---------------------------------------------------------------------------
// The receipt document schema (the contract v1.2.0 document — the
// consistency corpus).
// ---------------------------------------------------------------------------

describe('the RendererAssetBindingReceipt document (contract v1.2.0)', () => {
  const appliedContent: RendererAssetBindingReceiptContent = {
    schema: 'epoch.renderer-asset-binding-receipt',
    fabricProtocolVersion: '1.0.0',
    fabricSessionId: SESSION,
    rendererId: FULL_RENDERER_ID,
    tenantScope: { tenantId: TENANT },
    bindingId: 'rab-w065-1',
    bindingDigest: 'dd'.repeat(32),
    assetDigest: 'bb'.repeat(32),
    assetKind: 'mesh',
    outcome: 'applied',
    atMs: CLOCK.bound,
  };

  it('accepts the applied and declined shapes and rejects inconsistent or foreign ones', () => {
    // Applied (no reason) and declined (with reason) are the two legal shapes.
    expect(RendererAssetBindingReceiptContentSchema.safeParse(appliedContent).success).toBe(true);
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        outcome: 'declined',
        reason: 'adapter-declined',
      }).success,
    ).toBe(true);

    // Consistency: applied carries no reason; declined carries one.
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        reason: 'stray reason',
      }).success,
    ).toBe(false);
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        outcome: 'declined',
      }).success,
    ).toBe(false);

    // Closed vocabulary + strict object: unknown outcome/kind/schema/field refuse.
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        outcome: 'maybe',
      }).success,
    ).toBe(false);
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        assetKind: 'shader-pack',
      }).success,
    ).toBe(false);
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        schema: 'epoch.vendor-receipt',
      }).success,
    ).toBe(false);
    expect(
      RendererAssetBindingReceiptContentSchema.safeParse({
        ...appliedContent,
        engineField: true,
      }).success,
    ).toBe(false);
  });

  it('seals deterministically (the canonical-JSON digest of the content)', () => {
    const declined = {
      ...appliedContent,
      outcome: 'declined' as const,
      reason: 'adapter-declined',
    };
    const first = sealRendererAssetBindingReceipt(declined);
    const second = sealRendererAssetBindingReceipt(declined);
    expect(first.digest).toBe(second.digest);
    const { digest, ...content } = first;
    expect(digest).toBe(canonicalDigest(content));
  });
});
