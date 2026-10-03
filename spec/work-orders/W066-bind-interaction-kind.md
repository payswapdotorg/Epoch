# Work Order W066 — The Bind Interaction Kind (ACR-010)

One Work Order = one branch = one PR. Workers never merge.

## Scope

The closed world-interaction vocabulary gains the `bind` kind with its typed
admission path and experience-scoped effect.

## Depends

— (base: main at ACR-010 activation). Concurrent with W064 (docs-only,
disjoint) and W065 (contracts/renderers + renderer-fabric, disjoint).

## Owned surfaces

- `packages/world-experience/*`

## Deliverables

1. The `bind` kind added to `WORLD_INTERACTION_KINDS` (version.ts) + the schema
   registry entry (follow the existing kind entries' pattern).
2. The intent payload shape: a VALIDATED binding REFERENCE — the sealed
   binding's content address + tenant scope. NEVER untrusted raw bytes (the
   trust gate stays upstream in the glTF bridge). The payload validates typed;
   malformed references are typed refusals.
3. `WORLD_INTENT_TYPE_VERSION` 1.0.0 → 1.1.0 (additive kind); package semver
   minor bump per house convention.
4. The canonical admission path for `bind` (mirroring the existing kinds) with
   the effect `binding-requested` — experience/presentation-scoped:
   - it never awaits a semantic authority (like the existing effect-only
     intents);
   - it never mutates durable semantic state — pinned by a NEW negative test;
   - the canonical world digest is UNCHANGED by an admitted bind — pinned by a
     NEW test (the qa/foundation-renderers invariant re-pinned at the admission
     seam).
5. The journal/reducer records the effect (follow the existing effect records).
6. Tests: the world-experience battery stays green (268/268 baseline + new);
   the qa harness cold typecheck green; typecheck + lint green.

## Rules

- Closed-vocabulary extension only: the existing kinds are untouched.
- No world-model, action-protocol, or experience-protocol contract changes
  (the ControlIntent bridge is a namespace string + version — no registry
  change).
- No new dependencies. No root manifest/lockfile edits. No governance-state
  edits. No fabric/contract/host changes (W065/W067 surfaces).
- PR body states: Work Order, dispatch base SHA, final head SHA, owned paths,
  verification commands + counts, evidence, limitations, architecture questions.
