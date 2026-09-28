# @epoch/device-capabilities

Epoch Device Capabilities kernel (Work Order **W019**, experience layer) —
the **device-side half of Renderer/Device Adaptation** (R29
device-aware fidelity).

## What this package owns

- **Canonical device-class profiles** (`DEVICE_CLASS_PROFILES`,
  `descriptorFromProfile`) — the W011 device-slot **filler**: a host that
  knows only a neutral device class (desktop / laptop / tablet / phone /
  headset / wall-display) gets a valid, provider-neutral W011
  `DeviceDescriptor`, with caller overrides merged under the W011
  deterministic set semantics. Pure frozen data — never
  environment-sniffed, never a vendor product fingerprint.
- **Deterministic sealed capability assessments**
  (`assessDeviceDescriptor`) — a content-addressed
  `DeviceCapabilityAssessment` derived from a device descriptor alone:
  the typed adaptation tier (`full` / `normal` / `field` / `reduced` —
  the frozen spec table: desktop = full, web/laptop = normal, mobile =
  field, low capability = 2D/reduced), the full derivation trace
  (budget-floor tier, class ceiling, guided fidelity level,
  remote-assist recommendation — never an unexplained verdict), and axis
  snapshots (display / spatial / interaction coverage).
- **Presentation fit / gap analysis** (`assessPresentationFit`) — typed
  gap records (encountered vs required) when a device cannot host a
  declared presentation requirement. Never silent.

## Non-negotiables

- **Same semantics, different fidelity** (spec/experience-architecture.md
  "Device adaptation"): adaptation changes the capability envelope, never
  the semantics.
- **Guidance, never choice**: the tier→fidelity correspondence
  (`ADAPTATION_TIER_FIDELITY_GUIDANCE`) GUIDES the host's W016 fidelity
  choice; the host remains the chooser (the W016 pin).
- **Determinism**: zero wall-clock, zero randomness, zero I/O; the same
  descriptor + assessment id always yields the byte-identical
  content-addressed record.
- **Provider neutrality** (lock rule 13): strict zod objects reject
  vendor/engine fields with precise typed paths; vocabularies name
  classes and tiers, never products.
- **Digest discipline**: assessments are sealed over canonical JSON
  SHA-256; tampered digests and hand-edited verdicts are typed
  rejections.

## Runtime dependencies

`@epoch/agent-protocol` (canonical digest machinery) and
`@epoch/experience-protocol` (the W011 device vocabulary — genuine
runtime composition). Compatibility with `@epoch/renderer-runtime`,
`@epoch/experience-runtime`, and `@epoch/world-experience` is pinned via
devDependencies + compile-time parity (`src/kernel-parity.ts`) and
runtime parity tests — never runtime deps.

## Composition flow (W019)

```
device class ──descriptorFromProfile──▶ W011 DeviceDescriptor ──▶ W013 device session
                (fills the slot)                 │
                                                 ▼
                            assessDeviceDescriptor ──▶ sealed DeviceCapabilityAssessment
                                                 │                   (tier, trace, axes)
                                                 ▼
                  W013 RendererBinding ── renderer-adapters.selectRendererAdapter ──▶
                          (negotiated effective limits)   + progressive-scene fitting
```

## Contract surface

Version constants + typed index export (`src/index.ts`), runtime zod
validators (`src/*.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (the W007/W009/W015/
W016 in-package convention). Regeneration:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/device-capabilities test contract-drift
```

## Tests

`pnpm --filter @epoch/device-capabilities test` — positive, negative,
boundary (exact tier floors, one-below-floor, class ceilings),
determinism, provider-neutrality, W011/W013/W016 runtime parity, and
contract drift (87 tests).
