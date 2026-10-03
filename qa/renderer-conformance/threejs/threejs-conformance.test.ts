/**
 * THE W058 THREE.JS RENDERER CONFORMANCE BATTERY — POSITIVE: the Work
 * Order acceptance proof, run end-to-end over the SAME shared canonical
 * fixture as the W056 harness.
 *
 * Acceptance (W058): "The real Three.js viewport renders the shared
 * canonical fixture and produces normalized Epoch world interaction
 * intents."
 *
 * What makes this a REAL renderer conformance run (not a unit suite):
 * - the renderer is the REAL `@epoch/adapter-renderer-threejs` — a real
 *   Three.js scene graph, a real Raycaster, real camera math — mounted
 *   behind the FROZEN W056 `RendererAdapter` seam through the REAL
 *   capability registry and the REAL W013 admission boundary;
 * - the world is the SHARED canonical fixture (the same tenant, the same
 *   scene digest, the same semantic entity ids as every other conformant
 *   renderer — `../fixture.ts`);
 * - every interaction is normalized into the EXISTING typed W016
 *   world-interaction intent vocabulary and re-admitted through the REAL
 *   W016 admission + W013 submit-intent boundary (the Dynamic UI law:
 *   adapters are never trusted);
 * - the equivalence basis against the contract-only reference renderer is
 *   the INTENT PAYLOAD (kind + target + caller-scoped intentId): the same
 *   logical interaction over the same canonical world produces the
 *   identical content-addressed intent payload digest on both renderers.
 *
 * Honest headless scope: everything here runs in Node 22 without a GPU —
 * the scene graph, camera math, Raycaster hit-testing, normalization,
 * degradation, snapshot/restore, and disposal are the REAL product path;
 * GL rasterization and frame-image capture require the injected surface
 * (the browser path; W061 closes the E2E loop). Zero wall-clock, zero
 * randomness — the run is byte-reproducible.
 */
import { describe, expect, it } from 'vitest';
import { canonicalDigest, type JsonValue } from '../../../packages/agent-protocol/src/index';
import {
  RendererConformanceResultContentSchema,
  type PortableViewState,
  type RendererConformanceCheck,
  type RendererConformanceResultContent,
  type RendererIntentReceipt,
  type RendererSession,
} from '../../../packages/renderer-runtime/src/index';
import { RendererFabric } from '../../../packages/renderer-fabric/src/index';
import {
  applyWorldIntent,
  createWorldScene,
  emptyWorldSceneStore,
} from '../../../packages/world-experience/src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  PRESENTED_ENTITY_IDS,
  RENDERER_A_ID,
  SCENE,
  SCENE_ID,
  TENANT,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  hitEntityOf,
  mountFullSession,
  pointerDown,
  registerRenderer,
  sessionStateOf,
  wheelInput,
} from '../fixture';
import {
  FULL_FIDELITY_SEGMENTS,
  PRESENTATION_DEFAULT_COLOR,
  REDUCED_FIDELITY_SEGMENTS,
  SEMANTIC_ENTITY_KEY,
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  countSemanticEntityNodes,
  isEntityVisible,
  isWireframe,
  materialColorOf,
  projectedPointerOf,
  type ThreePresentation,
} from '../../../adapters/renderers/threejs/src/index';

// ---------------------------------------------------------------------------
// Battery helpers (deterministic; the shared fixture provides the world).
// ---------------------------------------------------------------------------

/** The three.js fabric session ids of this battery (the "fx-" grammar). */
const THREE_SESSION = 'fx-w058-three-1';

/** Build one pointer-down envelope at an exact (x, y) normalized position. */
function pointerDownAt(
  fabricSessionId: string,
  inputId: string,
  x: number,
  y: number,
  atMs: number,
  intentHint?: { id: string; version: string },
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer',
    inputKind: 'pointer-down',
    pointer: { x, y },
    ...(intentHint !== undefined ? { intentHint: { intent: intentHint } } : {}),
  };
}

/** Build one key-down envelope (the W056 grammar). */
function keyDownAt(
  fabricSessionId: string,
  inputId: string,
  key: string,
  atMs: number,
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs,
    modality: 'keyboard',
    inputKind: 'key-down',
    key: { key, modifiers: [] },
  };
}

/** Narrow a portable camera to its orbit member (readable failures otherwise). */
function orbitOf(camera: PortableViewState['camera']): Extract<NonNullable<PortableViewState['camera']>, { mode: 'orbit' }> {
  if (camera === undefined || camera.mode !== 'orbit') {
    throw new Error(`expected an orbit portable camera, got mode "${camera?.mode ?? 'none'}"`);
  }
  return camera;
}

/** One fabric + the reference renderer(s) + the REAL three.js adapter. */
function buildThreeFabric(
  adapter: ThreeJsRendererAdapter = new ThreeJsRendererAdapter(),
): { readonly fabric: RendererFabric; readonly three: ThreeJsRendererAdapter } {
  const { fabric } = buildFabric();
  registerRenderer(fabric, adapter);
  return { fabric, three: adapter };
}

/** Create + mount one three.js session over the SHARED fixture. */
async function mountThreeSession(
  fabric: RendererFabric,
  three: ThreeJsRendererAdapter,
  options?: { readonly viewState?: PortableViewState; readonly fabricSessionId?: string },
): Promise<RendererSession> {
  const fabricSessionId = options?.fabricSessionId ?? THREE_SESSION;
  const created = await fabric.createSession({
    rendererId: THREE_RENDERER_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: options?.viewState ?? fixtureViewState(),
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
  return mounted.value;
}

/** Submit one input and return the sealed receipt (readable failures). */
async function normalized(
  fabric: RendererFabric,
  fabricSessionId: string,
  envelope: Record<string, unknown>,
): Promise<RendererIntentReceipt> {
  const receipt = await fabric.submitInput(fabricSessionId, envelope);
  if (!receipt.ok) {
    throw new Error(`input "${String(envelope.inputId)}" failed: ${receipt.error.message}`);
  }
  return receipt.value;
}

/** The live three.js presentation of one mounted session (evidence). */
function presentationOf(three: ThreeJsRendererAdapter, fabricSessionId = THREE_SESSION): ThreePresentation {
  const presentation = three.presentationOf(fabricSessionId);
  if (presentation === undefined) {
    throw new Error(`no live three.js presentation for "${fabricSessionId}"`);
  }
  return presentation;
}

describe('W058 three.js renderer conformance — the shared canonical fixture (positive)', () => {
  // The frozen pre-run copy of the canonical scene (the no-mutation proof).
  const SCENE_BEFORE = structuredClone(SCENE);
  const SCENE_DIGEST_BEFORE = SCENE.digest;

  it('registers the real Three.js adapter through the REAL capability registry', () => {
    const { fabric } = buildThreeFabric();
    const listed = fabric.adapters.listRenderers();
    const ids = listed.map((entry) => entry.descriptor.rendererId);
    expect(ids).toContain(RENDERER_A_ID);
    expect(ids).toContain(THREE_RENDERER_ID);

    const entry = listed.find((e) => e.descriptor.rendererId === THREE_RENDERER_ID)!;
    // The manifest is a visualization-category capability honoring the
    // frozen renderer contract (the REAL registry verified its digest).
    expect(entry.record.manifest.category).toBe('visualization');
    expect(entry.record.manifest.contracts).toContainEqual({
      contractId: 'epoch.renderers',
      contractVersion: '1.1.0',
    });
    expect(entry.record.lifecycle).toBe('registered');
    // The declared capability set: a fully portable interactive renderer.
    expect(entry.capabilities.hitTesting).toBe(true);
    expect(entry.capabilities.measurement).toBe(true);
    expect(entry.capabilities.annotation).toBe(true);
    expect(entry.capabilities.frameCapture).toBe(true);
    expect(entry.capabilities.degradation).toEqual([
      'none',
      'reduced-fidelity',
      'static-frame',
      'wireframe',
    ]);
    expect(entry.capabilities.portableViewState).toEqual([
      'camera',
      'focused-entities',
      'layer-visibility',
      'timeline-position',
    ]);
    // The W013 hosting descriptor services pointer + keyboard.
    expect(entry.descriptor.interaction).toEqual(['keyboard', 'pointer']);
  });

  it('mounts the shared canonical fixture into a REAL Three.js scene graph (W013-admitted)', async () => {
    const { fabric, three } = buildThreeFabric();
    const session = await mountThreeSession(fabric, three);
    // --- the session record (the fabric's canonical identity) ---
    expect(session.state).toBe('active');
    expect(session.rendererId).toBe(THREE_RENDERER_ID);
    expect(session.worldProjection.tenantScope.tenantId).toBe(TENANT);
    expect(session.mountedWorldDigest).toBe(SCENE.digest);
    expect(session.invocationCount).toBeGreaterThanOrEqual(2); // one per admitted graph + the mount frame advance
    // --- the adapter's mount report (digest continuity) ---
    expect(session.mountedWorldDigest).toBe(SCENE_DIGEST_BEFORE);

    // --- the presentation is a REAL Three.js scene graph ---
    const presentation = presentationOf(three);
    expect(presentation.mountedWorldDigest).toBe(SCENE.digest);
    expect((presentation.root as { isObject3D?: boolean }).isObject3D).toBe(true);
    expect((presentation.worldGroup as { isObject3D?: boolean }).isObject3D).toBe(true);

    // --- semantic entity ids: EXACTLY the shared fixture's presented set
    //     (the same ids every conformant renderer presents — gamma hidden) ---
    expect(presentation.presentedEntityIds).toEqual(PRESENTED_ENTITY_IDS);
    expect(three.runtimeStateOf(THREE_SESSION)!.glSurface).toBe(null); // headless, honestly

    // --- EVERY presented world node carries its semantic entity id ---
    expect(countSemanticEntityNodes(presentation.root)).toBe(PRESENTED_ENTITY_IDS.length);
    for (const entityId of PRESENTED_ENTITY_IDS) {
      const node = presentation.entityNodes.get(entityId);
      expect(node, `presentation node of ${entityId}`).toBeDefined();
      expect(node!.userData[SEMANTIC_ENTITY_KEY]).toBe(entityId);
      expect((node as { isMesh?: boolean }).isMesh).toBe(true);
    }

    // --- the ontology presentation mapped through the ADMITTED graph:
    //     structure boxes (no material record -> the neutral default),
    //     the node sphere carrying the steel material color. ---
    expect(presentation.entityNodes.get(ENTITY_IDS[0])!.userData['epochPrimitive']).toBe('box');
    expect(presentation.entityNodes.get(ENTITY_IDS[1])!.userData['epochPrimitive']).toBe('box');
    expect(presentation.entityNodes.get(ENTITY_IDS[2])!.userData['epochPrimitive']).toBe('sphere');
    expect(materialColorOf(presentation, ENTITY_IDS[0])).toBe(PRESENTATION_DEFAULT_COLOR);
    expect(materialColorOf(presentation, ENTITY_IDS[2])).toBe('#8899aa');

    // --- overlays present as real decoration: beta carries the highlight
    //     tint shell AND the focus ring (the fixture focuses beta); the
    //     unfocused, un-highlighted entities carry neither. ---
    expect(presentation.entityNodes.get(ENTITY_IDS[0])!.children).toHaveLength(0);
    expect(presentation.entityNodes.get(ENTITY_IDS[2])!.children).toHaveLength(0);
    expect(presentation.entityNodes.get(ENTITY_IDS[1])!.children).toHaveLength(2);

    // --- the visible agent representation (presence, not a world entity) ---
    expect(presentation.agentNodes.has('agent:conformance-observer')).toBe(true);
    expect(presentation.agentNodes.size).toBe(1);
  });

  it('hit-tests the real projection and normalizes to the EXISTING intent vocabulary — equivalent to the reference renderer', async () => {
    const { fabric, three } = buildThreeFabric();
    // The reference session (the W056 comparison basis).
    await mountFullSession(fabric);
    await mountThreeSession(fabric, three);
    const presentation = presentationOf(three);

    // For EVERY presented entity: the pointer is DERIVED from the REAL
    // Three.js projection (never guessed), resolves the entity through the
    // real Raycaster, and the SAME logical interaction on the reference
    // renderer resolves the SAME entity with the IDENTICAL normalized
    // intent payload (content-addressed digest equality).
    for (let index = 0; index < PRESENTED_ENTITY_IDS.length; index += 1) {
      const entityId = PRESENTED_ENTITY_IDS[index]!;
      const pointer = projectedPointerOf(presentation, entityId);
      expect(pointer, `projection of ${entityId}`).toBeDefined();
      const suffix = String(index + 1);

      // The hinted activations normalize identically on both renderers.
      for (const [kind, hint] of [
        ['select', undefined],
        ['inspect', 'epoch.world.interaction.inspect'],
        ['isolate', 'epoch.world.interaction.isolate'],
        ['hide', 'epoch.world.interaction.hide'],
      ] as const) {
        const threeReceipt = await normalized(
          fabric,
          THREE_SESSION,
          pointerDownAt(
            THREE_SESSION,
            `rin-w058-${kind}-${suffix}`,
            pointer!.x,
            pointer!.y,
            CLOCK.firstInput,
            hint === undefined
              ? undefined
              : { id: hint, version: '1.1.0' },
          ),
        );
        expect(threeReceipt.outcome).toBe('normalized');
        expect(threeReceipt.hitEntityId).toBe(entityId);
        expect(threeReceipt.intent).toEqual({
          id: `epoch.world.interaction.${kind}`,
          version: '1.1.0',
        });
        expect(threeReceipt.intentPayloadDigest).toMatch(/^[0-9a-f]{64}$/);

        // The reference renderer resolves its own deterministic pointer to
        // the same entity and normalizes to the IDENTICAL payload.
        const referenceX = (index + 0.5) / PRESENTED_ENTITY_IDS.length;
        expect(hitEntityOf(referenceX)).toBe(entityId);
        const referenceReceipt = await normalized(
          fabric,
          'fx-conformance-1',
          pointerDown(
            'fx-conformance-1',
            `rin-w058-${kind}-${suffix}`,
            referenceX,
            CLOCK.firstInput,
            hint === undefined ? undefined : { id: hint, version: '1.1.0' },
          ),
        );
        expect(referenceReceipt.outcome).toBe('normalized');
        expect(referenceReceipt.hitEntityId).toBe(entityId);
        expect(referenceReceipt.intent).toEqual(threeReceipt.intent);
        expect(referenceReceipt.intentPayloadDigest).toBe(threeReceipt.intentPayloadDigest);
      }
    }

    // The REAL two-click measurement affordance reaches the SAME measure
    // intent as the reference's deterministic pairing (anchor + complete
    // vs. single-click next-presented) — identical from/to payloads.
    for (let index = 0; index < PRESENTED_ENTITY_IDS.length; index += 1) {
      const entityId = PRESENTED_ENTITY_IDS[index]!;
      const nextEntityId = PRESENTED_ENTITY_IDS[(index + 1) % PRESENTED_ENTITY_IDS.length]!;
      const suffix = String(index + 1);
      const anchorPointer = projectedPointerOf(presentation, entityId)!;
      const completePointer = projectedPointerOf(presentation, nextEntityId)!;

      // First measure-hinted click: anchors the entity (a typed no-target
      // receipt — the anchor reason is the typed detail; the payload only
      // completes on the second click).
      const anchored = await normalized(
        fabric,
        THREE_SESSION,
        pointerDownAt(
          THREE_SESSION,
          `rin-w058-measure-anchor-${suffix}`,
          anchorPointer.x,
          anchorPointer.y,
          CLOCK.firstInput,
          { id: 'epoch.world.interaction.measure', version: '1.1.0' },
        ),
      );
      expect(anchored.outcome).toBe('no-target');
      expect(anchored.intent).toBeUndefined();
      expect(anchored.rejectionDetail).toContain('measurement anchor set');

      // Second measure-hinted click on a DIFFERENT entity: completes the
      // measurement (the canonical measure intent, W013-admitted).
      const threeMeasure = await normalized(
        fabric,
        THREE_SESSION,
        pointerDownAt(
          THREE_SESSION,
          `rin-w058-measure-${suffix}`,
          completePointer.x,
          completePointer.y,
          CLOCK.secondInput,
          { id: 'epoch.world.interaction.measure', version: '1.1.0' },
        ),
      );
      expect(threeMeasure.outcome).toBe('normalized');
      expect(threeMeasure.intent).toEqual({
        id: 'epoch.world.interaction.measure',
        version: '1.1.0',
      });

      // The reference's single-click measure pairs the SAME two entities.
      const referenceMeasure = await normalized(
        fabric,
        'fx-conformance-1',
        pointerDown(
          'fx-conformance-1',
          `rin-w058-measure-${suffix}`,
          (index + 0.5) / PRESENTED_ENTITY_IDS.length,
          CLOCK.secondInput,
          { id: 'epoch.world.interaction.measure', version: '1.1.0' },
        ),
      );
      expect(referenceMeasure.outcome).toBe('normalized');
      expect(referenceMeasure.intentPayloadDigest).toBe(threeMeasure.intentPayloadDigest);
    }

    // Wheel input: the shared zoom policy (up zooms in 1.25 / down out
    // 0.8) — identical payloads on both renderers.
    const threeZoomIn = await normalized(
      fabric,
      THREE_SESSION,
      wheelInput(THREE_SESSION, 'rin-w058-zoom-in-1', -120, CLOCK.firstInput),
    );
    const referenceZoomIn = await normalized(
      fabric,
      'fx-conformance-1',
      wheelInput('fx-conformance-1', 'rin-w058-zoom-in-1', -120, CLOCK.firstInput),
    );
    expect(threeZoomIn.intent).toEqual({ id: 'epoch.world.interaction.zoom', version: '1.1.0' });
    expect(threeZoomIn.intentPayloadDigest).toBe(referenceZoomIn.intentPayloadDigest);
    const threeZoomOut = await normalized(
      fabric,
      THREE_SESSION,
      wheelInput(THREE_SESSION, 'rin-w058-zoom-out-1', 120, CLOCK.secondInput),
    );
    const referenceZoomOut = await normalized(
      fabric,
      'fx-conformance-1',
      wheelInput('fx-conformance-1', 'rin-w058-zoom-out-1', 120, CLOCK.secondInput),
    );
    expect(threeZoomOut.intentPayloadDigest).toBe(referenceZoomOut.intentPayloadDigest);

    // Annotation: the KIND and target are equivalent; the annotation TEXT
    // is authored by each renderer's own affordance (the reference stamps
    // a fixed text; the three.js affordance derives it from the entity's
    // presentation label) — a difference confined to presentation that
    // still flows through the canonical W016 annotate intent.
    const annotatePointer = projectedPointerOf(presentation, ENTITY_IDS[2])!;
    const threeAnnotate = await normalized(
      fabric,
      THREE_SESSION,
      pointerDownAt(
        THREE_SESSION,
        'rin-w058-annotate-1',
        annotatePointer.x,
        annotatePointer.y,
        CLOCK.firstInput,
        { id: 'epoch.world.interaction.annotate', version: '1.1.0' },
      ),
    );
    const referenceAnnotate = await normalized(
      fabric,
      'fx-conformance-1',
      pointerDown(
        'fx-conformance-1',
        'rin-w058-annotate-1',
        (2 + 0.5) / PRESENTED_ENTITY_IDS.length,
        CLOCK.firstInput,
        { id: 'epoch.world.interaction.annotate', version: '1.1.0' },
      ),
    );
    expect(threeAnnotate.hitEntityId).toBe(ENTITY_IDS[2]);
    expect(referenceAnnotate.hitEntityId).toBe(ENTITY_IDS[2]);
    expect(threeAnnotate.intent).toEqual({
      id: 'epoch.world.interaction.annotate',
      version: '1.1.0',
    });
    expect(referenceAnnotate.intent).toEqual(threeAnnotate.intent);
    // The payload DIGESTS differ (each affordance authors its own text) —
    // the documented presentation-only difference of this check.

    // A visible agent representation is interactive presence: hitting the
    // agent marker normalizes to the follow-agent intent (a three.js
    // declared affordance; the reference adapter presents no agents).
    const agentPointer = projectedPointerOf(presentation, 'agent:conformance-observer')!;
    const follow = await normalized(
      fabric,
      THREE_SESSION,
      pointerDownAt(THREE_SESSION, 'rin-w058-follow-1', agentPointer.x, agentPointer.y, CLOCK.firstInput),
    );
    expect(follow.outcome).toBe('normalized');
    expect(follow.intent).toEqual({
      id: 'epoch.world.interaction.follow-agent',
      version: '1.1.0',
    });

    // Keyboard input through the REAL fabric: space pauses the playing
    // timeline; r replays from the track start (W013-admitted intents).
    // The pause intent itself never mutates the presentation — the paused
    // state arrives through the canonical/portable path (a restore), which
    // is exactly the no-durable-mutation discipline: after the restore,
    // space normalizes to resume.
    const pause = await normalized(
      fabric,
      THREE_SESSION,
      keyDownAt(THREE_SESSION, 'rin-w058-pause-1', ' ', CLOCK.firstInput),
    );
    expect(pause.intent).toEqual({ id: 'epoch.world.interaction.pause', version: '1.1.0' });
    const adapterSession = three.adapterSessionOf(THREE_SESSION)!;
    const restored = await three.restoreViewState(adapterSession, {
      ...fixtureViewState(),
      timelinePosition: { atMs: 3_000, frameIndex: 90, paused: true },
    });
    expect(restored.ok).toBe(true);
    const resume = await normalized(
      fabric,
      THREE_SESSION,
      keyDownAt(THREE_SESSION, 'rin-w058-resume-1', ' ', CLOCK.secondInput),
    );
    expect(resume.intent).toEqual({ id: 'epoch.world.interaction.resume', version: '1.1.0' });
    const replay = await normalized(
      fabric,
      THREE_SESSION,
      keyDownAt(THREE_SESSION, 'rin-w058-replay-1', 'r', CLOCK.secondInput),
    );
    expect(replay.intent).toEqual({ id: 'epoch.world.interaction.replay', version: '1.1.0' });

    // Non-activating input is a typed no-target receipt, never a failure.
    const hover = await normalized(fabric, THREE_SESSION, {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-w058-hover-1',
      fabricSessionId: THREE_SESSION,
      atMs: CLOCK.secondInput,
      modality: 'pointer',
      inputKind: 'pointer-move',
      pointer: { x: 0.5, y: 0.5 },
    });
    expect(hover.outcome).toBe('no-target');
    expect(hover.intent).toBeUndefined();
  });

  it('applies the portable focus/layers/camera to the REAL presentation (mount and restore)', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, three);
    const presentation = presentationOf(three);

    // Focus: the fixture's focused entity carries a REAL focus ring.
    const focused = presentation.entityNodes.get(ENTITY_IDS[1])!;
    expect(
      focused.children.some((child) => child.userData['epochFocusRing'] === true),
    ).toBe(true);
    expect(
      presentation.entityNodes.get(ENTITY_IDS[0])!.children.some(
        (child) => child.userData['epochFocusRing'] === true,
      ),
    ).toBe(false);

    // Camera: the portable camera of the fixture view state is the live
    // presentation viewpoint (the canonical scene camera seeds the mount;
    // the portable state is what a switch restores).
    const camera = orbitOf(presentation.controls.toPortableCamera());
    expect(camera.mode).toBe('orbit');
    expect(camera.position).toEqual([30, 20, 30]);

    // Layer visibility: the adapter's DECLARED layer policy (layers derive
    // deterministically from the canonical entity types) applied over the
    // SAME shared world — hiding the structure layer hides alpha + beta
    // (presentation AND hit-testing), the node entity stays interactive.
    const layerHidden = await mountThreeSession(fabric, three, {
      fabricSessionId: 'fx-w058-three-layers',
      viewState: {
        ...fixtureViewState(),
        layerVisibility: [
          { layerId: 'lyr-node', visible: true },
          { layerId: 'lyr-structure', visible: false },
        ],
      },
    });
    expect(layerHidden.state).toBe('active');
    const layered = presentationOf(three, 'fx-w058-three-layers');
    expect(isEntityVisible(layered, ENTITY_IDS[0])).toBe(false);
    expect(isEntityVisible(layered, ENTITY_IDS[1])).toBe(false);
    expect(isEntityVisible(layered, ENTITY_IDS[2])).toBe(true);
    // Hidden presentation is not interactive: the real Raycaster honors
    // the view filter (the pointer at the hidden entity's projection hits
    // nothing semantic).
    const hiddenPointer = projectedPointerOf(layered, ENTITY_IDS[0])!;
    const miss = await normalized(
      fabric,
      'fx-w058-three-layers',
      pointerDownAt(
        'fx-w058-three-layers',
        'rin-w058-layer-miss-1',
        hiddenPointer.x,
        hiddenPointer.y,
        CLOCK.firstInput,
      ),
    );
    expect(miss.outcome).toBe('no-target');
    // The visible node entity still resolves through the same projection.
    const visiblePointer = projectedPointerOf(layered, ENTITY_IDS[2])!;
    const hit = await normalized(
      fabric,
      'fx-w058-three-layers',
      pointerDownAt(
        'fx-w058-three-layers',
        'rin-w058-layer-hit-1',
        visiblePointer.x,
        visiblePointer.y,
        CLOCK.firstInput,
      ),
    );
    expect(hit.outcome).toBe('normalized');
    expect(hit.hitEntityId).toBe(ENTITY_IDS[2]);
  });

  it('switches reference -> three.js through the REAL fabric (the switching invariant)', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountFullSession(fabric); // reference source: 'fx-conformance-1'

    // Normalized-interaction evidence on the SOURCE renderer.
    const sourceReceipt = await normalized(
      fabric,
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-w058-switch-select-1', 0.5, CLOCK.firstInput),
    );
    expect(sourceReceipt.outcome).toBe('normalized');

    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-w058-1',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: THREE_RENDERER_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-w058-three-2',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const receipt = outcome.value.receipt;

    // --- tenant continuity ---
    expect(receipt.tenantScope.tenantId).toBe(TENANT);
    expect(outcome.value.session.worldProjection.tenantScope.tenantId).toBe(TENANT);
    // --- digest continuity (the canonical world digest survives) ---
    expect(receipt.worldDigest).toBe(SCENE.digest);
    expect(receipt.mountedProjectionDigest).toBe(SCENE.digest);
    expect(outcome.value.session.mountedWorldDigest).toBe(SCENE.digest);
    // --- the switch itself ---
    expect(receipt.fromRendererId).toBe(RENDERER_A_ID);
    expect(receipt.toRendererId).toBe(THREE_RENDERER_ID);
    expect(receipt.fallbackApplied).toBe(false);
    // --- EVERY portable field restored (the three.js adapter declares all
    //     four; the reference's camera skip is the W056 reduced-renderer
    //     case, not this one) ---
    expect(outcome.value.restoredViewFields).toEqual([
      'camera',
      'focused-entities',
      'layer-visibility',
      'timeline-position',
    ]);
    expect(outcome.value.skippedViewFields).toEqual([]);
    expect(receipt.restoredViewState.focusedEntityIds).toEqual([ENTITY_IDS[1]]);
    // --- the target presents the SAME semantic entities in a REAL scene
    //     graph, with the restored focus applied as a real ring ---
    const presentation = presentationOf(three, 'fx-w058-three-2');
    expect(presentation.presentedEntityIds).toEqual(PRESENTED_ENTITY_IDS);
    expect(presentation.mountedWorldDigest).toBe(SCENE.digest);
    expect(
      presentation.entityNodes.get(ENTITY_IDS[1])!.children.some(
        (child) => child.userData['epochFocusRing'] === true,
      ),
    ).toBe(true);
    // --- the source session is disposed (terminal); nothing survives ---
    expect(outcome.value.disposedSource.state).toBe('disposed');
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('disposed');
    expect(sessionStateOf(fabric, 'fx-w058-three-2')).toBe('active');

    // --- equivalent normalized intents ACROSS the switch: the same
    //     logical interaction on the target produces the identical intent
    //     payload digest as on the source. ---
    const targetPointer = projectedPointerOf(presentation, sourceReceipt.hitEntityId ?? ENTITY_IDS[1])!;
    const targetReceipt = await normalized(
      fabric,
      'fx-w058-three-2',
      pointerDownAt(
        'fx-w058-three-2',
        'rin-w058-switch-select-1',
        targetPointer.x,
        targetPointer.y,
        CLOCK.firstInput,
      ),
    );
    expect(targetReceipt.hitEntityId).toBe(sourceReceipt.hitEntityId);
    expect(targetReceipt.intent).toEqual(sourceReceipt.intent);
    expect(targetReceipt.intentPayloadDigest).toBe(sourceReceipt.intentPayloadDigest);
  });

  it('switches three.js -> reference and carries the LIVE presentation camera', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, three, { fabricSessionId: 'fx-w058-three-3' });

    // Drive the presentation camera (presentation-only input: wheel dolly
    // + a discrete orbit) so the LIVE viewpoint differs from the mounted one.
    await normalized(fabric, 'fx-w058-three-3', wheelInput('fx-w058-three-3', 'rin-w058-dolly-1', -120, CLOCK.firstInput));
    await normalized(
      fabric,
      'fx-w058-three-3',
      keyDownAt('fx-w058-three-3', 'rin-w058-orbit-1', 'arrow-left', CLOCK.secondInput),
    );
    const liveCamera = orbitOf(presentationOf(three, 'fx-w058-three-3').controls.toPortableCamera());
    expect(liveCamera.position).not.toEqual([30, 20, 30]); // the viewpoint actually moved

    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-w058-2',
        sourceFabricSessionId: 'fx-w058-three-3',
        targetRendererId: RENDERER_A_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-w058-ref-2',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The snapshot captured the three.js LIVE viewpoint (not the mounted
    // one) and the target restored it: presentation continuity across a
    // renderer switch, through the portable grammar only.
    expect(outcome.value.receipt.restoredViewState.camera).toEqual(liveCamera);
    expect(outcome.value.receipt.toRendererId).toBe(RENDERER_A_ID);
    expect(outcome.value.session.mountedWorldDigest).toBe(SCENE.digest);
    // The three.js source session is fully torn down (its GPU ledger
    // disposed; nothing survives).
    expect(outcome.value.disposedSource.state).toBe('disposed');
    expect(three.presentationOf('fx-w058-three-3')).toBeUndefined();
  });

  it('advances frames at virtual time and applies the declared degradations over the shared fixture', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, three);
    const presentation = presentationOf(three);

    // The mount restored the portable timeline position (t=3000ms).
    expect(presentation.timelineAtMs).toBe(3_000);
    // A frame at virtual t=6000ms advances the presentation timeline.
    const frame = await fabric.applyFrame(THREE_SESSION, { atMs: 6_000 });
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;
    expect(frame.value.presented).toBe(true);
    expect(frame.value.degradation).toBe('none');
    expect(presentation.timelineAtMs).toBe(6_000);

    // Wireframe: every entity material flips (declared, reversible).
    const wireframed = await fabric.applyFrame(THREE_SESSION, { atMs: 6_100, degradation: 'wireframe' });
    expect(wireframed.ok).toBe(true);
    if (!wireframed.ok) return;
    expect(wireframed.value.session.state).toBe('degraded');
    expect(isWireframe(presentation, ENTITY_IDS[1])).toBe(true);
    const restored = await fabric.applyFrame(THREE_SESSION, { atMs: 6_200 });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.session.state).toBe('active');
    expect(isWireframe(presentation, ENTITY_IDS[1])).toBe(false);

    // Reduced fidelity: curved primitives rebuild at the reduced LOD.
    const reduced = await fabric.applyFrame(THREE_SESSION, { atMs: 6_300, degradation: 'reduced-fidelity' });
    expect(reduced.ok).toBe(true);
    if (!reduced.ok) return;
    expect(presentation.lodSegments).toBe(REDUCED_FIDELITY_SEGMENTS);
    const full = await fabric.applyFrame(THREE_SESSION, { atMs: 6_400 });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(presentation.lodSegments).toBe(FULL_FIDELITY_SEGMENTS);

    // Static frame: playback freezes (the timeline cursor holds).
    await fabric.applyFrame(THREE_SESSION, { atMs: 6_500 });
    expect(presentation.timelineAtMs).toBe(6_500);
    const frozen = await fabric.applyFrame(THREE_SESSION, { atMs: 7_500, degradation: 'static-frame' });
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    expect(presentation.timelineAtMs).toBe(6_500); // frozen: the virtual time did not advance the cursor
  });

  it('proves no durable semantic mutation across mount, input, and switch', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, three);
    const pointer = projectedPointerOf(presentationOf(three), ENTITY_IDS[0])!;
    const select = await normalized(
      fabric,
      THREE_SESSION,
      pointerDownAt(THREE_SESSION, 'rin-w058-mutation-select-1', pointer.x, pointer.y, CLOCK.firstInput),
    );
    expect(select.hitEntityId).toBe(ENTITY_IDS[0]);
    const switched = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-w058-3',
        sourceFabricSessionId: THREE_SESSION,
        targetRendererId: RENDERER_A_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-w058-ref-3',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(switched.ok).toBe(true);

    // 1. The canonical scene object is byte-identical to its pre-run copy:
    //    the real Three.js mount, the raycaster input, and the switch never
    //    mutated it.
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(SCENE.digest).toBe(SCENE_DIGEST_BEFORE);
    expect(WORLD_PROJECTION.worldDigest).toBe(SCENE_DIGEST_BEFORE);

    // 2. The renderer-emitted intent flows through the EXISTING W016
    //    authority surface (admission + reducer): applying the select
    //    intent returns a NEW canonical revision — the transition lives in
    //    the W016 store, never in a renderer session.
    const { digest: _stripped, ...sceneContent } = structuredClone(SCENE_BEFORE);
    void _stripped;
    const store = createWorldScene(emptyWorldSceneStore(), sceneContent, {
      expectedTenantId: TENANT,
    });
    expect(store.ok).toBe(true);
    if (!store.ok) return;
    const applied = applyWorldIntent(
      store.value.state,
      SCENE_ID,
      {
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'select',
        intentId: 'wi-rin-w058-mutation-select-1',
        entityId: ENTITY_IDS[0],
      },
      { expectedTenantId: TENANT },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.focusedEntityIds).toEqual([ENTITY_IDS[0]]);
    expect(applied.value.outcome.scene.digest).not.toBe(SCENE.digest);
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(store.value.scene).toEqual(SCENE_BEFORE);
  });

  it('disposes with full GPU teardown and refuses everything afterwards', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountThreeSession(fabric, three);
    const before = three.disposalReportOf(THREE_SESSION)!;
    expect(before.totalTracked).toBeGreaterThan(0); // real geometries + materials
    expect(before.disposedEvents).toBe(0); // nothing disposed yet

    const disposed = await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
    expect(disposed.ok).toBe(true);
    if (!disposed.ok) return;
    expect(disposed.value.state).toBe('disposed');

    // The ledger recorded the REAL Three.js dispose events (full GPU
    // teardown: every tracked resource released).
    const report = three.disposalReportOf(THREE_SESSION)!;
    expect(report.disposedEvents).toBe(report.totalTracked);
    expect(report.geometries).toBeGreaterThan(0);
    expect(report.materials).toBeGreaterThan(0);
    // Nothing survives dispose: the presentation is gone.
    expect(three.presentationOf(THREE_SESSION)).toBeUndefined();
    expect(three.adapterSessionOf(THREE_SESSION)).toBeUndefined();
    // Health is honest about the terminal state.
    const health = await fabric.healthOf(THREE_SESSION, CLOCK.switchCompleted);
    expect(health.ok).toBe(true);
    if (health.ok) {
      expect(health.value.state).toBe('unavailable');
      expect(health.value.lastFailureCode).toBe('session-disposed');
    }
  });

  it('emits the sealed conformance result over every check kind x renderer', async () => {
    const { fabric, three } = buildThreeFabric();
    await mountFullSession(fabric);
    await mountThreeSession(fabric, three);
    const presentation = presentationOf(three);
    const threePointer = projectedPointerOf(presentation, ENTITY_IDS[1])!;
    const sourceReceipt = await normalized(
      fabric,
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-w058-seal-1', 0.5, CLOCK.firstInput),
    );
    const threeReceipt = await normalized(
      fabric,
      THREE_SESSION,
      pointerDownAt(THREE_SESSION, 'rin-w058-seal-1', threePointer.x, threePointer.y, CLOCK.firstInput),
    );
    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-w058-4',
        sourceFabricSessionId: THREE_SESSION,
        targetRendererId: RENDERER_A_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-w058-ref-4',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Assemble the typed conformance result: every check kind, both
    // renderers (the reference kind + the real three.js kind), with
    // content-addressed evidence digests.
    const check = (
      checkKind: RendererConformanceCheck['checkKind'],
      rendererId: string,
      evidenceDigest?: string,
    ): RendererConformanceCheck => ({
      checkKind,
      rendererId,
      outcome: 'pass',
      ...(evidenceDigest !== undefined ? { evidenceDigest } : {}),
    });
    const content: RendererConformanceResultContent = {
      schema: 'epoch.renderer-conformance-result',
      fabricProtocolVersion: '1.0.0',
      runId: 'conf-w058-threejs-shared-fixture',
      renderers: [RENDERER_A_ID, THREE_RENDERER_ID],
      tenantScope: { tenantId: TENANT },
      worldDigest: SCENE.digest,
      checks: [
        check('tenant-continuity', RENDERER_A_ID),
        check('tenant-continuity', THREE_RENDERER_ID),
        check('digest-continuity', RENDERER_A_ID, SCENE.digest),
        check('digest-continuity', THREE_RENDERER_ID, SCENE.digest),
        check('semantic-entity-ids', RENDERER_A_ID),
        check('semantic-entity-ids', THREE_RENDERER_ID),
        check('interaction-outcomes', RENDERER_A_ID, sourceReceipt.digest),
        check('interaction-outcomes', THREE_RENDERER_ID, threeReceipt.digest),
        check('semantic-focus-layers', RENDERER_A_ID),
        check('semantic-focus-layers', THREE_RENDERER_ID),
        check('normalized-intents', RENDERER_A_ID, sourceReceipt.intentPayloadDigest),
        check('normalized-intents', THREE_RENDERER_ID, threeReceipt.intentPayloadDigest),
        check('presentation-only-differences', RENDERER_A_ID),
        check('presentation-only-differences', THREE_RENDERER_ID),
      ],
      overallOutcome: 'pass',
      startedAtMs: CLOCK.sessionCreated,
      completedAtMs: CLOCK.switchCompleted,
    };
    // The typed record validates against the frozen contract schema...
    expect(RendererConformanceResultContentSchema.parse(content)).toEqual(content);
    // ...and seals content-addressed (the digest excludes itself).
    expect(canonicalDigest(content as unknown as JsonValue)).toMatch(/^[0-9a-f]{64}$/);
  });
});
