# Work Order W064 — Blender Live-Battery Verification Closure (standing operator action)

Worker Count: 1

One Work Order = one branch = one PR. Workers never merge.

## Scope

The standing operator action recorded at the ACR-009/W063 closure: supply a
REAL official Blender binary (the operator-supplied-binary pattern — never
bundled, never committed) and run the env-gated live battery, closing the
NOT-VERIFIED-live ledger item honestly. Verification + evidence records ONLY:
no code, no contract, no lock changes.

## Depends

— (base: main 12b5f22c8515a488767c3dfc3333804da1dff1e7). Concurrent with the
ACR-010 activation wave (docs-only surfaces here; disjoint).

## Owned surfaces

- `docs/rendering/blender.md`
- `docs/journeys/interactive-world.md`
- `AI_CONTINUATION.md`
- `spec/PROJECT-STATE.md`

## Deliverables

1. The official Blender 4.2.11 linux-x64 binary (matching the committed
   double's 4.2.11 identity) at an ephemeral non-repo path; version probed;
   sha256 + source URL recorded.
2. The env-gated live battery run:
   `EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=<binary> corepack pnpm run test:live`
   in `adapters/renderers/blender` after the frozen root install — the real
   `--version` probe, the REAL offscreen Cycles render of the canonical
   fixture, the REAL glTF/GLB export validation. Full output captured.
3. Honest records in the owned surfaces: the live-run record (version, URL,
   sha256, commands, pass/fail per live test) or the honest NOT-RUNNABLE /
   failed-run record with precise errors; the ledger dispositions updated;
   live evidence is NEVER claimed as CI evidence (CI keeps the committed
   double).
4. Defects (if any live test fails): recorded precisely in the
   docs/journeys/interactive-world.md defect ledger (repro + observed +
   expected); NO code fixes in this order (remediation scope is the TL's).

## Rules

- No code changes, no governance-state edits (spec/development-state/* is
  TL at-merge work), no root manifest/lockfile edits, no new dependencies,
  no Blender bytes committed anywhere.
- Honest evidence only: VERIFIED-live / FAILED-live / NOT-RUNNABLE are all
  acceptable outcomes; fabrication is not.
- PR body states: Work Order, dispatch base SHA, final head SHA, owned
  paths, verification (the exact commands + output), evidence (version,
  URL, sha256), limitations, architecture questions.
