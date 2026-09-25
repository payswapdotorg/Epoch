# @epoch/experience-protocol

Epoch Experience Protocol v1 — the typed, provider-neutral **projection
contract** of the Epoch Experience layer (Work Order W011, layer
`experience`).

The Experience Runtime consumes world/task/agent/evidence/device/capability
state and produces **Experience Graphs** for 2D, 3D, animation, narrative,
timeline/replay, presence and controls (spec/architecture.md — binding).
This package is the protocol of that boundary:

- **versioned Experience Graph envelopes** — graph kind, version
  discriminator, tenant scope, projected kernel references, typed node/edge
  descriptors, the device slot, and a SHA-256 content digest
  (exact-revision addressing);
- **projection requests** — which kernel state (opaque, tenant-scoped,
  exact-revision references), which graph kind, which device, optional
  replay window;
- **the abstract device-descriptor slot** — typed, provider-neutral
  capability/limit data; W019 (Renderer/Device Adaptation) fills it. ZERO
  concrete renderers, ZERO engine/GPU vocabulary, ZERO UI-framework
  dependencies;
- **deterministic serialization** — canonical JSON (sorted keys) plus
  sorted, duplicate-free node/edge/reference arrays: identical inputs
  serialize identically, and non-canonical orders are rejected;
- **a typed admission-error taxonomy** — `version-unsupported`,
  `malformed-descriptor` (strict objects reject unknown vendor/engine
  fields, with precise dotted paths), `digest-mismatch`,
  `cross-tenant-denied` (R12), `unknown-reference`, and
  `authority-violation` (lock rule 8: kernel semantic vocabulary smuggled
  into presentation attributes is rejected).

## Projection, never authority (architecture lock rule 8)

The Experience Graph is a READ PROJECTION of kernel state:

- kernel objects are referenced opaquely (`ProjectedReference`: kind,
  tenant, target id, content digest) — never embedded;
- presentation attributes that shadow kernel vocabulary are rejected at
  admission (`KERNEL_RESERVED_ATTRIBUTE_KEYS`);
- the protocol never mutates kernel state and never becomes a second
  semantic store.

## Runtime dependencies (Tech Lead pin)

Exactly two `@epoch` runtime dependencies:

- `@epoch/agent-protocol` — canonical JSON serialization, SHA-256 digest
  machinery, shared primitives (qualified names, semver cores, message
  ids, timestamps), reused — never mirrored;
- `@epoch/world-model` — the consumed world-state vocabulary: entity and
  event id schemas are imported directly, so world-model grammar changes
  break this package's compile (and its parity tests).

Compatibility with the action, evidence, and capability vocabularies is
pinned by devDependencies + compile-time/runtime parity tests
(`src/kernel-parity.ts`, `test/kernel-parity.test.ts`,
`test/world-parity.test.ts`) — the kernel-to-kernel devDep precedent
(W002/W006/W007/W008). No other runtime deps were added.

## Published contract surface

The versioned contract surface lives at `contracts/experience/`
(`index.d.ts` + `parity.ts` + `manifest.json` + `schemas/*.schema.json`),
following the `contracts/*` convention of W002-W004. The committed
artifacts are byte-identical to the deterministic emission
(`renderExperienceContractFiles()`; drift-pinned by
`test/contract-drift.test.ts`).

## Layer

`experience` (the first package on this layer): may consume kernel,
contracts, and tooling packages; nothing may import it from the kernel
layer (the kernel → UI prevention).

## Test map

| File | Battery |
|---|---|
| `test/graph.positive.test.ts` | round-trips per graph kind; sealing; canonical serialization; all reference kinds; pure-presentation graphs |
| `test/graph.negative.test.ts` | version-unsupported; malformed descriptors (vendor fields, grammar, vocabulary pins, conditionals); digest-mismatch; unknown-reference; non-deterministic ordering rejected |
| `test/authority.negative.test.ts` | FIRST-CLASS authority boundary: inline world state, restated kernel vocabulary, authority claims — all rejected with typed `authority-violation` |
| `test/tenant.negative.test.ts` | cross-tenant references, node refs, requests, expected-tenant option |
| `test/device.test.ts` | device-descriptor positives/negatives/boundaries |
| `test/determinism.test.ts` | identical inputs serialize identically; key-order permutations; emission determinism |
| `test/world-parity.test.ts` | real WorldModel entities/relations/events flow through the reference schemas (runtime consumption) |
| `test/kernel-parity.test.ts` | action/evidence/capability devDependency parity |
| `test/neutrality.test.ts` | vendor/engine/framework blocklist over all published artifacts |
| `test/contract-surface.test.ts` | manifest ↔ surface ↔ declarations ↔ parity coverage |
| `test/contract-drift.test.ts` | committed artifacts byte-identical to emission |
