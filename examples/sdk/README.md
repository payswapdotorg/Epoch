# W035 Reference SDK Examples — the runnable documentation

The five deterministic example modules behind the SDK documentation
set — every documented path exists here as RUNNABLE code over the REAL
workspace packages through their public admission paths (no mocks; no
kernel internals; failures throw loudly with the kernel's typed error).

## The modules

| Module | Surface | What it runs |
| --- | --- | --- |
| [`shared.ts`](./shared.ts) | — | The shared vocabulary: the fixed instant series `T[…]`, tenants, principals, the release engineer actor (zero wall-clock, zero randomness, zero network) |
| [`capability-registration.ts`](./capability-registration.ts) | `@epoch/capability-registry` (W007) | Register a capability (manifest → canonical digest → registry), resolve at the exact version, list |
| [`adapter-example.ts`](./adapter-example.ts) | `@epoch/adapter-sdk` (W007) | Validate + content-address an adapter descriptor, negotiate the binding against the REAL registered record, observe the typed `version-unsatisfied` rejection |
| [`extension-example.ts`](./extension-example.ts) | `@epoch/extension-sdk` (W008) | Author a declarative extension manifest, parse it, seal it, round-trip verify its digest |
| [`marketplace-listing-example.ts`](./marketplace-listing-example.ts) | `@epoch/marketplace` (W023) | Publish two hash-chained listing versions, verify the chain, resolve capability references through the real registry, grant → check → revoke → check (the entitlement flip), meter usage, fold twice in different orders, record revenue with full provenance |
| [`release-readiness-example.ts`](./release-readiness-example.ts) | `@epoch/release-kit` (W035) + the above | The end-to-end release: declare the scope, derive the checklist, complete every item with typed evidence (SDK pins read from the REAL packages), evaluate READY, seal the manifest, journal the `release:readiness` events, fold the replay |

Every module exports a typed runner (`run…Example()`) and a canonical
**digest projection** (`…DigestProjection()`) — the determinism gate:
two runs in the same process produce byte-identical projections
(asserted by `release/test/determinism.test.ts`).

## Determinism discipline

Zero wall-clock (every instant is a `T[…]` constant), zero randomness
(every id explicit), zero network (no external system is contacted).
The marketplace example composes the real W007 registry and the real
W023 kernel; the release example additionally seals a real W034 budget
+ verdict pair over the `@epoch/performance` public sealing APIs.

## Running the examples

The examples are exercised by the release kit's evidence suite (they
are importable modules, not scripts — the W031 `examples/e2e`
pattern):

```bash
# from the repository root, after `pnpm install`
pnpm --filter @epoch/test-harness exec vitest run --root ../../release
```

The suite asserts every example's typed OUTCOME (not merely "does not
throw") in `release/test/examples.test.ts`, and byte-stability of every
digest projection in `release/test/determinism.test.ts`.

## Importing

These modules are plain TypeScript over the workspace packages; the
release suite imports them relatively (`release/test/examples.test.ts`).
From anywhere with the workspace packages resolvable:

```ts
import { runReleaseReadinessExample } from
  '<repo-root>/examples/sdk/release-readiness-example';
```
