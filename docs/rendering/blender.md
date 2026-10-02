# The Blender Sidecar Renderer (W060)

The FIRST external-foundation renderer behind the Renderer Fabric:
[`@epoch/adapter-renderer-blender`](../../adapters/renderers/blender) —
Blender as a **separate program** driving high-fidelity/offscreen
rendering and glTF asset preparation for the Epoch-owned surface, never
semantic authority (capability-foundation policy CF1.0; architecture lock
rules 8/13/16).

- Contract: `contracts/renderers` v1.1.0 (the frozen W056 surface; fabric
  protocol `1.0.0`).
- Seam: `RendererAdapter` (`@epoch/renderer-fabric`) — implemented as an
  honest **batch/offscreen renderer class**: offscreen frame evidence and
  digest-addressed mesh asset bindings only, ZERO interactive input
  (every `translateInput` is a typed `input-unsupported` refusal), no
  portable camera/timeline state (skipped fields are listed, never
  silent).
- Neutral identity: renderer id `rr-offscreen-sidecar` (the W056 `rr-`
  grammar never names vendor products); Blender is honestly recorded in
  the capability/descriptor descriptions, exactly like the W058/W059
  engine adapters.
- Zero engine imports anywhere: this adapter has ZERO external runtime
  dependencies (Node built-ins only). Blender is never linked, never
  embedded, never downloaded, never bundled.

## The typed process boundary (the security core)

Every interaction with Blender crosses
[`src/process.ts`](../../adapters/renderers/blender/src/process.ts), a
typed boundary that enforces:

| Rule | Enforcement |
|---|---|
| argv arrays ONLY | `spawn(program, [argv...], { shell: false })` — never a string command, never interpolation, never shell syntax interpretation (proven: the boundary test feeds shell metacharacters as a literal version flag and they stay literal). |
| Per-invocation timeouts | `probeTimeoutMs` / `jobTimeoutMs` ceilings with a REAL kill (typed `process-timeout`); the hanging-double test proves the kill fires. |
| Output caps | `maxStdoutBytes` / `maxStderrBytes` caps enforced WHILE STREAMING — a flooding child is killed and typed `output-limit-exceeded`, never an unbounded buffer. |
| Scoped workspace | Every file the boundary touches derives from a STRICT SLUG id (`/^[a-z0-9][a-z0-9-]{0,127}$/`) inside ONE caller-supplied directory; resolved paths are re-checked to stay inside it (traversal-proof). |
| Untrusted sidecar output | The sidecar's self-reported sizes/digests are NEVER trusted: Epoch re-reads and re-computes every artifact digest (`readVerifiedArtifact`) — a lying sidecar is a typed `artifact-mismatch` and NOTHING re-enters. |
| Typed reports only | Every failure mode (missing report, invalid JSON, wrong job id, non-zero exit, unsupported job, oversized output) is a discriminated `BlenderBoundaryFailure` code — never a throw at the seam. |

## The job protocol

One job = one spec file (strict slug) → ONE Blender invocation → one
typed JSON report + (for render/export) one artifact file, all inside the
scoped workspace:

```
blender --background --factory-startup --python blender-sidecar.py -- <job.json> <report.json>
```

- `probe` — the version probe (`blender --version`, no sidecar).
- `render-offscene` — build the mounted offscene scene (every mesh object
  carries its semantic entity id as a Blender custom property
  `epochEntityId` — presentation provenance only) and render it
  offscreen (Cycles, PNG, digest-addressed evidence: the frame report
  records image digest/bytes/entity count/Blender version/duration).
- `export-gltf` — export the mounted offscene scene to a GLB. The GLB
  bytes are **UNTRUSTED provider output**: they re-enter through the
  [glTF bridge](./gltf.md) (validate + normalize) before ANY binding
  mounts anywhere (proven end-to-end in
  [`qa/foundation-renderers`](../../qa/foundation-renderers)).

The sidecar Python script is pinned in-package
(`src/sidecar.ts`) with its SHA-256 digest recorded
(`BLENDER_SIDECAR_PYTHON_DIGEST`) and staged into the workspace at run
time. It is a dumb executor: one job in, one typed report out, no
environment secrets, no files outside the two paths it was given.

## Honest capability declaration

- `interaction: []` — the W013 descriptor declares ZERO interaction
  modalities; every input translation is a typed refusal.
- `assetKinds: ['mesh']` — only validated, digest-addressed mesh bindings
  (the glTF bridge's output).
- `degradation: ['none']` — batch renders are all-or-nothing (a degraded
  frame request is a typed refusal).
- `portableViewState: ['focused-entities', 'layer-visibility']` — the
  semantic fields restore; the presentation camera/timeline are the
  sidecar's own deterministic framing.
- Without a configured Blender binary the adapter never fabricates: the
  probe reports INCOMPATIBLE (honest reason) and session creation is a
  typed `probe-rejected` — never a crash, never a created-but-broken
  session.

## CI evidence vs. live evidence — the honesty split

**CI-verified (Node 22, no Blender):** the FULL boundary against the
committed Node CLI double
([`test/doubles/blender-double.mjs`](../../adapters/renderers/blender/test/doubles/blender-double.mjs))
— real subprocesses, real timeouts, real byte caps, real
workspace discipline, real report/artifact verification, and the adapter
seam through the REAL fabric over the shared canonical fixture
(`test/process.test.ts`, `test/jobs.test.ts`, `test/adapter.test.ts`;
plus the cross-package end-to-end in
[`qa/foundation-renderers`](../../qa/foundation-renderers)). Only Blender
itself is doubled; the double honestly identifies itself
(`4.2.11-epoch-double`).

**NOT-VERIFIED-live at W060 delivery:** no Blender binary exists in the
working sandbox. The env-gated live battery
([`test/live-blender.test.ts`](../../adapters/renderers/blender/test/live-blender.test.ts))
is SKIPPED by default and is never claimed as CI-verified. To run it
against a real Blender:

```bash
cd adapters/renderers/blender
corepack pnpm install --no-frozen-lockfile          # root workspace install
EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=/path/to/blender \
  corepack pnpm run test:live
```

It then proves: the real `--version` probe, a REAL offscreen Cycles
render of the shared canonical fixture (PNG artifact,
digest-addressed), and a REAL glTF/GLB export whose bytes validate
through the same bridge protocol.

## Package conventions

Per `adapters/s3-object-store` (epoch layer metadata `experience`,
`exports: { ".": "./src/index.ts" }`, scripts
`typecheck`/`lint`/`test`, `catalog:` protocol for every catalog
dependency). Pre-registration local verification:
`adapters/renderers/blender` is a NESTED package path the frozen
`adapters/*` workspace glob (one level) does not match, so
`scripts/link-local.mjs` builds the package's gitignored local
`node_modules` (workspace symlinks only — zero external dependencies to
stage). Post-registration (the Tech Lead's lockfile pass adds the glob
entry), pnpm owns the install.

```
cd adapters/renderers/blender
corepack pnpm install --no-frozen-lockfile   # root workspace install (revert pnpm-lock.yaml before committing)
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test                           # 40 passed / 3 env-gated live skips
```

## Blender license record — GPL-2.0-or-later, separate executable

Blender the program is Free Software licensed under the **GNU General
Public License v2.0 or later** (SPDX `GPL-2.0-or-later`; published by
the Blender Foundation — re-verify at the exact binary revision before
any release packaging, per the renderer-fabric license rule). This
section is the W060-required record of Epoch's posture and distribution
obligations.

**The separate-executable posture (no Epoch contamination):**

1. **Never linked.** No Epoch code imports, links against, or embeds
   Blender libraries (`bpy`, `mathutils`, ...). The adapter's only
   dependency surface is Node's own `child_process`/`fs`/`crypto`.
2. **Never bundled.** Epoch does not download, vendor, or redistribute
   Blender binaries or sources. Operators supply their own Blender
   (`EPOCH_BLENDER_PATH` or the adapter's `blenderPath` option); CI runs
   the committed test double.
3. **Aggregate, not combined.** Epoch and Blender communicate as two
   separate programs: an argv-array process invocation, JSON job/report
   files, and artifact files inside a scoped workspace — the classic
   separate-program/arms-length interaction. Neither program's memory
   space, control flow, or internal APIs are shared.
4. **The sidecar script is Epoch-owned data.** The Python program Epoch
   hands to Blender's interpreter is authored by Epoch (copyright the
   Epoch authors, licensed under the Epoch repository license) and is
   DATA of this package (a pinned, digest-recorded string staged at run
   time). Running a permissively-licensed script inside a GPL program
   does not make the script GPL, and does not make Epoch's TypeScript
   adapter a derivative work of Blender.

Under this posture Epoch triggers **no GPL distribution obligations**:
it distributes neither Blender nor a combined work. If a future
distribution decision ever bundles or ships Blender binaries (e.g. an
offline installer), THEN the GPL obligations attach to THAT
distribution: the bundled Blender copy and its corresponding source
must be offered under GPL-2.0-or-later (Blender's own build already
satisfies this upstream), the license text and copyright notices must
accompany it, and no additional restrictions may be imposed on
recipients. That decision requires the exact-revision license audit and
a governance record BEFORE packaging — flagged for the Tech Lead.

**Other licenses in the blast radius:** the committed CI double is
Epoch-authored (repository license); the canonical fixture and fabric
packages are Epoch's (repository license); nothing else ships with this
adapter.

## Known limitations (honest)

- **No live-binary evidence at delivery.** All CI evidence is the
  committed double (real boundary, doubled engine); the real-binary
  battery is env-gated and NOT-VERIFIED-live (see above).
- **The double's render is not pixels.** The double's "image" artifact is
  a deterministic labeled byte artifact — honest CI evidence of the
  BOUNDARY (digest verification, evidence typing), not of Blender's
  rasterizer.
- **Batch class only.** No interactive input, no portable camera; the
  sidecar frames its own camera deterministically from the mounted
  scene.
- **`durationMs` is wall-clock boundary evidence.** The typed reports
  carry real process durations (typed as such); every semantic time is
  caller-supplied virtual time.
- **The W016 timeline/animation companions ride as admitted data** — the
  offscene build presents the 3d spatial graph; no keyframed timeline
  replay in the sidecar yet (a follow-up job kind if the TL wants it).
