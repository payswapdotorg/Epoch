# Epoch Architecture Lock E1.0 / X1.0

1. World Model is semantic authority.
2. Agents never become semantic authority.
3. Actions execute only through Action Gateway.
4. Constraints are authoritative in Constraint Engine.
5. Simulators remain external capabilities.
6. Evaluation is distinct from simulation.
7. Verification/Evidence is first-class.
8. Experience is a projection, never a second source of truth.
9. Extensions are capability-scoped.
10. Public arbitrary code is sandboxed.
11. Marketplace entitlement is separate from payment processor state.
12. Identity, tenancy, authorization and policy are distinct.
13. Provider-specific behavior is adapterized.
14. Web/desktop/mobile share semantic contracts.
15. PostgreSQL is durable authoritative state for v1.
16. One responsibility has one authority.

## Approved architecture targets and lock transition record

ACR-001 was approved on 2026-09-24. It adds Solution Delivery, Program of Work, Resource Acquisition/Procurement, Realization/Execution, Actualization, Outcome Learning, Fine-Grained Access Projections, Supervision/Alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter.

ACR-002 clarifies the same target as a universal engineering lifecycle and Solution Navigator with domain packs as projections of the canonical lifecycle. It does not introduce a second authority or new parallel runtime.

ACR-003 was approved on 2026-09-24. It establishes the Capability Foundation Policy: mature open-source engineering products are replaceable capabilities behind the Capability/Adapter Fabric, not Epoch semantic authorities. Integrate before forking; any fork requires an Architecture Change Request plus explicit license/dependency, isolation, divergence and upstream/reconciliation planning.

### Lock transition — recorded 2026-09-29 (Tech Lead, with the ACR-004 review-rebase of PR #76)

1. The ACR-001/ACR-002/ACR-003 targets are DELIVERED: their implementation program W036-W044 is complete on main (final merge W025, PR #93 squash cfaf5c42; program 44/44; all CI green). The E1.0/X1.0 numbered invariants above remain binding — the ACR targets extend them and introduce no second authority.
2. The ACR-001/ACR-002/ACR-003 targets are EFFECTIVE for all new implementation from this transition forward. The historical gating text ("remains E1.0/X1.0 for the currently authorized W009/W011 wave") is superseded and retired.
3. ACR-004 (approved 2026-09-27, ratified by this review) is EFFECTIVE at this same transition. Its implementation entry point is W045 (Autonomous Role & Capability Discovery), defined in spec/work-orders/W045-autonomous-role-capability-discovery.md with all dependencies complete. Frontier update: W045 ELIGIBLE.
4. ACR-003's capability-foundation policy is binding capability policy from this transition (as required at the original approval).

Forbidden without an Architecture Change Request:
- second world database/ledger/lifecycle authority;
- provider semantics in kernel types;
- direct agent-to-durable-state mutation;
- UI-as-authority;
- unrestricted public extension host access;
- vertical frontend forks;
- silent new domains/subsystems;
- promotion of a third-party editor/CAD/game/simulation/IDE project into Epoch's semantic authority;
- source-level fork of a third-party foundation without the ACR-003 fork gate.

ACR-004 was approved on 2026-09-27. It establishes the universal Role & Capability Discovery Plane and scheduled ecosystem discovery. It adds no lifecycle authority.

An Architecture Change Request requires impact analysis, revised acceptance criteria, version/lock update, and frontier update before implementation.

## Universal-domain invariants

- The lifecycle spine is Understand → Decide → Plan → Acquire → Realize → Observe/Actualize → Verify → Forecast → Close → Learn.
- Acquire and Realize are universal concepts; procurement and execution are domain/profession projections.
- Domain packs may specialize representation and capability use, but may not define competing lifecycle, schedule, baseline, delivery, actualization, verification or learning authorities.
- The Solution Navigator is a synchronized projection, not a new semantic store.
- Third-party foundations remain capability providers behind declared boundaries.
- Provider-native project files, scene graphs, repositories, solver state and editor timelines are not Epoch semantic authority.

## Autonomous-discovery invariants

- Task-specific roles are derived from evidence and capability demands, not model names.
- Domain packs may provide reusable role/capability templates, but the universal discovery plane owns task-specific organization construction.
- External discovery may enrich candidate capability knowledge but may not alter authoritative state merely from external claims.
- Untrusted model/code artifacts remain outside the Epoch trust domain until applicable sandbox/security gates pass.
- Discovery does not grant execution authority.


## ACR-005 — Productization, Native Clients & Journey Validation

ACR-005 is EFFECTIVE (2026-09-29). It introduces no semantic authority. It productizes the existing architecture through one client-facing Application Gateway, authoritative persistence adapters, the canonical web application, native desktop/mobile hosts, release automation and mandatory real-product journey validation.

Binding implementation: W046-W050. W046 freezes shared client/runtime contracts; W047/W048/W049 are pairwise-disjoint platform implementations; W050 is serialized cross-platform hardening and release closure.

Platform technologies are adapters, not semantic authorities: Next.js/React remains the canonical web client; Tauri 2 hosts desktop; Expo/React Native hosts mobile. E1.0/X1.0 authority invariants remain binding.

A client cache/queue is projection/replay state only. A UI/native host may not become a second World, Solution, Delivery, Verification or Learning authority. Journey closure requires a built/running artifact plus reproduce -> regression test -> fix -> rerun evidence.

## ACR-006 — Public Deployment, Free-Tier Infrastructure & Production Operations

ACR-006 is EFFECTIVE (2026-10-02, operator directive). It introduces NO semantic authority and no lock transition: E1.0/X1.0 invariants remain binding. It authorizes the public deployment program W051-W055 that makes the completed product (W001-W050) publicly deployable and actually accessible over the internet on free-tier infrastructure (Vercel/Neon/Cloudflare R2/Upstash/Apify as infrastructure adapters behind provider-neutral ports).

Binding rules added by ACR-006:

- No provider becomes a semantic authority. Neon = persistence implementation; R2 = object-byte implementation; Upstash = ephemeral cache/rate-limit implementation; Apify = external-source acquisition adapter; Vercel = runtime host.
- Redis never holds authoritative durable state; R2 stores bytes, not semantic truth; Apify output is untrusted adapter input with provenance.
- The Application Gateway remains the only client-facing boundary; the public web deployment binds it in-process; no second backend.
- Zero new runtime dependencies; production environment contract with placeholders only; no secret values in Git.
- Production profile fails closed on missing durable persistence; security gates never fail open; optional capabilities degrade gracefully.
- Deployment URLs/identifiers are recorded only after verification; never fabricated.

Binding implementation: W051 (serialized foundation) → W052/W053/W054 (concurrent, pairwise-disjoint) → W055 (serialized closure). See spec/architecture-change-requests/ACR-006-public-deployment.md and the ACR-006 sections of spec/work-items.md and spec/dependency-graph.md.


## ACR-007 — Interactive World Runtime & Multi-Renderer Fabric

ACR-007 is APPROVED_STAGED (2026-10-02). It targets X2.0 and activates after ACR-006/W055 completion plus a recorded lock transition.

It introduces no semantic authority. It concretizes the existing Experience/Renderer capability boundary so Epoch can use interchangeable rendering foundations without exposing their applications as the primary product surface.

Binding rules:

- the World Model remains semantic authority;
- World Experience remains a projection;
- Renderer Fabric/session state is ephemeral and non-authoritative;
- renderer switching reconstructs presentation from canonical Epoch projection data;
- canonical world identity/digest, tenant, semantic focus/layers and portable presentation state survive switching;
- renderer input becomes existing typed Epoch intents;
- Action Gateway and Verification/Evidence authorities remain unchanged;
- external foundations are provider capabilities behind adapters;
- no vendor editor UI is required for the core user workflow;
- renderer-specific scene graphs/caches/handles are never semantic state.

Initial interactive backends: Three.js and Babylon.js embedded in the Epoch-owned surface. Blender is an external sidecar/high-fidelity capability. Godot/O3DE and other specialized foundations remain candidate capabilities subject to the existing capability-foundation/fork gates.

Binding implementation: W056 -> (W057|W058|W059) -> W060 -> W061.

### Lock transition — recorded 2026-10-02 (Tech Lead, X2.0 activation)

1. ACR-006/W055 is COMPLETE at the credential boundary (final merge bd6bdbe; engineering complete, live deployment pending operator credentials — honestly recorded, never fabricated as deployed).
2. The staged-successor gate in `spec/development-state/staged-successor.json` is satisfied: the Tech Lead records the **X2.0 lock transition**. The experience version is X2.0 from this transition forward. The E1.0/X1.0 numbered invariants above remain binding — ACR-007 extends them and introduces no second authority.
3. ACR-007 is **EFFECTIVE**. Its implementation entry point is W056 (Renderer Fabric & Multi-Renderer Switching Contract), defined in `spec/work-orders/W056-renderer-fabric-foundation.md` with its dependency (ACR-006/W055) complete. Frontier update: W056 ELIGIBLE.
4. After W056 merges, the first concurrent wave is W057 | W058 | W059 (pairwise-disjoint ownership surfaces, max three workers). W060 is serialized after all three; W061 is the serialized closure.
5. The ACR-007 non-negotiables are binding: World Model remains semantic authority; renderer sessions are non-authoritative; renderer switching preserves canonical world identity/digest; at least two real interactive renderers; at least one external foundation path; no vendor UI as the primary Epoch surface.

## ACR-008 — Marker-Time Ordering Defect Closure

ACR-008 is APPROVED (2026-10-02). It is a defect-closure program: it introduces NO architecture change, NO new semantic subsystem, and NO lock transition. The E1.0/X2.0 numbered invariants above remain binding and unchanged.

It closes the ledgered W016 marker-time P2 defect (observed W057; recorded in docs/journeys/interactive-world.md; reproduced in qa/world-experience/w016-marker-time-known-issue.test.ts): `packages/world-experience/src/timeline.ts` compares `${atMs}\u0000${markerId}` STRING keys, so mixed-digit-width marker times mis-sort lexicographically — numerically ascending timelines are refused, numerically descending timelines are admitted with a wrong timeline end bound.

The binding fix restores the ALREADY-SPECIFIED numeric `(atMs, markerId)` ordering (numeric atMs; lexicographic markerId tie-break; duplicate-free unchanged). No schema/contract version bump. The pinned known-issue battery flips by design into the regression battery; the defect-ledger entry closes with the fix -> rerun -> close chain.

Binding implementation: W062 (single work order, single worker, serialized), `spec/work-orders/W062-marker-time-comparator.md`, depends on ACR-007/W061 (complete). After W062 merges, ACR-008 closes and the frontier returns to EMPTY; any further program again requires a new ACR.

## ACR-009 — Desktop Installable Artifacts

ACR-009 is APPROVED (2026-10-02). It is a productization/release program: NO architecture change, NO new semantic subsystem, NO lock transition. The E1.0/X2.0 numbered invariants above remain binding and unchanged. Lock rule 13 (platform toolchains are adapters, never semantic authorities) is the governing rule: everything W063 produces is packaging evidence and release identity, never semantic state.

It closes the declared W048 boundary (config-delivered packaging with the environment gap honestly recorded) by provisioning the toolchains and producing the real installable artifacts for the three desktop platforms, re-stamping `release/clients/release-manifest.json` with the real records (file, bytes, sha256, producedBy, declared deviations), and delivering the canonical recipes as a dispatch-only workflow (`windows-latest` msvc NSIS, `macos-14` dmg+app) that is NOT the release gate — the standard ci.yml battery remains the sole gate.

Binding implementation: W063, the single serialized work order, `spec/work-orders/W063-desktop-installable-artifacts.md`, depends on ACR-008/W062 (complete). The defects the first packaged builds exposed (D-1..D-4) close with the public discipline chain in `docs/journeys/defect-ledger.md`. The committed tree never carries build-local adaptations; every cross-compile deviation is reverted and recorded.
