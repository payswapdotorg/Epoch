# Epoch Stateless Continuation — CURRENT

Fresh-session rule: recover project state from repository state and live GitHub state only.

## Current authoritative baseline

- main state: ACR-005 productization COMPLETE (W001-W050, 50/50); ACR-006 public-deployment program COMPLETE at the credential boundary (W051-W055; engineering complete — live deployment verification awaits operator credentials, never fabricated). ACR-007 (Interactive World Runtime & Multi-Renderer Fabric, X2.0) is now CLOSED: W056 (the frozen fabric contract) -> W057|W058|W059 (the workspace + both real engine adapters, concurrent) -> W060 (the Blender sidecar + the glTF bridge) -> W061 (the final closure: the real renderers behind the interactive world, the 18-leg browser battery over real software GL).
- architecture: E1.0/X1.0 invariants remain binding; the experience version is X2.0 (ACR-007 effective; it introduces no semantic authority — it concretizes the Experience/Renderer capability boundary)
- frontier: EMPTY — W001-W061 COMPLETE (61/61); ACR-007 CLOSED; post-program work requires a NEW ACR per spec/architecture-lock.md
- current work: NONE. Standing operator actions (recorded honestly, never fabricated): (1) ACR-006 post-credential deployment verification — provider credentials (Vercel/Neon/R2/Apify) per docs/journeys/production.md §post-credential procedure; (2) the Blender REAL-binary live battery (env-gated: EPOCH_BLENDER_LIVE=1 + EPOCH_BLENDER_PATH + a Blender binary — none exists in this sandbox).
- honest NOT-VERIFIED-live ledger of the closure: the Blender real binary (the CI evidence is the committed Node CLI double — a real subprocess boundary, doubled engine); any leg-14 in-page asset-binding path (bindAsset is adapter-seam-scoped in the frozen RendererAdapter contract v1.1.0 — a fabric-level orchestration would be a CONTRACT CHANGE for a future ACR; the path is proven at its real surface by qa/foundation-renderers); GPU rasterization (the browser battery runs REAL Chromium over REAL WebGL via SwiftShader ANGLE — real GL, honestly presented as software rasterization; no GPU exists in the sandbox and no run is claimed as one).
- credential boundary: NO provider credentials exist (Vercel/Neon/R2/Upstash/Apify are operator input); work orders deliver to the boundary and record VERIFIED/NOT-VERIFIED honestly; never fabricate deployment URLs.

## Recovery reading order

1. AGENTS.md
2. spec/architecture-lock.md
3. spec/architecture-change-requests/ACR-007-interactive-world-renderer-fabric.md
4. spec/PROJECT-STATE.md
5. spec/development-state/program-state.json + frontier-state.json + dependency-state.json + checkpoint-state.json
6. spec/work-items.md (ACR-007 section)
7. spec/dependency-graph.md (ACR-007 section)
8. docs/rendering/ (the fabric contract guide + the per-engine delivery records + closure.md — the program closure record)
9. docs/journeys/interactive-world.md (the final 18-leg battery record)
10. spec/deployment-architecture.md, spec/production-environment.md, spec/free-tier-infrastructure.md (the ACR-006 deliverables)
11. spec/journey-validation.md (J01-J12 + production P01-P18)
12. spec/worker-runbook.md
13. assigned Work Order
14. live GitHub state

## Dispatch

NONE — the program is closed (W001-W061, 61/61; ACR-007 CLOSED; frontier EMPTY). The only pending actions are OPERATOR INPUT: (1) provider credentials (Vercel/Neon/R2/Apify) for the ACR-006 post-credential deployment verification per docs/deployment/*.md (the procedure is verification of the already-built system, not new work orders); (2) optionally a Blender binary for the env-gated live battery (the CI evidence is the committed double). Any new implementation requires a NEW ACR per spec/architecture-lock.md.

One Work Order = one branch = one PR. Workers never merge. Maximum three concurrent workers. Concurrent surfaces must be pairwise-disjoint. Root manifests/lockfiles are serial Tech Lead work.

## Productization reality

ACR-005 is complete: W046-W050 all landed and the real client productization/journey-validation program is closed.

- Web: production product and J01-J12 browser journey validation complete.
- Desktop: Tauri 2 product configuration and journey validation complete; native packaging is config-delivered where a Linux/Windows/macOS host toolchain was unavailable in the execution environment.
- Mobile: Expo/React Native product configuration and journey validation complete; Android/iOS packaging is config-delivered where SDK/Xcode infrastructure was unavailable in the execution environment.
- W050 cross-platform closure: 245/245 independent battery tasks, 4/4 CI checks in both contexts, 15 program defects closed, 0 unresolved P0/P1.

See release/clients/release-manifest.json for the exact platform artifact-status records.

## Interactive-world reality (the ACR-007 closure, W061)

The central Epoch workspace is a real interactive spatial world, on both clients, with BOTH real engines live behind the frozen seam:

- Web `/world` and the desktop world section compose the REAL @epoch/world-runtime over the REAL RendererFabric with Three.js first, Babylon.js second, and the contract-only reference adapter as the declared fallback; switching engines never leaves Epoch and carries the canonical world digest/tenant (proven deterministically AND in the real browser).
- The 18-leg closure battery ran in a REAL browser (production build) over real software GL: 3 passed / 2 honest skips. Leg 14 (the in-page external foundation path) is honestly NOT-RUNNABLE — bindAsset is adapter-seam-scoped in the frozen contract v1.1.0 and no Blender binary exists here; the path is proven at its real surface (qa/foundation-renderers). The W016 marker-time P2 is ledgered with a precise pinned repro; the comparator fix is a future-ACR disposition.
- The full records: docs/journeys/interactive-world.md + docs/rendering/closure.md (license snapshots: docs/rendering/threejs.md, babylonjs.md, blender.md, gltf.md).

## Product journey rule

A passing unit/integration suite is necessary but insufficient.

Every platform run follows:
Observe -> record -> reproduce -> regression test -> fix -> rerun -> close.

Journey evidence lives under docs/journeys/. Large binary traces stay in CI artifacts.

## Architecture invariants

World Model = semantic authority.
Solution/Delivery/ProgramOfWork = their existing authoritative records.
Constraint Engine = constraint authority.
Action Gateway = execution authority.
Simulation = prediction.
Evaluation = judgment.
Verification/Evidence = proof.
Experience/client state = projection.
Local cache/queue = replay/session/projection only.

No second lifecycle, semantic ledger, or client authority.

## Platform choices

Web: existing Next.js/React.
Desktop: Tauri 2 around W017.
Mobile: Expo + React Native around W018.

Platform toolchains are adapters, not semantic authorities.

## Scope discipline

W045 advisory questions are not part of ACR-005.
Any new semantic subsystem requires a new ACR + Work Order program.

Git + CI + journey evidence, not chat, is the completion oracle.


Historical recovery notes from earlier waves remain in PROJECT-STATE.md and Git history.