# The Renderer Fabric Contract (W056 — frozen for W057-W059)

This document is the implementation-facing record of what W056 froze: the
provider-neutral Renderer Fabric contract, the adapter seam, and the
conformance harness. W057 (world workspace), W058 (Three.js) and W059
(Babylon.js) build against exactly these surfaces — additive changes only,
breaking changes require a new Work Order.

## Where everything lives

| Surface | Location | Role |
|---|---|---|
| Contract declarations | `contracts/renderers/index.d.ts` (v1.1.0) | The versioned, self-contained TS declaration tree (zero imports, zero engine vocabulary). |
| Contract parity | `contracts/renderers/parity.ts` | Compile-time proof the runtime's zod-inferred types equal the declarations. |
| Contract schemas | `contracts/renderers/schemas/*.schema.json` | The JSON Schema projection (draft 2020-12), byte-digest-pinned in `manifest.json`. |
| Contract runtime | `packages/renderer-runtime` | Zod schemas + validators + sealers for every W013 and W056 document; the W013 admission boundary (`bindRendererSession`, `admitInvocation`) the fabric drives. |
| The fabric | `packages/renderer-fabric` | The orchestration: adapter registry, `RendererFabric` lifecycle, the switching invariant, the reference adapter. |
| Conformance harness | `qa/renderer-conformance` | The shared-fixture battery (positive + negative) that W058/W059 adapters run against. |

Contract versioning: `contracts/renderers` is at contract version **1.1.0**
(additive over the unchanged W013 1.0.0 hosting surface); the fabric
protocol version carried by every fabric document is **`1.0.0`**
(`RendererFabricProtocolVersion`). Renderer capability manifests must
declare the `epoch.renderers` contract at `1.1.0`.

## The contract concepts (exact TS names)

All exported from `@epoch/renderer-runtime` (and declared in
`contracts/renderers/index.d.ts`):

- `RendererCapabilitySet` — what the ADAPTER can do (hit-testing,
  measurement, annotation, frame capture, switching, snapshot capture,
  typed degradations, portable view-state fields, asset kinds). Distinct
  from the unchanged W013 `RendererDescriptor`, which declares what the
  HOST surfaces (graph kinds, modalities, output, budgets).
- `RendererSession` / `RendererSessionContent` — the ephemeral,
  non-authoritative session record (sealed, content-addressed). Embeds the
  W013 `RendererBinding`, the capability set, the `WorldProjectionRef`
  identity triple, the portable view state, health, and counters.
  Lifecycle: `created -> active -> (degraded|suspended)* -> disposed`
  (terminal).
- `RendererSessionSnapshot` / `RendererSessionSnapshotContent` — the
  portable capture that survives a switch (world projection reference +
  portable view state + counters).
- `RendererSwitchRequest` — the transient switch intent (never sealed,
  never persisted).
- `RendererSwitchReceipt` / `RendererSwitchReceiptContent` — the sealed
  execution evidence of one completed switch (from/to, tenant scope, world
  digest, source snapshot digest, mounted projection digest, restored
  fields, fallback flag).
- `RendererFrameEnvelope` — one admitted frame (monotonic index, world
  digest, typed degradation, admission digest).
- `RendererInputEnvelope` — one RAW input event (pointer/key/wheel,
  pre-normalization, discriminated on `inputKind`).
- `RendererIntentReceipt` / `RendererIntentReceiptContent` — the sealed
  receipt of one input normalization (hit entity id, the typed
  `ControlIntent`, payload digest, W013 admission digest, outcome:
  `normalized` | `no-target` | `rejected`).
- `RendererFailure` — the typed failure taxonomy (discriminated on `code`,
  14 codes; W013 `RendererRuntimeError` causes ride along verbatim).
- `RendererHealth` — the health projection (`healthy` | `degraded` |
  `failed` | `unavailable` + degradation + last failure code).
- `RendererAssetBinding` / `RendererAssetBindingContent` — the
  content-addressed, tenant-scoped asset binding (`untrusted` until
  explicitly `validated`; untrusted assets never mount).
- `RendererConformanceResult` / `RendererConformanceCheck` — the sealed
  conformance evidence (7 check kinds x every renderer, typed verdict).
- `PortableViewState` (+ camera/timeline grammars) — the portable
  presentation subset, mirrored member-for-member from the W016 canonical
  home (`@epoch/world-experience`) and pinned there by compile-time
  (`packages/renderer-fabric/src/parity.ts`) and runtime
  (`packages/renderer-fabric/test/parity.test.ts`) parity batteries.
- `WorldProjectionRef` — the identity triple that survives switching:
  scene id (`wsc-` grammar), world digest, tenant scope.

## The adapter seam (what W058/W059 implement)

`RendererAdapter` (exported from `@epoch/renderer-fabric`):

```
identity() / descriptor() / capabilities()          // declaration
probe(device)                                        // compatibility (pure)
createSession(context)                               // ephemeral adapter session
mountProjection(session, { scene, compilation, admittedReceipts })
applyFrame(session, envelope)
translateInput(session, rawInputEnvelope)            // hit-test -> semantic entity id
                                                     //   -> EXISTING W016 intent
captureSnapshot(session, { counters, atMs })
restoreViewState(session, viewState)                 // capability-filtered
bindAsset?(session, binding)                         // optional, declared kinds only
dispose(session)                                     // terminal
health(session, atMs)
```

Division of labor:

- the FABRIC owns the W013 admission boundary (binding, mount-graph,
  advance-frame, submit-intent) and the W016 compile step — adapters
  never invoke admission directly;
- the ADAPTER owns provider-native presentation: build from the admitted
  typed data, execute frames, hit-test raw input against ITS
  presentation, and normalize input into the EXISTING typed
  `epoch.world.interaction.*` vocabulary (`@epoch/world-experience`
  intents — never a parallel vocabulary);
- adapter session state is an OPAQUE handle (`unknown`) and EPHEMERAL by
  construction — nothing an adapter holds is semantic state, and nothing
  survives `dispose`.

Hard rules for adapters (architecture lock + ACR-007):

1. ZERO engine imports leak into `contracts/*` or
   `packages/renderer-*` (the engine lives in the adapter package only).
2. Never mutate the canonical `WorldScene` input (mount is pure w.r.t. it).
3. Never author intents outside the existing W016 vocabulary; the fabric
   re-admits every normalized intent through the W016 total admission
   (adapters are never trusted).
4. Never persist anything; there is no fabric persistence API.
5. All times are caller-supplied virtual times; no wall-clock, no
   randomness in the deterministic core.

## Registration (capability-registry integration)

A renderer registers as a `visualization`-category capability manifest
honoring `epoch.renderers@1.1.0`, sealed and digest-verified through the
REAL `@epoch/capability-registry`:

```ts
const manifest = rendererCapabilityManifestOf({
  capabilityId: 'epoch.renderer.three',        // neutral id, never a vendor product
  version: '1.0.0',
  descriptor,                                  // W013 RendererDescriptor
  capabilities,                                // W056 RendererCapabilitySet
  displayName: 'Epoch 3D renderer (embedded)',
});

fabric.adapters.register({
  manifest: sealed.manifest,
  digest: sealed.digest,
  adapter,                                     // the RendererAdapter implementation
});
```

Lifecycle is the registry's: retired renderers never resolve for new
sessions; deprecated ones resolve (advisory); version constraints resolve
the highest satisfying version. The renderer selector lists
`fabric.adapters.listRenderers()` (sorted, capability-consistent).

## The switching invariant (implemented in `RendererFabric.switchRenderer`)

```
1. save canonical session snapshot        (source adapter capture, digest-verified)
2. resolve target renderer                (primary, then ordered fallback chain)
3. verify digest/tenant compatibility     (snapshot digest == claimed digest == scene
                                            digest; tenant match — typed
                                            `switch-incompatible` on violation)
4. mount target from canonical projection (W016 compile -> W013 admission ->
                                            adapter mount; never from source state)
5. restore portable focus/layers/timeline (capability-filtered; skipped fields are
                                            listed in the receipt, never silent)
6. emit switch receipt                    (sealed, content-addressed)
7. dispose previous session               (terminal)
```

Guarantees:

- a FAILED switch aborts with `switch-aborted` and the previous session
  RETAINED (still presenting, still interactive);
- a fallback-completed switch is a SUCCESS whose receipt records
  `fallbackApplied: true` plus an informational `fallback-applied` typed
  failure;
- the switch never creates durable semantic state (the canonical scene is
  never mutated; the only fabric state is the in-memory session map).

## Renderer input normalization

`pointer/keyboard/touch -> renderer handle -> semantic entity id -> typed
Epoch intent -> existing authority`. Concretely
(`RendererFabric.submitInput`):

1. the raw `RendererInputEnvelope` is schema-validated and modality-gated
   against the binding;
2. the ADAPTER hit-tests against its own presentation and returns the hit
   semantic entity id + the normalized W016 `WorldInteractionIntent`;
3. the fabric re-admits the intent through the W016 total admission (the
   Dynamic UI law — adapters are never trusted);
4. the intent is compiled into a W013 submit-intent envelope and admitted
   through the REAL W013 boundary;
5. the sealed `RendererIntentReceipt` links both digests (intent payload
   + W013 admission) — the evidence chain.

A miss is a typed `no-target` receipt (never a failure). Measurement and
annotation normalize to the existing canonical intent/record types through
the same path.

## Failure taxonomy (`RendererFailure` codes)

`adapter-unavailable`, `asset-rejected`, `cross-tenant-denied`,
`degraded`, `fallback-applied`, `input-unsupported`,
`invalid-fabric-record`, `mount-failed`, `probe-rejected`,
`session-disposed`, `session-failed`, `switch-aborted`,
`switch-incompatible`, `unknown-session`.

Every failure is a discriminated value (never a bare throw). Degradation
is a typed fidelity reduction (`reduced-fidelity` | `static-frame` |
`wireframe`) that the adapter must DECLARE in its capability set —
undeclared degradations are refused.

## Conformance (qa/renderer-conformance)

The shared fixture proves, over TWO distinguishable reference renderer
instances and ONE canonical W016 world:

- same tenant (across renderers AND across the switch);
- same world digest (mount, input, switch all continuity-checked);
- same semantic entity ids (presented entities = the projection's);
- equivalent supported interaction outcomes (same normalized pointer ->
  same semantic entity on both renderers);
- same semantic focus/layers (portable restore);
- equivalent normalized intents (identical intent payload digests — one
  shared vocabulary);
- renderer-specific differences confined to presentation (skipped
  portable fields are typed and listed, never silent).

Run: `corepack pnpm --filter @epoch/renderer-fabric test` (19 harness
tests + 8 parity tests). The result is the sealed
`RendererConformanceResult` contract document.

W058/W059 replace the reference adapter instances with REAL engines
behind the SAME seam and re-run the SAME harness — the conformance checks
are renderer-agnostic by construction.

## Honest scope (what W056 is NOT)

- NO Three.js, NO Babylon.js, NO GPU code, NO browser surface — those are
  W058/W059 (and the E2E/visual-smoke batteries of W060/W061).
- The reference adapter draws nothing; its "presentation" is a typed
  in-memory index of presented semantic entities.
- Everything is double-tested through real product machinery (real
  capability registry, real W013 admission, real W016 compiler), but no
  real renderer evidence exists yet — that is exactly the W058/W059/W061
  acceptance surface.
