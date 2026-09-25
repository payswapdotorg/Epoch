# @epoch/world-experience — Interactive World UX (W016, experience layer)

The interactive-world DOMAIN MODEL of the Epoch Experience layer:
the UI is a **projection of the same world used by humans and agents** —
never a second authority (architecture lock rule 8; spec/experience
architecture — binding).

## What this package owns

| Surface | Module | Responsibility |
| --- | --- | --- |
| World scene/view descriptors | `src/scene.ts` | Tenant-scoped scene records carrying the full Experience Graph vocabulary: entities (opaque, exact-revision world references + presentation placement), focused entities, the overlay library + deterministic application order, animation instructions, narrative/status blocks, the timeline/replay position, presence participants, followable agents, evidence references, candidate/action controls. |
| Scene lifecycle | `src/scene.ts` | A pure in-memory store (create/focus/apply-overlay/get/list) — every mutation re-admits and re-seals; every revision is valid and content-addressed. |
| Camera/follow semantics | `src/camera.ts` | Orbit/free/follow-agent camera state as typed data with EXPLICIT transitions (`CameraTransition` records) and cursor state. |
| Interaction-intent vocabulary | `src/intent.ts` | The world-subset universal interactions (select, inspect, measure, move, rotate, zoom, isolate, hide, show, compare, annotate, simulate, change, connect, disconnect, filter, query, branch, replay, pause, resume, follow-agent) as typed, versioned, discriminated unions. The **Dynamic UI law** is enforced at admission: executable UI content (script/code/bytecode keys, at any depth) is a typed `executable-ui-rejected` rejection, checked BEFORE schema validation. |
| The intent reducer | `src/reducer.ts` | Presentation intents transition scene view state; semantic intents produce typed host-side EFFECTS routed through the proper authorities (Action Gateway, simulation fabric, world model) — this layer never executes them. |
| Domain visual ontology | `src/ontology.ts` | Pack-contributable semantic visualizations as typed records with versioned discriminators: 2D symbols, 3D representations, materials/textures, state overlays, animations, interaction affordances. |
| Fidelity projections | `src/fidelity.ts` | Device adaptation as typed variants (desktop/web/mobile/low/remote — same semantics, different fidelity). Every reduction is an explicit typed record; never silent degradation. |
| Budget respect | `src/budget.ts` | The mirrored W013 renderer budgets + usage accounting (primitive triangle estimates, mesh/material bytes). Anything over budget is a typed `budget-exceeded` rejection. |
| Renderer-envelope compilers | `src/compile.ts` | Scene → W011 Experience Graphs (3d presentation + animation clips + narrative + timeline/replay + presence + controls), sealed with content digests, plus W013-shaped mount-graph / advance-frame / submit-intent invocation envelopes as PURE DATA. |
| Total admission | `src/parse.ts`, `src/intent.ts`, `src/ontology.ts` | Never-throws typed admission with fixed precedence (root → version → schema → tenant → resolvability → replay bounds). |
| Digest discipline | `src/serialize.ts` | Canonical SHA-256 content addressing, sealing, tamper detection, and the scene → graph → envelope digest chain. |

## Dependency policy (the W016 pin)

- **Runtime dependencies (exactly two @epoch packages):**
  `@epoch/agent-protocol` (canonical JSON/SHA-256 machinery, shared id
  grammars) and `@epoch/experience-protocol` (the consumed W011
  vocabulary: tenant scopes, vectors/quaternions, projected references,
  device descriptors, keyframes, marker kinds, ControlIntent).
- **devDependency parity (never runtime):** `@epoch/renderer-runtime`
  (W013 — the emitted envelopes are member-compatible with the real
  mount/advance/submit schemas and admit against real bindings),
  `@epoch/world-model` (W002 — scene entity ids carry the canonical
  grammar; real worlds flow into scenes), `@epoch/experience-compiler`
  (W012 — the emitted graphs compile through the real compiler; the
  mirrored triangle-estimate table agrees member-for-member). The
  compile-time assertions live in `src/parity.ts`; the runtime halves in
  `test/renderer-parity.test.ts`, `test/world-parity.test.ts`, and
  `test/compiler-parity.test.ts` (the W012 host-parity precedent).

## Contract surface

The versioned contract surface is published **inside the package** (the
W007/W009 convention): version constants + the typed index export
(`src/index.ts`), runtime zod validators, and the committed JSON Schema
projection under `schemas/` pinned byte-for-byte by
`test/contract-drift.test.ts`. Regenerate after an intentional schema
change with:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/world-experience test contract-drift
```

## Typed error taxonomy

`version-unsupported`, `malformed-record`, `digest-mismatch`,
`unknown-scene-reference`, `cross-tenant-denied`, `invalid-intent`,
`unknown-overlay-reference`, `unknown-ontology-record`,
`budget-exceeded`, `executable-ui-rejected`, `invalid-replay-position`,
`unknown-evidence-reference` — every admission/lifecycle/compile failure
is one of these typed records, never a bare throw.

## Determinism

Canonical JSON + sorted/duplicate-free collections everywhere; zero
wall-clock, zero randomness in `src/`. Identical inputs produce
byte-identical scenes, graphs, envelopes, and contract artifacts
(`test/determinism.test.ts`).

## Provider neutrality

No vendor/engine tokens anywhere in the published surface or the emitted
bytes (`test/neutrality.test.ts`); strict objects reject unknown fields;
the world UX layer never embeds a concrete engine — it produces typed
data for the W013 renderer envelopes.
