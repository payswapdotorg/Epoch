# Epoch Project State

Architecture: E1.0 / X1.0
Work Order schema: WO1.0
Default branch: main
Max concurrent workers: 3
Bootstrap baseline: ad76c5c5cdb92cd4ff72b90b663bdce26bb9b3ce

Current frontier:
- W001 COMPLETE (PR #2, squash 1b0d8d24; reviewed head be8f48a0)
- W002 COMPLETE (PR #6, squash f4a7ffa1; reviewed head a58a95f8)
- W003 COMPLETE (PR #8, squash aeabf3b6; reviewed head eda7bbd8)
- W004 COMPLETE (PR #7, squash d98bb42e; reviewed head 7980e996)
- Foundation maintenance COMPLETE (PR #9, squash 63a7469f: wave-1 lockfile reconcile + eslint layerRestrictions ESLint-10 fix with regression tests)
- W005/W006 AUTHORIZED — second concurrent wave (disjoint surfaces)
- all others WAITING_ON_DEPENDENCIES

Verification baseline after W001: pnpm@10.34.5 / Node 22 / TS 5.9.3 / eslint 10.11.0 + typescript-eslint 8.70.1 / vitest 5.0.1 / Next 15.5.26 / React 19.3.0 / zod 4.6.5 / turbo 2.11.3 — frozen catalog in pnpm-workspace.yaml; policy in scripts/DEPENDENCY-BASELINE.md; CI battery: governance boundary typecheck lint test build.

Material review lessons (W001):
- pnpm-lock.yaml is a derived root-manifest artifact and IS in scope for foundation Work Orders ("root manifests" grant in work-items.md): the frozen baseline requires the committed lockfile.
- Layer matrix authoritative: experience must not import app (apps consume experience, never the reverse); enforced by dual layers (scripts/boundary-check.mjs + packages/eslint-config/boundary.mjs).
- next build (15.5.x) rewrites apps/web/next-env.d.ts; handled via committed canonical pre-build file + typecheck sequenced after build.
- Known non-blocking: boundary source-scan is regex-based (stdlib-only), triple-reinforced; .gitignore left untouched (governance) so build-artifact churn stays untracked noise.

Every merge must update this file before advancing.
