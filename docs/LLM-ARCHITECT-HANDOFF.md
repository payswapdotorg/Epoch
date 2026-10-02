# Epoch — Successor LLM Architect / Tech Lead Handoff

## Mission

Epoch's program roadmap is COMPLETE: W001-W061 (61/61). The ACR-005 productization program (W046-W050) delivered the three-client product; ACR-006 (W051-W055) delivered public-deployment engineering to the credential boundary; ACR-007 (W056-W061) delivered the interactive world — the real cross-client experience with two real engines behind the frozen seam — and is CLOSED. The repository remains the sole durable source of truth for future architecture and implementation. Any new program requires a new ACR per spec/architecture-lock.md.

## Current verified state

- Architecture: E1.0/X1.0 invariants remain binding; the experience version is X2.0 (ACR-007 effective — it introduces no semantic authority; it concretizes the Experience/Renderer capability boundary).
- Work Order schema: WO2.0.
- W001-W061: COMPLETE (61/61). ACR-007 branch base (the W061 closure branch point): `7dad912d8fef9d4fa1cfcf50d18ccac2fb7024bd`.
- Frontier: EMPTY — the program is closed; post-program work requires a new ACR.
- The interactive world (the ACR-007 closure): web `/world` + the desktop world section compose the REAL `@epoch/world-runtime` over the REAL `RendererFabric` with Three.js `0.186.1` (MIT) and Babylon.js `@babylonjs/core 9.29.0` (Apache-2.0) both live behind the frozen W056 `RendererAdapter` seam (contracts/renderers v1.1.0), the contract-only reference adapter as the declared fallback. The 18-leg closure battery ran in a REAL browser over real software GL (SwiftShader ANGLE — real Chromium, real WebGL, honestly presented as software rasterization; the battery asserts the renderer string): 3 passed / 2 honest skips. Renderer switching carries the canonical world digest/tenant (proven deterministically by qa/rendering and in the browser). The Blender sidecar + the glTF 2.0 bridge (W060) are behind the same seam. Full records: docs/journeys/interactive-world.md + docs/rendering/closure.md.
- Honest NOT-VERIFIED-live ledger: the Blender REAL binary (env-gated live battery — no Blender binary in the sandbox; CI evidence is the committed Node CLI double); any leg-14 in-page asset-binding path (bindAsset is adapter-seam-scoped in the frozen contract v1.1.0 — a fabric-level orchestration would be a CONTRACT CHANGE for a future ACR; the path is proven at its real surface by qa/foundation-renderers); GPU rasterization (no GPU in the sandbox — nothing is claimed as a GPU run); the public deployment (carried from ACR-006: awaits operator provider credentials; never fabricated).
- Credential boundary: real provider provisioning (Vercel/Neon/R2/Upstash/Apify) requires operator-owned credentials; record VERIFIED/NOT-VERIFIED honestly; never fabricate deployment URLs.

## Read first

1. AGENTS.md
2. spec/architecture-lock.md (the ACR-007 section + the X2.0 lock transition)
3. spec/PROJECT-STATE.md
4. spec/development-state/program-state.json
5. spec/development-state/frontier-state.json
6. spec/development-state/dependency-state.json
7. spec/development-state/checkpoint-state.json
8. spec/work-items.md
9. spec/dependency-graph.md
10. docs/rendering/ (renderer-fabric-contract.md + the per-engine records + closure.md)
11. docs/journeys/interactive-world.md (the final 18-leg battery record)
12. spec/journey-validation.md
13. spec/productization-architecture.md
14. release/clients/release-manifest.json
15. live GitHub state

## Product reality

Three clients now exist as product implementations over the shared Epoch authorities:

```
             EPOCH AUTHORITATIVE SERVICES
                       |
               Application Gateway
                       |
       +---------------+---------------+
       |               |               |
      Web           Desktop          Mobile
   Next.js/React    Tauri 2          Expo/RN
       |               |               |
       +---------- shared contracts ---+
                       |
             PostgreSQL / object bytes
```

Authority rules remain unchanged:

- World Model = world truth.
- SolutionPackage/SolutionVersion = solution intent/baseline.
- DeliveryRecord = delivery state.
- ProgramOfWork = schedule authority.
- Constraint Engine = constraint authority.
- Action Gateway = execution authority.
- Simulation = prediction.
- Evaluation = judgment.
- Verification/Evidence = proof.
- Experience/client state = projection.
- Local cache/queue = replay/session/projection only.

No client or native host may become a second semantic authority.

## ACR-005 closure evidence

### W046 — Shared Product Runtime + Application Gateway ✅

Merged PR #100 plus foundation reconcile PR #101.

Delivered the shared client-facing gateway, persistence/object-storage/authentication seams, tenant-safe propagation, idempotency/correlation, recoverable errors and deterministic fixtures.

### W047 — Web Product + Browser Journey Validation ✅

Merged PR #107 plus reconcile PR #108.

Delivered the canonical web product and browser journey validation. Final evidence recorded J01-J12 production-build execution and closed the discovered P1/P2 defects with regression coverage.

### W048 — Desktop Native Product + Desktop Journey Validation ✅

Merged PR #109 plus reconcile PR #111.

Delivered the Tauri 2 desktop product for Linux/Windows/macOS, desktop journey harnesses and native/package definitions. One environment-dependent harness-resolution issue was caught through require-changes and fixed before merge.

### W049 — Mobile Native Product + Mobile Journey Validation ✅

Merged PR #104 plus reconcile PR #105.

Delivered the Expo/React Native Android/iOS product, offline/reconnect and field journey harnesses. Platform packaging is recorded honestly as config-delivered where Android SDK/Xcode infrastructure was unavailable in the execution environment.

### W050 — Cross-Platform Release + Journey Closure ✅

Merged PR #113 at `4ae6545e`, followed by governance advance PR #114 at `598210a2`.

Final evidence:
- 245/245 independent battery tasks green at a fresh clone.
- 4/4 CI checks green in both push and pull-request contexts.
- Cross-platform harness covering digest continuity, cross-device sessions, capture continuity, approval continuity, offline no-drift and release identity.
- 15 program defects closed; 0 unresolved P0/P1.
- Six-platform release identity manifest with honest environment gaps.
- Final journey/release documentation complete.

The W050 worker-dispatch infrastructure was destroyed by a sandbox reset, so the Tech Lead executed W050 directly. This deviation is explicitly recorded in the repository. Verification remained real: actual product engines, fresh-clone reproduction, GitHub CI and honest release-manifest status.

## ACR-007 closure evidence (the interactive world, W056-W061)

### W056 — Renderer Fabric & Multi-Renderer Switching Contract ✅

Merged PR #130 plus the lockfile-registration reconcile. Delivered the frozen `RendererAdapter` seam + `contracts/renderers` v1.1.0 (session/snapshot/switching, typed failures, the shared conformance fixture) and the fabric runtime.

### W057 — Interactive World Workspace ✅ / W058 — Three.js Adapter ✅ / W059 — Babylon.js Adapter ✅ (the concurrent wave)

Merged PRs #134, #133, #132 (all 7-gate green) plus the foundation reconcile PR #135. W057 delivered `@epoch/world-runtime` + the web world feature + the desktop world-host wiring + the qa/world-experience journey harness. W058 delivered `@epoch/adapter-renderer-threejs` (three 0.186.1, Raycaster semantic picking, 58/58). W059 delivered `@epoch/adapter-renderer-babylonjs` (@babylonjs/core 9.29.0, scene.pick, NullEngine conformance, 64/64).

### W060 — Foundation Renderer & Asset Bridges ✅

Merged PR #136 plus the foundation reconcile PR #137. Delivered `@epoch/adapter-foundation-gltf` (the validated interchange bridge, 84/84) and `@epoch/adapter-renderer-blender` (the offscreen sidecar behind a typed process boundary, 40 passed + 3 env-gated live skips; GPL separate-executable posture recorded).

### W061 — Multi-Renderer Integration & Interactive World Closure ✅

The final closure (this branch's PR): the real renderers behind the interactive world on both clients, the 18-leg browser closure battery over real software GL (3 passed / 2 honest skips), the direct Three⇄Babylon engine-pair battery + the forced degradation/failure/fallback ladder (qa/rendering), two P1 bring-up defects closed with the full discipline chain, the W016 marker-time P2 precisely repro'd + ledgered (advisory), the X-06 release-manifest re-stamp, and the final journey/rendering closure records.

## Release reality

`release/clients/release-manifest.json` is the authoritative release-identity record.

The current repository does NOT prove that Epoch is deployed to a public web/Vercel URL or that native installers/APK/iOS artifacts have been uploaded to distribution channels. It proves that the product implementations, build definitions, journey validation and release-identity records are complete, with environment gaps explicitly declared.

## Future work rule

Do not dispatch anything from the old graphs (ACR-005/006/007 are complete). A new semantic subsystem, product surface or architecture change requires:

1. architecture impact analysis;
2. a new ACR;
3. updated architecture/lock state;
4. a new Work Order graph;
5. explicit frontier state.

Recorded future-ACR candidates (advisories, never silent scope): a fabric-level asset-binding orchestration (the leg-14 contract-scope advisory from W060/W061 — `bindAsset` is adapter-seam-scoped in the frozen v1.1.0); the W016 marker-time numeric-aware comparator (the W057-discovered P2, precisely repro'd and pinned by the qa/world-experience known-issue battery); additional renderer foundations (the candidates table in docs/rendering/renderer-matrix.md).

The completion oracle remains:

`Git + CI + product/journey evidence, not chat.`


## W063 addendum (ACR-009 — the desktop installable artifacts)

The release identity rule you own now carries REAL desktop artifacts: linux built-in-sandbox
(AppImage + deb), windows built-in-sandbox-cross (mingw-w64 gnu; deviations enumerated; canonical
msvc recipe delivered), macos ci-recipe-delivered (the dispatch workflow; never a fabricated DMG).
Regeneration stays deterministic at the delivery head; the canonical recipes live in
`.github/workflows/release-desktop-native.yml` and are NOT the release gate. The first packaged
builds closed D-1..D-4 (docs/journeys/defect-ledger.md). Platform toolchains remain adapters,
never authorities (lock rule 13) — everything here is packaging evidence and release identity.
