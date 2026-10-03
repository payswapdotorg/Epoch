# Work Order W068 — Blender Sidecar Arity Defect Closure (ACR-011)

Worker Count: 1

One Work Order = one branch = one PR. Workers never merge.

## Scope

The defect-closure chain for the W064 live-battery finding (ledgered OPEN in
docs/journeys/interactive-world.md): fix → regression guard → live re-run →
ledger closure. Restores ALREADY-SPECIFIED behavior; no architecture change.

## Depends

— (base: main at the ACR-011 activation). Concurrent with W066 (in flight,
disjoint) and W067 (pending, disjoint).

## Owned surfaces

- `adapters/renderers/blender/*`
- `docs/journeys/interactive-world.md` (the defect-ledger closure entry ONLY)
- `docs/rendering/blender.md` (the live re-run record ONLY)
- `spec/PROJECT-STATE.md` (the W068 completion record ONLY)

## Deliverables

1. **The fix:** the sidecar script's `require()` call sites pass all five
   positional arguments (the missing `message`). Nothing else changes in
   the emitted script; the pinned `BLENDER_SIDECAR_PYTHON_DIGEST`
   re-stamps mechanically (disclose the new digest).
2. **The CI-executable guard:** a test that EXECUTES the emitted sidecar
   Python in the STANDARD CI battery (no Blender binary, no new
   dependencies — python3 is the only allowed runtime) far enough to prove
   the argv-validation prologue and the job/report protocol paths are
   well-formed (the failure class that produced this defect can never
   return silently). The exact harness shape is yours to design inside the
   owned surfaces.
3. **The live re-run (env-gated, operator-supplied binary):** obtain the
   official Blender 4.2.11 LTS the same way W064 did (the operator-supplied
   binary at an ephemeral non-repo path — NEVER bundled/committed; source
   URL https://download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz
   or a mirror; if runtime libs are missing install only what is needed and
   record it; if the binary genuinely cannot run in your sandbox, record
   NOT-RUNNABLE honestly and deliver the fix + guard + ledger disposition
   anyway — the live re-run then remains the standing env-gated action):
   `cd adapters/renderers/blender && EPOCH_BLENDER_LIVE=1
   EPOCH_BLENDER_PATH=<binary> corepack pnpm run test:live` — the render
   and export legs must flip to PASS (probe stays green). Record version,
   URL, sha256, commands, per-test results — live evidence, never claimed
   as CI.
4. **The ledger closure:** the defect-ledger entry in
   docs/journeys/interactive-world.md flips OPEN → CLOSED with the fix →
   rerun → close chain and exact evidence (or the honest partial: fix +
   guard landed, live re-run NOT-RUNNABLE in this sandbox, entry moves to
   FIXED-awaiting-live-rerun — state exactly what is true).
5. **Verification:** the blender adapter battery green (the double-mode 40
   passed baseline + your new guard test); the env-gated live legs flipped
   (or honestly recorded); typecheck + lint green; the full standard
   battery green (`corepack pnpm install --frozen-lockfile` at root first —
   if the frozen install fails, record the exact error and STOP: never
   touch the lockfile).

## Rules

- One Work Order = one branch = one PR. Workers never merge.
- Stay inside the owned surfaces. No contract changes, no fabric changes,
  no world-experience/world-runtime/host changes, no governance-state edits
  (spec/development-state/* is TL at-merge work), no root
  manifest/lockfile edits, no new dependencies, no Blender bytes committed.
- Honest evidence only; every outcome state (flipped-green / NOT-RUNNABLE
  live) is recorded as exactly what happened.
- Remediation for review findings happens on the SAME branch/PR.
- PR body states: Work Order, dispatch base SHA, final head SHA, owned
  paths, verification commands + counts, evidence (digest re-stamp, live
  results), limitations, architecture questions.
