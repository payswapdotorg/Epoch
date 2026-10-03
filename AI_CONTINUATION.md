# Epoch Stateless Continuation — CURRENT

Fresh-session rule: recover project state from repository state and live GitHub state only.

## Current authoritative baseline

- main state: ACR-005 productization COMPLETE (W001-W050, 50/50); ACR-006 COMPLETE at the credential boundary; ACR-007 CLOSED; ACR-008 CLOSED (W062); ACR-009 CLOSED (W063 — the desktop installable artifacts: linux built-in-sandbox, windows built-in-sandbox-cross, macos ci-recipe-delivered; the release manifest carries the real records; the canonical recipes in .github/workflows/release-desktop-native.yml). ACR-007 (Interactive World Runtime & Multi-Renderer Fabric, X2.0) CLOSED: W056 (the frozen fabric contract) -> W057|W058|W059 (the workspace + both real engine adapters, concurrent) -> W060 (the Blender sidecar + the glTF bridge) -> W061 (the final closure: the real renderers behind the interactive world, the 18-leg browser battery over real software GL). ACR-008 (the W016 marker-time defect closure — no architecture change, no lock transition) delivered by W062, the single serialized work order: closes at merge; the frontier then returns to EMPTY.
- architecture: E1.0/X1.0 invariants remain binding; the experience version is X2.0 (ACR-007 effective; it introduces no semantic authority — it concretizes the Experience/Renderer capability boundary). ACR-008 restores already-specified behavior (the numeric (atMs, markerId) timeline-marker ordering) — no version bump of any kind.
- frontier: EMPTY at the W067 merge + the foundation reconcile (fffd897, 2026-10-03) — W001-W068 COMPLETE (68/68); ACR-010 CLOSED COMPLETE (W065 the fabric contract v1.2.0 + W066 the bind kind + W067 the in-page closure with the leg-14 battery REAL incl. the RAN-LIVE-GREEN Blender variant); ACR-011 CLOSED COMPLETE (W068: both sidecar defects closed, the live battery GREEN, the CI sidecar-Python guard); post-program work requires a NEW ACR per spec/architecture-lock.md
- current work: NONE beyond the W062 merge itself (the worker never merges — the TL reviews). Standing operator actions (recorded honestly, never fabricated): (1) ACR-006 post-credential deployment verification — provider credentials (Vercel/Neon/R2/Apify) per docs/journeys/production.md §post-credential procedure; (2) CLOSED at W064 (2026-10-03) — the Blender REAL-binary live battery RAN against the official Blender 4.2.11 LTS (operator-supplied binary, never bundled; sha256 + URL in docs/rendering/blender.md) and FAILED-live honestly: the probe PASSES, the render/export legs FAIL on the ledgered sidecar `require()` arity defect (docs/journeys/interactive-world.md defect ledger — OPEN, remediation is Tech Lead scope; W064 is docs-only); CI evidence remains the committed double (no regression: 40 passed + 3 env-gated skips).
- credential boundary: NO provider credentials exist (Vercel/Neon/R2/Upstash/Apify are operator input); work orders deliver to the boundary and record VERIFIED/NOT-VERIFIED honestly; never fabricate deployment URLs.

## Recovery reading order

1. AGENTS.md
2. spec/architecture-lock.md
3. spec/architecture-change-requests/ACR-010-in-page-foundation-asset-path.md (the ACTIVE program) + ACR-007-interactive-world-renderer-fabric.md (the closed X2.0 program whose leg-14 ledgered disposition ACR-010 delivers)
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

NONE — ACR-010 and ACR-011 are both CLOSED COMPLETE (W001-W068, 68/68; the frontier is EMPTY at fffd897). The only pending actions are OPERATOR INPUT: (1) provider credentials (Vercel/Neon/R2/Apify) for the ACR-006 post-credential deployment verification per docs/deployment/*.md (the procedure is verification of the already-built system, not new work orders); (2) GPU rasterization is impossible in this sandbox (the browser batteries run REAL software GL via SwiftShader ANGLE — honest permanent NOT-VERIFIED). The Blender live battery is now GREEN and CI-guarded (W068; the official 4.2.11 live evidence in docs/rendering/blender.md); the leg-14 in-page path is REAL on web + desktop (W067).

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
- The 18-leg closure battery ran in a REAL browser (production build) over real software GL: 3 passed / 2 honest skips. Leg 14 (the in-page external foundation path) is honestly NOT-RUNNABLE — bindAsset is adapter-seam-scoped in the frozen contract v1.1.0 and no Blender binary exists here; the path is proven at its real surface (qa/foundation-renderers). The W016 marker-time P2 is CLOSED at W062/ACR-008: the comparator in packages/world-experience/src/timeline.ts compares atMs numerically (lexicographic markerId tie-break), the pinned known-issue battery flipped into the closed-defect regression record, and the focused comparator regression pins the ordering at the schema seam.
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