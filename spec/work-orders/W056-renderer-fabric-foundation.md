# W056 — Renderer Fabric & Multi-Renderer Switching Contract

**Depends:** ACR-006/W055 complete  
**Concurrency:** serialized, 1 worker

**Owned surfaces**
- `contracts/renderers/*`
- `packages/renderer-runtime/*`
- `packages/renderer-adapters/*`
- `packages/renderer-fabric/*`
- `spec/renderer-fabric-architecture.md`
- `docs/rendering/*`
- `qa/renderer-conformance/*`

## Objective

Turn the W013 renderer hosting surface into a real provider-neutral Renderer Fabric that can resolve, create, switch and dispose renderer sessions while preserving canonical Epoch world semantics.

## Required

- typed renderer descriptor/capability model;
- adapter lifecycle;
- ephemeral renderer session;
- renderer switching and portable view-state snapshot;
- typed failure/degradation/fallback;
- capability-registry integration;
- conformance harness;
- no engine imports in kernel contracts;
- no second semantic store.

## Acceptance

The shared fixture can mount a real adapter contract, normalize a user interaction, switch renderers and prove canonical identity/digest continuity without durable semantic mutation.

W056 freezes the shared contract for W057-W059.
