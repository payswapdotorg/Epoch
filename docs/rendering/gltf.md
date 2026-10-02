# The glTF 2.0 Asset Bridge (W060)

The validated interchange boundary that turns UNTRUSTED glTF/GLB bytes
into content-addressed renderer-asset bindings for the Renderer Fabric:
[`@epoch/adapter-foundation-gltf`](../../adapters/foundations/gltf).
glTF is the replaceable interchange format behind neutral role
vocabulary (architecture lock rule 13) — a glTF file is a SOURCE
ARTIFACT, never Epoch semantic authority (capability-foundation policy
CF1.0 §5: the validated projection is the only thing Epoch adopts, and
even that is data for hosts, never semantic state).

## The fabric path (what this bridge is FOR)

```
UNTRUSTED glTF/GLB bytes (host-acquired)
  │ admitGltfAsset() — the ONE-CALL TRUST GATE
  │   container detection (.gltf JSON vs GLB binary)
  │   strict glTF 2.0 core-subset structural validation
  │   deterministic normalization
  ▼
GltfAdmission
  │ asset: GltfAsset — the neutral, content-addressed projection
  │   assetBytesDigest = SHA-256(raw bytes)   ← the binding's content address
  │   projectionDigest = SHA-256(canonical JSON of the projection)
  ▼ gltfRendererAssetBinding()
RendererAssetBinding (contracts/renderers v1.1.0, SEALED)
  │ content-addressed · tenant-scoped (R12) · trust-gated
  │ (only a GltfAdmission — which only full validation produces —
  │  can yield a 'validated' binding; raw bytes get the explicit
  │  'untrusted' tracking record instead, which every adapter refuses)
  ▼ RendererAdapter.bindAsset(session, binding) — the W056 seam
a REAL adapter session (the Three.js engine adapter today; the Blender
sidecar binds mesh assets too) — the asset crosses the seam ONLY as a
digest-addressed binding record, never an untyped byte stream
```

The end-to-end proof (including the Blender sidecar round trip: canonical
world → sidecar GLB export → UNTRUSTED re-entry through this bridge →
validated binding → bound on the real engine session) is the
[`qa/foundation-renderers`](../../qa/foundation-renderers) battery.

## The validation boundary (what is and is not admitted)

**Admitted (the strict glTF 2.0 core subset):** `asset` (version
`2.x`), scenes/nodes/meshes/primitives/accessors/bufferViews/buffers/
materials; embedded data-URI buffers and the GLB BIN chunk (external
resource URIs are a typed `buffer-unresolvable` refusal — acquisition is
the HOST's concern, and whatever it acquires re-enters through this same
validation); indices/bounds/byte-offset/component-type checks; declared
POSITION min/max; finite-float scans; DAG cycle detection; depth and
size limits (see `src/limits.ts`).

**Typed refusals (never a throw, never a truncated parse):**
`input-empty`, `limit-exceeded`, `not-gltf2`, `malformed-json`,
`glb-invalid`, `buffer-unresolvable`, `buffer-mismatch`,
`bufferview-invalid`, `accessor-invalid`, `mesh-invalid`,
`node-graph-invalid`, `material-invalid`, `unsupported-feature`
(`extensionsRequired` is non-empty, sparse accessors, non-triangle draw
modes — core-only honesty: the bridge never silently ignores an
extension an asset actually requires).

**The neutral projection (`GltfAsset`):** per-primitive vertex/triangle
accounting, local and scene-transformed bounds (TRS/matrix composition,
bounded DAG walk), material summaries, non-authoritative label
suggestions (mesh/node/scene names — presentation hints, never semantic
labels), and the two content addresses. Byte-identical inputs produce
identical projections and digests (byte-for-byte stable across runs and
platforms); two different byte encodings of the same validated geometry
normalize to the same projection digest.

**The W016 hint (`GltfMeshBinding`):** `gltfMeshBindingOf()` projects
one mesh into a neutral, digest-addressed suggestion record the host
consults when it authors a world representation through the world model
(the world model stays authority — this is DATA, not a second
authority).

## Boundary properties (all enforced, all tested)

- **Pure code:** zero external dependencies, zero I/O (no filesystem, no
  network), zero wall-clock, zero randomness — runtime-neutral (lock
  rule 14). Everything embedded (data URIs, GLB BIN) — nothing fetched.
- **Untrusted-input discipline:** every malformed shape is a typed
  refusal; tamper evidence via content addressing (one flipped byte =
  one different digest).
- **Never authority:** provider-native files are source artifacts; the
  validated projection is adopted as data only.

## glTF spec license record

The glTF 2.0 specification is © Khronos Group and is made available
under the **Creative Commons Attribution 4.0 International License
(CC-BY-4.0)** (with the Khronos IP Rights Disclosure obligations noted
upstream). This package implements against the published 2.0
specification; it embeds NO Khronos text, assets, or samples, and
carries no Khronos code — no Khronos license obligations attach to
Epoch from this bridge. Re-verify at any spec-revision change per the
renderer-fabric license rule. Three.js's GLTFLoader is NOT used (the
bridge is its own strict validator); the engines never parse glTF —
only this bridge does.

## Wiring

```ts
import {
  admitGltfAsset,
  gltfRendererAssetBinding,
  gltfUntrustedAssetBinding,
  gltfMeshBindingOf,
} from '@epoch/adapter-foundation-gltf';

const admitted = admitGltfAsset(untrustedGlbBytes);   // typed result
if (admitted.ok) {
  const binding = gltfRendererAssetBinding({
    admission: admitted.value,                        // the trust gate
    bindingId: 'rab-asset-1',
    fabricSessionId,
    tenantScope: { tenantId },                        // R12
    boundAtMs,                                        // virtual time
  });
  const mounted = await adapter.bindAsset(session, binding); // the seam
}
```

## Package conventions

Per `adapters/s3-object-store` (epoch layer metadata `experience`,
`exports: { ".": "./src/index.ts" }`, scripts
`typecheck`/`lint`/`test`, `catalog:` protocol for every catalog
dependency — here: zero runtime dependencies at all). Pre-registration
local verification: `adapters/foundations/gltf` is a NESTED package
path the frozen workspace globs do not match, so
`scripts/link-local.mjs` builds the package's gitignored local
`node_modules` (workspace symlinks only) — it is also the CHAIN ROOT of
the W060 packages (it invokes the blender/threejs link scripts and links
the qa/foundation-renderers battery). Post-registration (the Tech
Lead's lockfile pass adds the glob entry), pnpm owns the install.

```
cd adapters/foundations/gltf
corepack pnpm install --no-frozen-lockfile   # root workspace install (revert pnpm-lock.yaml before committing)
corepack pnpm typecheck                      # bridge + qa/foundation-renderers
corepack pnpm lint                           # bridge + qa/foundation-renderers
corepack pnpm test                           # 69 bridge units + 15 end-to-end battery tests
```

## Known limitations (honest)

- **Mesh geometry core subset only.** Animations, skins, morph targets,
  cameras/lights as nodes, textures beyond counting, KHR extensions —
  typed `unsupported-feature` refusals today; the projection carries
  what the fabric's asset kinds (`mesh`) consume.
- **No GPU path here.** This bridge validates/normalizes/binds; the
  engine adapters own the upload (the browser path; W061 closes the
  E2E loop).
- **The label suggestions are non-authoritative** presentation hints; a
  host that wants canonical labels authors them through the world
  model.
- **External resource URIs are refused, not resolved** — by design (the
  acquisition boundary is the host's; resolved bytes re-enter through
  the same validation).
