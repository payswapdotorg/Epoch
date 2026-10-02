# qa/foundation-renderers — the W060 foundation & asset-bridge battery

The end-to-end acceptance battery of the foundation bridges (Work Order
W060, ACR-007/X2.0): the proof that a REAL external foundation path is
exercised end-to-end through the Renderer Fabric — without a separate
provider UI, with semantic identity and evidence continuity preserved.

## The path this battery proves

```
UNTRUSTED glTF/GLB bytes
  └─ @epoch/adapter-foundation-gltf · admitGltfAsset
       validate (strict glTF 2.0 core subset) + normalize
       → the content-addressed neutral GltfAsset projection
  └─ gltfRendererAssetBinding
       → the SEALED RendererAssetBinding (contracts/renderers v1.1.0):
         content-addressed assetDigest (SHA-256 of the raw bytes),
         tenant-scoped (R12), trust-gated (only a validated admission
         can produce a validated binding)
  └─ RendererAdapter.bindAsset on the REAL W056 fabric seam
       → a REAL adapter session: the REAL Three.js adapter
         (@epoch/adapter-renderer-threejs — a real engine behind the
         frozen seam), mounted through the REAL RendererFabric and the
         REAL W013 admission boundary over the SHARED canonical fixture
         (qa/renderer-conformance/fixture.ts)
  └─ semantic identity + evidence continuity preserved
       presented semantic entity ids and the canonical world digest are
       unchanged by the binding; the bound-asset ledger is
       digest-addressed; the Blender export round-trip re-enters through
       the SAME bridge before anything binds (provider-native files never
       become Epoch authority).
```

The Blender sidecar leg drives `@epoch/adapter-renderer-blender` over the
committed Node CLI double (`adapters/renderers/blender/test/doubles/
blender-double.mjs`): a REAL subprocess boundary (argv-array spawn, no
shell, per-invocation timeouts, stdout/stderr byte caps, traversal-proof
workspace, artifact digests RE-COMPUTED by Epoch) — only the Blender
binary itself is doubled.

## Layout

- `gltf-fabric-bridge.test.ts` — the positive battery: the trust gate
  (validate + normalize + content addressing + determinism), the sealed
  validated binding, `bindAsset` on a REAL three.js adapter session, the
  semantic-identity/evidence-continuity proofs, and the full Blender
  sidecar export round-trip (canonical world → sidecar GLB → UNTRUSTED
  re-entry → validated binding → bound on the real engine session).
- `gltf-fabric-bridge.negative.test.ts` — the failure battery: every
  malformed glTF/GLB shape is a typed refusal (never a parse, never a
  binding); untrusted bindings NEVER mount on any adapter class;
  undeclared asset kinds are typed refusals; the tenant scope is sealed
  into the record; binding never mutates durable semantic state; a lying
  sidecar (self-reported digest ≠ bytes) is refused typed and nothing
  re-enters.
- `tsconfig.json` / `eslint.config.mjs` — the battery's own type-checked
  validation path (the W056/W058 qa-battery doctrine; see the file
  comments).

## Running

The battery is NOT a pnpm workspace package (the root workspace globs are
frozen). It rides the glTF bridge package's pipeline — the W058/W059
out-of-workspace-harness convention:

```bash
cd adapters/foundations/gltf
corepack pnpm install --no-frozen-lockfile   # root install (once)
corepack pnpm run link-local                 # builds the local link state
                                             # (chains blender + threejs)
corepack pnpm run typecheck                  # bridge + this battery
corepack pnpm run lint                       # bridge + this battery
corepack pnpm test                           # bridge units + this battery
```

`pnpm test` runs BOTH the bridge's unit battery (`test/`) and this
battery (the vitest config includes `../../../qa/foundation-renderers/
*.test.ts`). The link script builds `qa/foundation-renderers/node_modules`
(a symlink into the bridge's local module graph) and chains the sibling
link scripts so the Three.js and Blender adapters resolve their own
dependencies. Nothing generated is ever committed.

## Honest scope

- Everything here runs in Node 22 without a GPU: the validation,
  normalization, content addressing, fabric admission, session lifecycle,
  asset-binding seam, and the sidecar process boundary are the REAL
  product path. GL rasterization of the bound mesh and pixel E2E are the
  browser path (W061 closes the loop).
- The Blender CLI is doubled in CI. A REAL Blender binary is exercised
  only by the env-gated live battery in the adapter package
  (`adapters/renderers/blender`):

  ```bash
  cd adapters/renderers/blender
  EPOCH_BLENDER_PATH=/path/to/blender corepack pnpm run test:live
  # (equivalently EPOCH_BLENDER_LIVE=1; the live tests skip without it)
  ```

  The live battery is NOT run by CI and is honestly recorded as
  NOT-VERIFIED-live in this delivery (see docs/rendering/blender.md for
  the license/distribution posture of the separate executable).
- Zero wall-clock, zero randomness in the assertions: every time is the
  shared fixture's virtual clock; the only wall-clock values are the
  sidecar boundary's own typed `durationMs` evidence.
