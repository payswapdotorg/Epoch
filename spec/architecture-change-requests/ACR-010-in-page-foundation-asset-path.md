# ACR-010 — In-Page Foundation Asset Path (Fabric-Level Asset Binding)

**Status:** EFFECTIVE (activation recorded 2026-10-03)
**Approved:** 2026-10-03 — operator standing continuation directive ("continuous resident watch... monitor → harvest → review → approve/require-changes → dispatch next, until the roadmap is complete. No early returns."); the frontier was EMPTY at the W063 merge (12b5f22); this program delivers the ledgered leg-14 disposition recorded by the W060 advisory and the W061 closure records
**Activation:** EFFECTIVE 2026-10-03 (W064 — the Blender live-battery verification closure — runs concurrently; its surfaces are docs-only and disjoint)
**Target experience version:** X2.0 (unchanged — no new semantic authority; this concretizes the Experience/Renderer capability boundary exactly as ACR-007 did)
**Work Orders:** W065-W067

## Why this exists

The W061 closure battery records leg 14 (the external foundation path in-page) as an
honest NOT-RUNNABLE skip with two precise reasons:

1. `bindAsset` is adapter-seam-scoped in the frozen RendererAdapter contract v1.1.0 —
   the fabric exposes no session-asset binding operation, so the `/world` host
   composition has no in-page path from a validated foundation asset to a live
   session. The W060 advisory ledgered this as "a fabric-level orchestration would be
   a CONTRACT CHANGE for a future ACR".
2. No Blender binary existed in the execution sandbox (the live sidecar battery is
   env-gated). W064 supplies the official binary and closes the live-adapter-surface
   evidence; this ACR closes the in-page architecture.

The path is already proven at its real surface: `qa/foundation-renderers` (glTF →
validate → sealed binding → `bindAsset` on REAL Three.js and Babylon.js adapter
sessions; 84/84 + the 15-test negative battery). What is missing is the in-page
composition: a fabric-level operation, a typed interaction kind, and the host path.

## The change

Three additive surfaces, no break anywhere:

1. **RendererAdapter contract v1.1.0 → v1.2.0 (W065).** The fabric gains
   `bindSessionAsset(input: { sessionId, binding, atMs }) →
   FabricResult<RendererAssetBindingReceipt>` — a fabric-level orchestration that
   composes the EXISTING adapter-seam `bindAsset`: session resolution → adapter
   capability/asset-kind check → adapter-seam application → typed, content-addressed,
   tenant-scoped receipt. The optional adapter-seam `bindAsset` itself is UNCHANGED
   (both real adapters and the reference adapter already implement it). The receipt
   is digest-addressed (the sealed binding's digest), carries the adapter's
   rendererId and the applied/declined outcome, and refuses typed on: unknown
   session, undeclared asset kind, tenant-scope mismatch, adapter refusal.
   `manifest.json` contractVersion moves to 1.2.0; protocolVersion and
   fabricProtocolVersion are UNCHANGED (additive operation, no protocol break).

2. **The `bind` interaction kind (W066).** The closed world-interaction vocabulary
   (packages/world-experience `WORLD_INTERACTION_KINDS`) gains `bind`. The intent
   payload carries a VALIDATED binding REFERENCE (the sealed binding's content
   address + tenant scope) — never untrusted raw bytes; the trust gate stays
   upstream in the glTF bridge (validate → normalize → content-address → seal).
   Admission follows the canonical path; the effect is `binding-requested` — an
   experience-scoped presentation effect like the existing effect-only intents. It
   never awaits a semantic authority and never mutates durable semantic state (the
   existing negative battery already pins this; W066 re-pins it at the admission
   seam). The canonical world digest is UNCHANGED by a binding (pinned by
   qa/foundation-renderers; re-pinned at the admission seam). The ControlIntent
   bridge version (`WORLD_INTENT_TYPE_VERSION`) moves 1.0.0 → 1.1.0 (additive
   kind).

3. **The in-page path + the leg-14 closure (W067).** The world runtime applies the
   `binding-requested` effect through the W065 fabric operation. The web `/world`
   host and the desktop world section expose an Epoch-owned import affordance (no
   vendor UI): import a glTF/GLB → bridge validate/seal → typed `bind` intent →
   receipt + the digest-addressed bound-asset ledger presented. The j13-world
   battery's leg 14 becomes REAL: in-page import → typed bind → assertions (sealed
   digest, ledger digest-addressed, semantic entity ids unchanged, world digest
   unchanged, typed receipt in the journal). The Blender-live variant (sidecar
   export → UNTRUSTED re-entry → validated binding → in-page bind) rides the
   env-gated binary per the W064 method — honestly env-gated in the e2e battery
   (skipped without the binary, run with it).

## Architecture (unchanged authorities)

```
glTF bridge (trust gate: validate → normalize → content-address → seal)
      |
      v  sealed RendererAssetBinding (digest-addressed, tenant-scoped)
typed `bind` intent (canonical admission; effect: binding-requested)
      |
      v
world runtime (presentation application)
      |
      v
RendererFabric.bindSessionAsset  (v1.2.0 — composes the adapter seam)
      |
      v
adapter-seam bindAsset (UNCHANGED; Three.js / Babylon.js / reference)
```

Binding is presentation. The bound-asset ledger is digest-addressed experience
state. Provider-native asset files never become Epoch semantic authority. The
Action Gateway, Constraint Engine, World Model and Verification planes are
untouched. No second lifecycle, semantic ledger, or client authority.

## Acceptance

- W065: contract v1.2.0 frozen-first + the fabric operation proven over the
  reference adapter deterministically; typed refusals for every negative path;
  the renderer-fabric battery green (baseline + new); renderer-runtime battery
  untouched-green.
- W066: the `bind` kind admitted through the canonical path; `binding-requested`
  effect recorded; world digest invariance + no-durable-mutation pinned by
  negative tests; the world-experience battery green (baseline + new).
- W067: the in-page path live on web + desktop through the REAL seam; leg 14 of
  the j13-world battery REAL (the glTF-bridge path) with the env-gated
  Blender-live variant honestly marked; the degradation path (no-GL/reference
  fallback binding) asserted; the closure records updated
  (docs/journeys/interactive-world.md leg-14 verdict flip + ledger,
  docs/rendering/closure.md program record).

## Version / lock record

- E1.0 invariants: binding, unchanged.
- Experience version: X2.0, unchanged (capability-boundary concretization, same
  class as ACR-007; no semantic authority introduced).
- contracts/renderers: contractVersion 1.1.0 → 1.2.0 (additive);
  protocolVersion 1.0.0 and fabricProtocolVersion 1.0.0 unchanged.
- world-experience: WORLD_INTENT_TYPE_VERSION 1.0.0 → 1.1.0 (additive kind);
  package semver minor bump per house convention.
- No lock transition. No new dependencies (W065/W066/W067 use only registered
  workspace packages). Root manifests/lockfiles untouched by workers.

## Frontier update

At activation: W065 ELIGIBLE + W066 ELIGIBLE (pairwise-disjoint surfaces:
contracts/renderers + packages/renderer-fabric vs packages/world-experience;
concurrent with W064 whose surfaces are docs-only and disjoint). W067
READY_AFTER W065 + W066. Maximum three concurrent workers respected.

## Honest boundaries

- The Blender-live variant of leg 14 remains env-gated evidence (operator-supplied
  binary at an ephemeral path; live evidence, never claimed as CI). GPU
  rasterization remains impossible in this sandbox and no run here is ever claimed
  as one.
- The trust gate is NOT weakened: only sealed, content-addressed, tenant-scoped
  bindings can be referenced; untrusted bytes remain typed refusals (the negative
  battery stays green).
