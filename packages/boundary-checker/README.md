# @epoch/boundary-checker

Test kit for the Epoch checkers (layer: `tooling`). Hosts:

- `test/boundary.test.mjs` — synthetic fixture workspaces (valid + violating)
  run against `scripts/boundary-check.mjs` via its CLI, asserting pass/fail
  exit codes and violation messages (W001 acceptance 5).
- `test/governance.test.mjs` — runs `scripts/governance-check.py --selftest`
  (negative-fixture battery: invalid worker counts, missing canonical files,
  missing dependency-graph-referenced work-order files, overlapping active
  ownership) plus a real-state pass and an invalid `--root` exit-code check
  (W001 acceptance 4).

Run via `pnpm test` (turbo) or `pnpm --filter @epoch/boundary-checker test`.
