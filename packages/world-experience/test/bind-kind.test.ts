// The W066 bind-kind battery (ACR-010): the `bind` interaction kind's
// typed admission path and experience-scoped effect, pinned at the
// admission seam. This file re-pins, for the new kind, the two invariants
// the qa/foundation-renderers battery proves at the bridge surface
// (gltf-fabric-bridge.test.ts):
//
//   1. NO DURABLE SEMANTIC MUTATION — an admitted bind never mutates the
//      scene revision, the store state, or any semantic entity reference
//      (the qa battery's "presented semantic entity ids are unchanged";
//      here: the exact-revision world references are unchanged, the store
//      is the same object, and a bind sequence leaves the store
//      byte-identical);
//   2. THE CANONICAL WORLD DIGEST IS UNCHANGED — the qa battery's
//      "snapshot.worldProjection.worldDigest === SCENE.digest" survives
//      the binding; here: the sealed scene digest is bit-identical before
//      and after an admitted bind, and the recomputed canonical digest of
//      the unchanged content still addresses the same revision.
//
// Plus the typed-admission negatives specific to the payload shape: a
// VALIDATED binding REFERENCE only (the sealed binding's content address +
// tenant scope) — malformed references are typed refusals, raw bytes are
// refused, and a binding reference outside the scene's owning tenant is a
// typed cross-tenant denial (R12).
import { describe, expect, it } from 'vitest';
import { createWorldScene, emptyWorldSceneStore, sealWorldSceneContent } from '../src/scene';
import { applyWorldIntent } from '../src/reducer';
import { admitWorldIntent, controlIntentOf, isWorldInteractionKind } from '../src/intent';
import { computeWorldSceneDigest } from '../src/serialize';
import { WorldInteractionKindSchema, WORLD_INTENT_TYPE_VERSION } from '../src/version';
import {
  BINDING_DIGEST,
  TENANT_A,
  TENANT_B,
  expectFailure,
  intentFixtures,
  sceneContent,
} from './fixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

/** A valid bind intent payload (the reference fixture's binding reference). */
function bindPayload() {
  return {
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'bind',
    intentId: 'intent-bind-1',
    bindingDigest: BINDING_DIGEST,
    tenantScope: { tenantId: TENANT_A, workspaceId: 'ws-main', projectId: 'proj-tower-a' },
  } as const;
}

function setup() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value;
}

describe('the bind kind (admission, positive)', () => {
  it('admits a valid binding reference through the canonical path', () => {
    const admitted = admitWorldIntent(bindPayload());
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.kind).toBe('bind');
    // The payload is exactly the typed binding reference — nothing else.
    expect(admitted.value).toEqual(bindPayload());
  });

  it('the closed vocabulary and the schema registry admit the kind', () => {
    expect(isWorldInteractionKind('bind')).toBe(true);
    expect(WorldInteractionKindSchema.safeParse('bind').success).toBe(true);
    // The pre-existing kinds are untouched (closed-vocabulary extension only).
    expect(isWorldInteractionKind('select')).toBe(true);
    expect(isWorldInteractionKind('teleport')).toBe(false);
  });

  it('bind bridges to its typed ControlIntent at the additive 1.1.0 version', () => {
    const fixture = intentFixtures().find((intent) => intent.kind === 'bind');
    expect(fixture).toBeDefined();
    const bridged = controlIntentOf(fixture!);
    expect(bridged).toEqual({
      id: 'epoch.world.interaction.bind',
      version: WORLD_INTENT_TYPE_VERSION,
    });
    expect(WORLD_INTENT_TYPE_VERSION).toBe('1.1.0');
  });
});

describe('the bind payload (typed refusals, negative)', () => {
  it('a non-hex binding digest is a typed invalid-intent refusal', () => {
    const failure = expectFailure(
      admitWorldIntent({ ...bindPayload(), bindingDigest: 'z'.repeat(64) }),
      'invalid-intent',
    );
    expect(failure.issues[0]?.path).toContain('bindingDigest');
  });

  it('a wrong-length binding digest is a typed invalid-intent refusal', () => {
    expectFailure(admitWorldIntent({ ...bindPayload(), bindingDigest: 'a'.repeat(63) }), 'invalid-intent');
    expectFailure(admitWorldIntent({ ...bindPayload(), bindingDigest: 'a'.repeat(65) }), 'invalid-intent');
  });

  it('a missing binding digest is a typed invalid-intent refusal', () => {
    const { bindingDigest: _omit, ...withoutDigest } = bindPayload();
    void _omit;
    const failure = expectFailure(admitWorldIntent(withoutDigest), 'invalid-intent');
    expect(failure.issues[0]?.path).toContain('bindingDigest');
  });

  it('a missing tenant scope is a typed invalid-intent refusal', () => {
    const { tenantScope: _omit, ...withoutScope } = bindPayload();
    void _omit;
    const failure = expectFailure(admitWorldIntent(withoutScope), 'invalid-intent');
    expect(failure.issues[0]?.path).toContain('tenantScope');
  });

  it('a tenant scope without tenantId is a typed invalid-intent refusal', () => {
    expectFailure(
      admitWorldIntent({ ...bindPayload(), tenantScope: { workspaceId: 'ws-main' } }),
      'invalid-intent',
    );
  });

  it('a vendor field in the tenant scope is refused (strict objects)', () => {
    expectFailure(
      admitWorldIntent({
        ...bindPayload(),
        tenantScope: { tenantId: TENANT_A, vendorEngine: 'threejs' },
      }),
      'invalid-intent',
    );
  });

  it('NEVER raw bytes: an asset-bytes field is a typed refusal, never a parse', () => {
    // The payload shape admits ONLY the validated binding reference. Any
    // attempt to smuggle untrusted raw bytes through the intent is a typed
    // invalid-intent refusal at the strict schema gate (the trust gate
    // stays upstream in the foundation bridge).
    const failure = expectFailure(
      admitWorldIntent({ ...bindPayload(), assetBytes: 'PD9hbGxlZHZhbHVlPz4=' } as object),
      'invalid-intent',
    );
    // The strict-object refusal names the smuggled vendor field (zod
    // reports unknown keys via unrecognized_keys at the root).
    expect(failure.issues.some((issue) => issue.message.includes('assetBytes'))).toBe(true);
    expectFailure(admitWorldIntent({ ...bindPayload(), byteSize: 4096 } as object), 'invalid-intent');
  });

  it('executable UI content in a bind intent is refused before schema validation', () => {
    // The Dynamic UI law holds for the new kind exactly as for the others:
    // the executable-UI gate fires first with its dedicated typed code.
    const failure = expectFailure(
      admitWorldIntent({ ...bindPayload(), script: 'stealBytes()' } as object),
      'executable-ui-rejected',
    );
    expect(failure.offendingKey).toBe('script');
  });

  it('version skew on a bind intent fails fast with version-unsupported', () => {
    const failure = expectFailure(
      admitWorldIntent({ ...bindPayload(), intentVersion: 2 }),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1');
    expect(failure.encountered).toBe('2');
  });
});

describe('the bind effect (reducer, invariance pins)', () => {
  it('produces exactly one binding-requested effect carrying the binding reference', () => {
    const { state } = setup();
    const admitted = admitWorldIntent(bindPayload());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.effects).toHaveLength(1);
    expect(applied.value.outcome.effects[0]).toEqual({
      effect: 'binding-requested',
      bindingDigest: BINDING_DIGEST,
      tenantId: TENANT_A,
    });
  });

  it('NEVER mutates durable semantic state (the no-mutation negative pin)', () => {
    const { state, scene } = setup();
    const before = JSON.stringify(state);
    const admitted = admitWorldIntent(bindPayload());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // The store state is the SAME object (no new revision was written).
    expect(applied.value.state).toBe(state);
    // The scene revision is the SAME sealed object (no view mutation either:
    // bind is effect-only, unlike the presentation intents).
    expect(applied.value.outcome.scene).toBe(scene);
    // The store is byte-identical after the bind.
    expect(JSON.stringify(applied.value.state)).toBe(before);
    // Repeated binds stay byte-identical (idempotent at the store level).
    const second = applyWorldIntent(applied.value.state, 'wsc-tower-a-site', admitted.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(JSON.stringify(second.value.state)).toBe(before);
  });

  it('the canonical world digest is UNCHANGED by an admitted bind (the qa/foundation-renderers invariant re-pinned at the admission seam)', () => {
    const { state, scene } = setup();
    const admitted = admitWorldIntent(bindPayload());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const after = applied.value.outcome.scene;
    // The sealed scene digest — the canonical world digest at this seam —
    // is bit-identical: binding never rewrites the addressed world revision.
    expect(after.digest).toBe(scene.digest);
    // The recomputed canonical digest of the unchanged content still
    // addresses the same revision (digest ↔ content correspondence, not
    // just object identity).
    const { digest: _sealed, ...content } = after;
    void _sealed;
    expect(computeWorldSceneDigest(content)).toBe(scene.digest);
    // The exact-revision semantic world references are unchanged (the qa
    // battery's "presented semantic entity ids are unchanged" — here the
    // semantic entity anchors: ids AND content digests).
    expect(after.entities.map((e) => [e.entityId, e.contentDigest] as const)).toEqual(
      scene.entities.map((e) => [e.entityId, e.contentDigest] as const),
    );
    // The pre-bind and post-bind scenes seal identically from the same
    // content (the revision is the addressed one, never a fork).
    expect(sealWorldSceneContent(content).digest).toBe(scene.digest);
  });

  it('a binding reference outside the scene\u2019s owning tenant is a typed cross-tenant denial (R12)', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      ...bindPayload(),
      intentId: 'intent-bind-cross-tenant',
      tenantScope: { tenantId: TENANT_B },
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const failure = expectFailure(
      applyWorldIntent(state, 'wsc-tower-a-site', admitted.value),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe(TENANT_A);
    expect(failure.encounteredTenantId).toBe(TENANT_B);
    expect(failure.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('never awaits a semantic authority: the outcome is the effect only, no scene transition', () => {
    const { state, scene } = setup();
    const admitted = admitWorldIntent(bindPayload());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // Effect-only: no camera transition, no timeline move, no overlay
    // change — the bind request is routed to the host, never executed here.
    expect(applied.value.outcome.cameraTransition).toBeUndefined();
    expect(applied.value.outcome.scene.timeline.position).toEqual(scene.timeline.position);
    expect(applied.value.outcome.scene.overlays).toBe(scene.overlays);
  });
});
