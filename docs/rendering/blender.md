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

**RAN-live at W064 (2026-10-03) — FAILED-live, honestly recorded.** The
standing operator action was executed: an operator-supplied OFFICIAL
binary (the operator-supplied-binary pattern — never bundled, never
committed; it lived at an ephemeral non-repo path and was deleted after
the session). This is LIVE operator-supplied-binary evidence, NOT CI
evidence — CI still runs the committed double (which stayed green; see
the regression check below).

- **Binary (exact identity):** Blender 4.2.11 LTS, build hash
  `327de7628803`, built 2025-06-17 — official source
  `https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz`,
  tarball sha256
  `7f084fd57f1351bcae3434fc5450643547e4ad3d69cd93d4dd14a784203ee2ec`
  (352,118,380 bytes, matching the official directory listing; Blender
  publishes no sha256 sidecar for 4.2.11). No extra system libraries
  were required (sandbox glibc 2.41 ≥ 2.28; the binary ran clean).
- **Commands (exactly as run):**

  ```bash
  cd /tmp
  curl -L -o blender-4.2.11-linux-x64.tar.xz \
    https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz
  sha256sum blender-4.2.11-linux-x64.tar.xz   # recorded above
  tar -xf blender-4.2.11-linux-x64.tar.xz && rm blender-4.2.11-linux-x64.tar.xz
  /tmp/blender-4.2.11-linux-x64/blender --version   # "Blender 4.2.11 LTS"
  # repo root (the W064 frozen path — clean, working tree untouched):
  corepack pnpm install --frozen-lockfile
  cd adapters/renderers/blender
  EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=/tmp/blender-4.2.11-linux-x64/blender \
    corepack pnpm run test:live
  ```

- **Per-live-test results (3 live tests):**
  - `probes the real Blender version` — **PASS** (110ms). Live evidence
    line: `[live] probe: Blender 4.2.11 (separate-process sidecar)
    producing stills for a "desktop" device session`.
  - `renders the canonical fixture offscreen through real Cycles` —
    **FAIL** (483ms) at `live-blender.test.ts:95` (`frame.ok` false;
    no PNG artifact was produced).
  - `exports a real GLB of the canonical fixture` — **FAIL** (456ms) at
    `live-blender.test.ts:139` (`prepared.ok` false; no GLB).
  Battery summary: `2 failed | 1 passed | 1 skipped (4)`.
- **Root cause (reproduced two ways; the full defect entry lives in the
  docs/journeys/interactive-world.md defect ledger):** the pinned
  sidecar script's argv-validation prologue calls `require(...)` with
  only 4 of its 5 required positional arguments (staged sidecar lines
  79/81 against the 5-parameter definition), so EVERY real-Blender
  sidecar job (`render-offscene` and `export-gltf` alike) dies with
  `TypeError: require() missing 1 required positional argument:
  'message'` before reading the job spec or writing any report.
  Blender 4.2.11 prints the traceback to stderr but EXITS 0 (uncaught
  `--python` script exceptions do not set this revision's exit code),
  so the typed boundary sees a clean exit, advances to the report
  read, and returns the typed `report-missing` failure (wrapped
  `session-failed` at the seam):
  `reading "…-report.json" failed: ENOENT: no such file or directory`.
  The committed Node CLI double re-implements the job protocol in
  JavaScript and never executes the sidecar Python, so CI structurally
  cannot catch sidecar-Python defects — exactly the gap this live
  battery exists to close (and it did: the staged sidecar digested to
  the pinned `BLENDER_SIDECAR_PYTHON_DIGEST`
  `c52801e25a7369d4f7232554a68d9090177e931aabcd77e5ca1359149d7250f3`).
- **Regression check (the default double mode, same package, no env):**
  `corepack pnpm test` — **40 passed | 3 skipped (43)**, exactly the
  recorded baseline. With the env set the 3 live tests run instead of
  skipping: `2 failed | 40 passed | 1 skipped (43)`.
- **Disposition:** the render/export legs remain NOT-VERIFIED-live
  until the ledgered sidecar defect is remediated (Tech Lead scope;
  W064 is docs-only — no code changes) and a clean live rerun is
  recorded here. No Blender bytes or live-run artifacts are committed
  anywhere (the battery cleans its own workspace; the reproduction
  used an ephemeral /tmp workspace that is not part of the tree).

**RAN-live at W068 (2026-10-03) — PASSED-live: the ledgered defect is
closed and the live battery is GREEN (ACR-011).** The defect-closure
re-run under the same operator-supplied-binary pattern (never bundled,
never committed; an ephemeral non-repo path):

- **Binary (exact identity, byte-identical to W064's record):** Blender
  4.2.11 LTS, build hash `327de7628803`, built 2025-06-17 — official
  source
  `https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz`,
  tarball sha256
  `7f084fd57f1351bcae3434fc5450643547e4ad3d69cd93d4dd14a784203ee2ec`
  (352,118,380 bytes). No extra system libraries required (sandbox
  glibc 2.41 ≥ 2.28; the binary ran clean).
- **Commands (exactly as run):**

  ```bash
  cd /tmp
  curl -L -o blender.tar.xz \
    https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz
  sha256sum blender.tar.xz   # recorded above
  tar -xf blender.tar.xz && rm blender.tar.xz
  /tmp/blender-4.2.11-linux-x64/blender --version   # "Blender 4.2.11 LTS"
  # repo root (the frozen baseline; working tree untouched):
  corepack pnpm install --frozen-lockfile
  cd adapters/renderers/blender
  EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=/tmp/blender-4.2.11-linux-x64/blender \
    corepack pnpm run test:live
  ```

- **Per-live-test results (3 live tests):**
  - `probes the real Blender version` — **PASS**. Live evidence line:
    `[live] probe: Blender 4.2.11 (separate-process sidecar) producing
    stills for a "desktop" device session`.
  - `renders the canonical fixture offscreen through real Cycles` —
    **PASS** (~1.5s). Live evidence line:
    `[live] render evidence: {"imageDigest":"78619a09e07b65afef0174b9c841af6018d4399f2251e0696fb1bd30e3e264bd","imageBytes":42209,"blenderVersion":"4.2.11 LTS","durationMs":1362}` —
    a REAL Cycles PNG artifact (digest-addressed, boundary-verified).
  - `exports a real GLB of the canonical fixture` — **PASS** (~0.8s).
    Live evidence line:
    `[live] export evidence: {"glbDigest":"32bf9171566ce740f44fd1fb90b6d9c34c3e455312f189d702b0304e825f4b9c","glbBytes":73356,"blenderVersion":"4.2.11 LTS"}` —
    a REAL GLB container (magic `glTF`).
  Battery summary: **`3 passed | 1 skipped (4)`** — the exact ACR-011
  acceptance. With the env set on the FULL battery:
  `50 passed | 1 skipped (51)` (W064's same-setting record:
  `2 failed | 40 passed | 1 skipped`).
- **The fix chain (two defects, one work order, both ledgered in
  docs/journeys/interactive-world.md):**
  1. **The ledgered W064 defect** — the argv-validation prologue's
     `require()` call sites (staged lines 79/81) now pass all FIVE
     positional arguments (`condition, report_path, job_id,
     error_code, message` — the empty pre-job `job_id` sentinel,
     matching the convention of the four already-correct call sites).
  2. **A second, previously-MASKED defect the re-run unmasked:** with
     the crash gone, the render/export SUCCESS reports still failed the
     adapter's strict parse — they omitted the already-specified
     protocol fields (`blenderVersion`, and the artifact record's
     workspace-slug `fileName`; the shape `parseJobReport` enforces and
     the committed double — the reference implementation — always
     supplied, which is exactly why CI never saw the divergence). The
     typed failure: `report-invalid` / "the report carries no Blender
     version". Reproduced two ways (a persistent-workspace
     adapter-client diagnostic against the real binary printing the
     typed failures; a manual exact-argv sidecar invocation producing
     `ok: true` reports WITHOUT the fields — the real PNG and real GLB
     both produced, proving only the report shape was wrong). Fixed
     minimally in the same emitted script (the two fields added to both
     success reports); its own full discipline chain is ledgered.
  The pinned `BLENDER_SIDECAR_PYTHON_DIGEST` re-stamped mechanically:
  `c52801e25a7369d4f7232554a68d9090177e931aabcd77e5ca1359149d7250f3` →
  `d5610ea27c52f164e3a8ba53f9de54ac3b8d986dd016e1b7c6b50bd146a60c5b`
  (the intermediate arity-only digest `e31883ed…` was superseded within
  the same branch by the second fix — disclosed in the PR body).
- **The CI guard (the W068 deliverable, strengthened at the re-dispatch):**
  [`test/sidecar-python.test.ts`](../../adapters/renderers/blender/test/sidecar-python.test.ts)
  — **11 tests** that EXECUTE the staged sidecar Python under python3 (no
  Blender binary, no new dependencies) inside the standard battery:
  the argv-validation prologue, the job-spec read, all three job-kind
  dispatch paths, every `require()`/`fail()` report path, and the
  malformed-argv prologue refusals (with the exact W064 arity signature
  asserted ABSENT) — plus a static pin of the SUCCESS-report fields and,
  since the strengthening commit, **behavioral ok render/export legs**:
  a minimal honest bpy/mathutils PYTHON STUB
  (`test/doubles/python-stub/` — the committed Node CLI double's pattern
  one level deeper: real python3 process, real workspace files, real
  digests; identifies as `4.2.11-epoch-python-stub`, deterministic
  labeled byte artifacts, never pixels) drives the FULL success paths
  and validates the reports through the adapter's OWN strict parser
  (`parseJobReport`) with the artifact digests RE-COMPUTED
  (`readVerifiedArtifact`). Teeth verified against both defect classes
  (the pre-fix sidecar and the arity-only regression variant): the
  original defect class fails the legs with no report; a report-shape
  regression fails them at the strict parse.
- **Regression check (the default double mode, same package, no env):**
  `corepack pnpm test` — **51 passed | 3 skipped (54)** (the recorded
  40-test baseline + the 11 guard tests after the strengthening; the
  double's own tests are UNCHANGED). With the env set on the FULL
  battery: **53 passed | 1 skipped (54)**.
- **Disposition:** the render/export legs are **VERIFIED-live
  (2026-10-03, W068)**; the ledgered defects close CLOSED. This is
  LIVE operator-supplied-binary evidence, NOT CI evidence (CI keeps
  the committed double). No Blender bytes or live-run artifacts are
  committed anywhere (the battery cleans its own workspace; the
  diagnostics used ephemeral non-repo paths that are not part of the
  tree).

**RAN-live AGAIN at W068 (2026-10-03, the re-dispatched session — the
confirming first-hand re-run, GREEN again).** The W068 work order was
re-dispatched after the delivering session ended at the open-PR
boundary; the re-dispatched worker independently verified every claim
on the branch (batteries, typecheck, lint, the digest pin byte-exact),
strengthened the guard with the behavioral stub legs above, and
executed the live battery AGAIN against a fresh download of the same
official binary — LIVE evidence, never claimed as CI:

- **Binary (exact identity, byte-identical to both records above):**
  Blender 4.2.11 LTS, build hash `327de7628803`, built 2025-06-17 —
  official source
  `https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz`,
  tarball sha256
  `7f084fd57f1351bcae3434fc5450643547e4ad3d69cd93d4dd14a784203ee2ec`
  (352,118,380 bytes, verified against the record BEFORE extraction).
  No extra system libraries required (sandbox glibc 2.41 ≥ 2.28).
- **Commands (exactly as run):** the W068 sequence above (fresh
  `curl -L` to an ephemeral /tmp path → `sha256sum` → `tar -x` →
  `--version` → `EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=/tmp/
  blender-4.2.11-linux-x64/blender corepack pnpm run test:live`,
  foreground).
- **Per-live-test results (3 live tests) — `3 passed | 1 skipped (4)`:**
  - `probes the real Blender version` — **PASS**. Live evidence line:
    `[live] probe: Blender 4.2.11 (separate-process sidecar) producing
    stills for a "desktop" device session`.
  - `renders the canonical fixture offscreen through real Cycles` —
    **PASS** (1618ms). Live evidence line:
    `[live] render evidence: {"imageDigest":"3c9d2759cf65122ea67e68add3b96b9b6956511ba7e081312344e5f631921d37","imageBytes":42209,"blenderVersion":"4.2.11 LTS","durationMs":1482}` —
    a REAL Cycles PNG (digest-addressed, boundary-verified).
  - `exports a real GLB of the canonical fixture` — **PASS** (671ms).
    Live evidence line:
    `[live] export evidence: {"glbDigest":"21d97cda075456454293a7aedae6297f0fd2ef66879f1c442017a1078e301b1f","glbBytes":73356,"blenderVersion":"4.2.11 LTS"}` —
    a REAL GLB container (magic `glTF`).
- **Cross-run determinism note (honest):** the artifact BYTE COUNTS are
  identical to the first W068 run (42,209 PNG / 73,356 GLB — the
  deterministic scene); the DIGESTS differ (embedded file timestamps —
  recorded as exactly what each run produced, never normalized).
- **Full battery with the env set:** **`53 passed | 1 skipped (54)`**
  (the 51 double-mode tests + the 3 live legs; only the honest live-gate
  skip remains).

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

- **Live-binary evidence is now GREEN (W068, 2026-10-03; re-confirmed
  by the re-dispatched session's independent live re-run the same day).**
  The official Blender 4.2.11 ran the live battery to 3/3 green TWICE
  (the version probe + a REAL offscreen Cycles render + a REAL
  glTF/GLB export; the W068 live-run records above) — closing the W064
  FAILED-live finding (the ledgered sidecar arity defect) AND the
  second, previously-masked report-shape defect the re-run unmasked
  (both rows in docs/journeys/interactive-world.md's defect ledger are
  CLOSED). All CI evidence remains the committed double (real
  boundary, doubled engine — 51 passed + 3 env-gated skips after the
  W068 sidecar-Python execution guard and its strengthening; the live
  runs are live evidence, never claimed as CI).
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
