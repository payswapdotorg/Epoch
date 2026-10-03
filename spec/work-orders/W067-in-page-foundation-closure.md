# Work Order W067 — In-Page Foundation Path Closure (ACR-010)

Worker Count: 1

One Work Order = one branch = one PR. Workers never merge.

## Scope

The in-page composition: the runtime application of the binding effect through
the W065 fabric operation, the Epoch-owned host affordances (web + desktop),
and the leg-14 battery closure with the program records.

## Depends

W065 + W066 (both merged). Base: main at the last dependency merge.

## Owned surfaces

- `packages/world-runtime/*`
- `apps/web/src/features/world/*`, `apps/web/e2e/*`
- `apps/desktop/*` (the world section)
- `docs/journeys/interactive-world.md`, `docs/rendering/closure.md`
  (the closure records)

## Deliverables

1. Runtime application: the `binding-requested` effect (W066) applied through
   `RendererFabric.bindSessionAsset` (W065) on the live session; typed refusal
   paths surface honestly (journal-recorded, session stays healthy).
2. The Epoch-owned import affordance (NO vendor UI) on the web `/world` host
   and the desktop world section: import a glTF/GLB → the bridge
   validate/normalize/content-address/seal → the typed `bind` intent → the
   receipt + the digest-addressed bound-asset ledger presented in the world
   surface.
3. The leg-14 battery leg becomes REAL (`apps/web/e2e/j13-world.spec.ts`):
   - the glTF-bridge path (no Blender needed): in-page import of a canonical
     glTF fixture → typed bind → assertions: the sealed binding digest; the
     bound-asset ledger digest-addressed; the presented semantic entity ids
     UNCHANGED; the canonical world digest UNCHANGED; the typed receipt in the
     journal;
   - the Blender-live variant (sidecar export → UNTRUSTED re-entry → validated
     binding → in-page bind) rides the env-gated binary per the W064 method:
     honestly env-gated in the e2e (skipped without `EPOCH_BLENDER_LIVE=1` +
     `EPOCH_BLENDER_PATH`, run with them);
   - the degradation path: binding on the no-GL/reference fallback (the
     reference adapter's seam) asserted in the degradation project.
4. The desktop world-section battery extension mirrors the in-page path
   (follow the existing desktop world-host battery pattern).
5. Closure records: `docs/journeys/interactive-world.md` — the leg-14 verdict
   flip (NOT-RUNNABLE → PASS with the exact evidence) + the NOT-VERIFIED-live
   ledger update (the leg-14 in-page bullet closes; the Blender-live e2e leg
   and GPU stay honestly recorded); `docs/rendering/closure.md` — the
   ACR-010 program closure record.
6. Verification: the world-runtime battery green (70/70 baseline + new); the
   web world host batteries green; the desktop suite green; the j13-world
   battery 4 passed (the leg-14 test + the existing 3) with the env-gated live
   leg honestly skipped-or-run; typecheck + lint green for touched packages.

## Rules

- The trust gate is NOT weakened: only sealed, content-addressed, tenant-scoped
  bindings are bindable; untrusted bytes stay typed refusals (the
  qa/foundation-renderers negative battery stays green untouched).
- No semantic-authority changes: the World Model, Action Gateway, Constraint
  Engine and Verification planes are untouched; the bound-asset ledger is
  digest-addressed experience state.
- No new dependencies. No root manifest/lockfile edits. No governance-state
  edits (AI_CONTINUATION.md / spec/development-state/* / spec/PROJECT-STATE.md
  are Tech Lead at-merge work). No adapter-package changes (their seam is done).
- PR body states: Work Order, dispatch base SHA, final head SHA, owned paths,
  verification commands + counts, evidence (screenshots for the in-page path),
  limitations, architecture questions.
