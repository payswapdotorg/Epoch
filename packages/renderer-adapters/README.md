# @epoch/renderer-adapters

Epoch Renderer Adapters kernel (Work Order **W019**, experience layer) —
the **renderer-side half of Renderer/Device Adaptation**: the
provider-neutral adapter seam the W013 renderer-runtime pin reserved for
this Work Order ("concrete engines are future adapters behind the
descriptor contract"; spec/experience-architecture.md "Rendering":
"Renderer abstraction permits other local/remote renderers").

## What this package owns

- **The neutral renderer-technique vocabulary and catalog**
  (`RENDERER_TECHNIQUES`, `RENDERER_TECHNIQUE_CATALOG`) —
  `immediate-2d`, `retained-scene-3d`, `stereoscopic-compositor`,
  `remote-stream`: TECHNIQUES (immediate vs retained, local vs remote,
  mono vs stereoscopic), never vendors/engines/APIs. Concrete engines
  bind to a technique at the client surface; zero engine imports, zero
  GPU code, zero UI-framework dependencies (lock rule 13).
- **Deterministic adapter selection** (`selectRendererAdapter`) over a
  sealed W013 `RendererBinding` plus a sealed W019
  `DeviceCapabilityAssessment`: the chosen technique, the typed reason,
  the ordered fallback chain, and the FULL decision trace (every
  candidate technique with its typed eligibility verdict — the frozen
  device-adaptation table rendered as logic). Decision-input integrity
  is enforced: the assessment must assess EXACTLY the binding's device,
  and both inputs must carry genuine content digests (tampered inputs
  are typed rejections).
- **Typed mount plans** (`planMount`, `mountEnvelopeOf`) — adaptation
  data for mounting one content revision (typically a progressive-scene
  rung) through the unchanged W013 `mount-graph` path; the projected
  envelope is validated by the REAL W013 invocation schema.
- **Append-only adaptation events** over the mirrored W010 shapes
  (`renderer-adapter:*` open namespace): technique selections and mount
  plans become FACTS on one deterministic stream per renderer session.
  `@epoch/event-log` stays a devDependency — type parity via
  `src/kernel-parity.ts` (type-equality with `EventContent`) and runtime
  parity tests (the REAL W010 seal path admits the mirrored events and
  digests them identically) — never a runtime edge.

## The deterministic decision rules (fixed precedence)

0. **Integrity** — the assessment must assess the binding's device
   member-for-member; both inputs' digests are verified;
1. **Remote assist** — when the assessment recommends the optional
   remote path AND the remote technique is eligible → `remote-stream`;
2. **Stereoscopic** — when the binding negotiated stereo output AND the
   compositor is eligible → `stereoscopic-compositor`;
3. **Spatial** — spatial graph kinds → `retained-scene-3d`
   (`spatial-kinds-local`, or `spatial-kinds-local-degraded` on a
   reduced-tier device — the frozen "low capability = 2D/reduced 3D"
   row, pairing with @epoch/progressive-scene degradation);
4. **Flat** — flat kinds only → `immediate-2d`;
5. **Fallback** — the optional remote path when no local technique
   hosts the effective kinds; a typed `no-eligible-technique` rejection
   when nothing hosts them (never a guess).

Eligibility (recorded per candidate in the trace): kind coverage
(`kind-not-hosted`), stereo support vs negotiated stereo
(`stereoscopic-unsupported` / `stereoscopic-unmatched`), preference.

## Non-negotiables

- **Techniques, never engines** (lock rule 13): strict zod objects
  reject vendor fields; the catalog names rendering strategies only.
- **Determinism**: zero wall-clock, zero randomness, zero I/O; the same
  binding + assessment + selection id always yields the byte-identical
  content-addressed record. Event instants are producer-supplied.
- **Tenant isolation (R12)**: selections and plans adopt the binding's
  tenant scope; cross-tenant operations are typed
  `cross-tenant-denied` rejections.
- **Execution, never authority** (lock rules 3/8/16): the seam emits
  typed data (selections, plans, envelopes, events); it never authors
  presentation semantics and never becomes a second authority.

## Runtime dependencies

`@epoch/agent-protocol` (canonical digest machinery),
`@epoch/experience-protocol` (the W011 vocabulary),
`@epoch/renderer-runtime` (the W013 binding/invocation contracts —
genuine runtime composition), and `@epoch/device-capabilities` (the W019
device-side assessment — sibling composition). Compatibility with
`@epoch/event-log` (the W010 shapes) is pinned via devDependencies +
compile-time parity and runtime parity tests — never runtime deps.

## Composition flow (W019)

```
W019 DeviceCapabilityAssessment ─┐
                                 ├─ selectRendererAdapter ─▶ sealed RendererAdapterSelection
W013 sealed RendererBinding ─────┘          (technique + reason + trace + fallbacks)
                                                    │
                     planMount(selection, graphDigest, declaredUsage)
                                                    ▼
                                     sealed RendererMountPlan ── mountEnvelopeOf ──▶
                                     W013 mount-graph envelope ── admitInvocation [unchanged path]
                                                    │
                                     renderer-adapter:* events (W010 shapes, facts)
```

## Contract surface

Version constants + typed index export (`src/index.ts`), runtime zod
validators (`src/*.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (the W007/W009/W015/
W016 in-package convention). Regeneration:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-adapters test contract-drift
```

## Tests

`pnpm --filter @epoch/renderer-adapters test` — positive, negative,
boundary (tier/reason boundaries, stereo negotiation both sides,
remote-assist thresholds, kind-coverage boundaries), determinism,
provider-neutrality, W010/W013/W019 runtime parity (including the full
select → plan → project → ADMIT round-trip through the REAL W013
hosting surface), and contract drift (129 tests).
