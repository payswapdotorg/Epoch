# Work Order W065 — Fabric Asset-Binding Contract v1.2.0 (ACR-010)

One Work Order = one branch = one PR. Workers never merge.

## Scope

The frozen-first contract bump + the fabric-level asset-binding operation.
This is the ONLY work order that may write the renderer contract surface; it
runs alone on that surface (no parallel contract writes).

## Depends

— (base: main at ACR-010 activation). Concurrent with W064 (docs-only,
disjoint) and W066 (world-experience, disjoint).

## Owned surfaces

- `contracts/renderers/*` (manifest.json, index.d.ts, schemas, parity.ts, README)
- `packages/renderer-fabric/*` (fabric, adapter types, reference adapter, tests)

## Deliverables

1. Contract v1.2.0 (additive):
   - `manifest.json` contractVersion → 1.2.0; protocolVersion and
     fabricProtocolVersion UNCHANGED.
   - The typed fabric-level operation:
     `bindSessionAsset(input: { sessionId: string; binding: RendererAssetBinding; atMs: number }) → FabricResult<RendererAssetBindingReceipt>`.
   - `RendererAssetBindingReceipt`: content-addressed (the sealed binding's
     digest), tenant-scoped, carries rendererId, the applied/declined outcome,
     and the atMs. Typed refusal reasons for: unknown session, undeclared asset
     kind, tenant-scope mismatch, adapter refusal/absence of the optional seam.
   - The optional adapter-seam `bindAsset` is UNCHANGED (both real adapters and
     the reference adapter already implement it; zero adapter-package changes in
     this order).
2. The fabric implementation: session resolution → adapter capability/asset-kind
   check → adapter-seam `bindAsset` application → typed receipt. Failure paths
   are typed refusals, never raw throws; no partial application on refusal.
3. Deterministic proof over the reference adapter (and, if the local link state
   allows, a real-adapter session-level proof mirroring the
   qa/foundation-renderers composition — assert only what actually runs).
4. Tests: every negative path (unknown session, undeclared kind, tenant
   mismatch, adapter refusal, absent optional seam) + the positive path; the
   existing renderer-fabric battery stays green (36/36 baseline + new tests).
   renderer-runtime battery untouched-green (no runtime changes in this order).
5. Typecheck + lint green for the touched packages.

## Rules

- Frozen-contract discipline: additive only; nothing existing is renamed,
  narrowed, or moved. parity.ts updated for the new operation.
- No new dependencies. No root manifest/lockfile edits. No governance-state
   edits. No host/app changes (W067's surface).
- PR body states: Work Order, dispatch base SHA, final head SHA, owned paths,
  verification commands + counts, evidence, limitations, architecture questions.
