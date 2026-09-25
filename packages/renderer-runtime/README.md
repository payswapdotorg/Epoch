# @epoch/renderer-runtime

Epoch Renderer Runtime **hosting surface** (Work Order W013, experience
layer).

The typed, provider-neutral BOUNDARY that hosts renderers (architecture.md
— binding): abstract **renderer descriptors** (kind, capabilities, budgets
as typed data), **renderer session binding** (descriptor x device-session
snapshot, with negotiated effective limits), typed **invocation
envelopes** (`mount-graph` / `advance-frame` / `submit-intent`), and
**capability/budget enforcement at the boundary** — anything not declared
is denied with typed errors (the W008 permission pattern applied to
renderers). Execution evidence is content-addressed (sealed receipts).

The runtime EXECUTES plans, it never authors them: it consumes
render-ready typed structures (W011 Experience Graphs, referenced by
content digest — and, transitively, future compiler output, which emits
the same contract).

## Non-negotiables

- **Provider-neutral by construction (lock rule 13).** ZERO engine
  imports, ZERO GPU code, ZERO UI-framework dependencies; renderer
  descriptors are abstract typed data and concrete engines (any graphics
  stack) are future adapters behind the descriptor contract (W019).
  Strict zod objects reject vendor/engine fields with precise typed
  paths.
- **Tenant isolation (R12).** Bindings and receipts are tenant-scoped;
  cross-tenant binding, invocation, graph mounting, and document access
  are typed `cross-tenant-denied` rejections.
- **Digest discipline.** Bindings and receipts are digest-sealed (canonical
  JSON → SHA-256, machinery reused from `@epoch/agent-protocol`); a mount
  envelope must claim the graph's true content digest; admission rejects
  claimed digests that do not match content (tamper detection).
- **Determinism.** Zero wall-clock, zero randomness in `src/`; invocation
  ids are caller-scoped and replays produce byte-identical receipts
  (idempotent, content-addressed execution evidence, R26).
- **Execution, never authority (lock rules 3/8/16).** Control intents are
  recorded as typed evidence (R30, shape-compatible with the
  action-protocol `ActionTypeReference`); semantic routing is the future
  Action Gateway wiring, never this package.

## Runtime dependencies (the W013 pin)

- `@epoch/agent-protocol` — canonical digest machinery and the shared
  invocation-id grammar.
- `@epoch/experience-protocol` — the consumed W011
  descriptor/device/graph vocabulary (genuine runtime consumption; graph
  admission inside mount invocations runs through the W011 total
  admission surface).

No other `@epoch` runtime dependencies. Compatibility with the host
model's device-session record (`@epoch/experience-runtime`) is pinned via
**devDependency** compile-time and runtime parity tests
(`src/host-parity.ts`, `test/host-parity.test.ts` — the W011
kernel-parity precedent): the hosting surface and the host model are
siblings over the shared W011 vocabulary, not a stack.

## Published contract

The shared versioned contract tree at `contracts/renderers/` (the
W002-W004 convention): self-contained TypeScript declarations
(`index.d.ts`), compile-time parity assertions (`parity.ts`, compiled by
`tsconfig.contracts.json`), the manifest (`manifest.json`), and the
committed JSON Schema projection (`schemas/`) emitted deterministically by
`renderRendererContractFiles()`. Regenerate after an intentional schema
change with:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-runtime test contract-drift
```

## Battery

```
pnpm --filter @epoch/renderer-runtime typecheck
pnpm --filter @epoch/renderer-runtime lint
pnpm --filter @epoch/renderer-runtime test
```
