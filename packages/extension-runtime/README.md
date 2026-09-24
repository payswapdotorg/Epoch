# @epoch/extension-runtime

Owned by Work Order **W008** (`packages/extension-sdk/*`,
`packages/extension-runtime/*`, `runtimes/wasm/*`). Kernel layer.

The sandboxed **HOST** machinery model for capability-scoped extension
hosting (architecture lock rules 9/10): admission with digest
verification and capability-registry binding resolution, permission
enforcement at the boundary (grant checks on EVERY host call, typed
denials with precise paths), typed invocation envelopes, in-memory
reference host state, and deterministic execution-surface descriptions.

In-memory reference behavior only: **no persistence, no UI, no workflow
engine, no network**. Serialization-friendly by construction (plain
JSON records, sorted iteration, total entry points).

## The sandbox boundary

`ExtensionSandboxHost.admitExtension` runs the admission pipeline:
manifest validation against the runtime's full structural MIRROR of the
SDK manifest contract (defense in depth — the boundary never trusts
author-side tooling), digest verification (tamper detection), duplicate
admission rejection, and capability binding resolution against a live
`@epoch/capability-registry` (unknown / version-unsatisfied /
retired-only bindings are typed errors).

`ExtensionSession.invoke` runs the enforcement pipeline: envelope
validation, session identity, extension lifecycle (retired sessions
stop serving), capability scope (unbound capability = sandbox
violation), grant allow-list (undeclared host function / missing
resource scope / cross-capability access = typed permission denials),
per-function payload contract validation, dispatch to the in-memory
host state, and response contract validation. Every call (permitted or
denied) lands in the deterministic audit trail.

`ExtensionSession.describeSandboxSurface` returns the deterministic
execution-surface description — the machine-checkable boundary the
extension actually runs against (content address, resolved binding
pins, frozen grants; sorted everywhere).

## Dependency discipline (W008 pin)

Runtime dependencies: exactly `@epoch/agent-protocol` and
`@epoch/capability-registry`. The `@epoch/extension-sdk` contract
surface is consumed through the parity-pinned structural mirror
(`src/mirror.ts` + `src/schema.ts` + `src/parity.ts` +
`test/sdk-parity.test.ts` — devDependency only, the W002/W006/W007
kernel-to-kernel pattern).

## runtimes/wasm

This package also carries the typecheck (`tsconfig.wasm.json`) and the
`wasm-layout` vitest project for `runtimes/wasm` — the Wasm Component
Model host-side layout machinery (self-contained, non-workspace, the
`contracts/*` precedent for non-package directories).

## Versioned contract surface

`schemas/` holds the committed JSON Schema (draft 2020-12) projection
of the runtime-owned documents (envelopes, outcomes, descriptions,
audit records); `test/contract-drift.test.ts` pins them byte-identical
to the emission (regeneration: `EPOCH_UPDATE_CONTRACTS=1 pnpm
--filter @epoch/extension-runtime test contract-drift`). The manifest
mirror is deliberately NOT re-emitted — the SDK owns that contract
emission.

## Commands

```
pnpm --filter @epoch/extension-runtime typecheck   # both tsconfigs (package + runtimes/wasm)
pnpm --filter @epoch/extension-runtime lint
pnpm --filter @epoch/extension-runtime test        # both vitest projects (runtime + wasm-layout)
```
