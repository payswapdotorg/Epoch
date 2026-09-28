# SDK Documentation (W035)

Owned by Work Order **W035** (`docs/sdk/*`). This folder is the
developer-facing documentation of the Epoch SDK surfaces — the four
documented packages a capability author, adapter author, extension
author or marketplace developer programs against, plus the runnable
examples that prove every documented path.

## The surfaces

| Surface | Package | Guide |
| --- | --- | --- |
| Capability registration | `@epoch/capability-registry` (W007) | [`capability-registry-guide.md`](./capability-registry-guide.md) |
| Capability adapters | `@epoch/adapter-sdk` (W007) | [`adapter-sdk-guide.md`](./adapter-sdk-guide.md) |
| Extensions | `@epoch/extension-sdk` (W008) | [`extension-sdk-guide.md`](./extension-sdk-guide.md) |
| Marketplace listings | `@epoch/marketplace` (W023) | [`marketplace-listing-guide.md`](./marketplace-listing-guide.md) |

The version matrix of every surface — contract versions, record
versions, schema-surface sizes, and the sync discipline — is
[`sdk-versions.md`](./sdk-versions.md). It is MACHINE-CHECKED: the
declared versions are compared against the constants the packages
actually export by `release/test/contract-sync.test.ts`, so a drifted
doc fails the release-readiness gate by construction.

## The runnable examples

Every guide's code paths exist as runnable, deterministic example
modules under [`examples/sdk/`](../../examples/sdk/README.md) — plain
TypeScript over the real packages through their public APIs, exercised
end to end by `release/test/examples.test.ts` and byte-stability-pinned
by `release/test/determinism.test.ts`.

## The one rule

**The SDK surfaces are contracts, not implementations of business
logic.** The adapter SDK ships zero concrete adapters; the extension
SDK ships zero concrete extensions; the marketplace kernel ships zero
monetization logic. Every vendor/provider surface is a property of
concrete adapters behind the seams (architecture lock rule 13). The
guides therefore document CONTRACTS: typed admission paths, typed error
taxonomies, deterministic digests, and the parity pins that keep the
docs honest.
