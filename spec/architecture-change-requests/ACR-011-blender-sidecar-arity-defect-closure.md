# ACR-011 — Blender Sidecar Arity Defect Closure

**Status:** EFFECTIVE (activation recorded 2026-10-03)
**Approved:** 2026-10-03 — operator standing continuation directive ("continuous resident watch... monitor → harvest → review → approve/require-changes → dispatch next, until the roadmap is complete. No early returns."); the defect was discovered and ledgered OPEN by W064's live battery (PR #148, merged 220e99f)
**Activation:** EFFECTIVE 2026-10-03 — runs concurrent with the ACR-010 remainder (W066 in flight; W067 pending) on pairwise-disjoint surfaces
**Target experience version:** X2.0 (unchanged — a defect closure restoring already-specified behavior; NO architecture change, NO lock transition, NO contract bump)
**Work Orders:** W068 (single serialized defect-closure order)

## Why this exists

W064 supplied the official Blender 4.2.11 LTS to the env-gated live battery
and found a REAL defect the committed double could never catch: the pinned
sidecar script's argv-validation prologue calls
`require(condition, report_path, job_id, error_code, message)` with only 4
of 5 required positional arguments (staged sidecar lines 79/81), so EVERY
real-Blender sidecar job (`render-offscene` and `export-gltf` alike) dies
with `TypeError: require() missing 1 required positional argument:
'message'` before reading the job spec or writing any report. Blender
4.2.11 prints the traceback to stderr but EXITS 0, so the typed boundary
returns the `report-missing` (ENOENT) failure wrapped as `session-failed`
at the seam.

The full discipline chain is ledgered in
`docs/journeys/interactive-world.md` (observed → recorded → reproduced two
ways: a persistent-workspace diagnostic run AND a manual
`blender --background --factory-startup --python <staged sidecar> --`
invocation with the exact staged files — exit 0, TypeError on stderr, NO
report file, the sidecar digested to the pinned `BLENDER_SIDECAR_PYTHON_DIGEST`
`c52801e2…`). Status: OPEN.

The double-mode CI battery is UNAFFECTED (the committed double re-implements
the job protocol in JavaScript and never executes the sidecar Python) —
which is exactly why the defect class needs a CI-executable guard: today
nothing in CI ever executes the emitted sidecar Python.

## The change (restores already-specified behavior)

1. **The fix:** the sidecar's `require()` call sites pass all five
   positional arguments (the missing `message` argument). No other sidecar
   behavior changes; the emitted script's digest changes (the pinned
   `BLENDER_SIDECAR_PYTHON_DIGEST` re-stamps mechanically).
2. **The CI-executable guard:** a CI-runnable check that EXECUTES the
   emitted sidecar Python (without Blender) far enough to prove the
   argv-validation prologue and the job/report protocol paths are
   well-formed — e.g., a python3 execution of the staged script against a
   stub/failure-path job that exercises `require()` and exits through the
   report-writing path (the exact shape is the worker's to design inside
   the owned surfaces; it must run in the standard CI battery with NO
   Blender binary and NO new dependencies).
3. **The live re-run:** the env-gated live battery re-run against the
   official Blender 4.2.11 — the render and export legs flip to PASS; the
   probe stays green. Live evidence is recorded as live (never claimed as
   CI).
4. **The ledger closure:** the defect-ledger entry flips OPEN → CLOSED with
   the fix → rerun → close chain and exact evidence.

## Acceptance (W068)

- The sidecar arity fix lands with the digest re-stamp.
- The CI-executable sidecar-Python guard lands and runs in the standard
  battery (proving the failure class can never return silently).
- The env-gated live battery result flips to `3 passed` (probe + render +
  export) against the official Blender 4.2.11 — honestly recorded as live
  evidence (version, URL, sha256 in the records).
- The double-mode battery stays green (40 passed + 3 env-gated skips → the
  skips flip to passes only under the live env).
- The defect-ledger entry closes with the full chain.
- Verification: the blender adapter package battery + typecheck + lint
  green; the full CI battery green.

## Version / lock record

- E1.0/X2.0 invariants: binding, unchanged. No architecture change, no
  lock transition, no contract bump, no new dependencies, no root
  manifest/lockfile edits.
- The `BLENDER_SIDECAR_PYTHON_DIGEST` pin re-stamps mechanically with the
  fix (the sanctioned mechanical-touch pattern).

## Frontier update

W068 ELIGIBLE at activation; concurrent with ACR-010's W066 (in flight) and
W067 (pending) — pairwise-disjoint surfaces (`adapters/renderers/blender/*`
vs `packages/world-experience/*` vs `packages/world-runtime/* + apps/*`).
