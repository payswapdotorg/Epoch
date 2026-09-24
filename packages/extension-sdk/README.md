# @epoch/extension-sdk

Owned by Work Order **W008** (`packages/extension-sdk/*`,
`packages/extension-runtime/*`, `runtimes/wasm/*`). Kernel layer.

The typed **AUTHORING** surface of Epoch extensions (architecture.md,
"Extensions" — binding): declarative manifests across the four extension
flavors (**declarative**, **ui**, **wasm**, **remote**), capability-scoped
permission grants with trust-class ceilings, the narrow typed
host-function contract surface, extension lifecycle vocabulary, a typed
error taxonomy, and deterministic content-addressed serialization.

Extension authors program against this package; the sandboxed HOST
machinery that admits, enforces, and invokes extensions is
`@epoch/extension-runtime` (parity-pinned mirrors, no runtime coupling);
the Wasm Component Model host-side layout machinery is `runtimes/wasm`.

## Scope discipline (W008)

- **Zero concrete extensions**, zero vendor adapters, zero endpoints,
  zero React rendering machinery (the `ui` flavor ships abstract typed
  entry-point declarations only — the app renders later, W014+);
  React is NOT a dependency.
- Provider-NEUTRAL by construction (lock rule 13): every vocabulary
  names roles and boundaries, never vendors; strict objects reject
  unknown (vendor) fields.
- Runtime dependencies: exactly `@epoch/agent-protocol` (canonical
  digests, shared primitives) and `@epoch/capability-registry`
  (capability binding vocabulary — constraints, contracts, lifecycle) —
  genuine runtime composition per the W008 Tech Lead pin.

## The permission model (lock rules 9/10)

An extension manifest binds registered capabilities (the W007 registry
vocabulary; binding to unknown or retired capabilities is rejected by
the host) and declares **grants** — the allow-list surface: per bound
capability, a set of host functions (from a closed, narrow, 7-function
vocabulary) plus resource scopes. Anything not explicitly granted is
denied at the boundary with a typed error and a precise path. The
declared trust class (T0..T4) materializes as a **grant ceiling** —
escalation by declaration is inexpressible.

## Versioned contract surface

| Path | What it is |
|---|---|
| `src/index.ts` | Typed index export + version constants (`EXTENSION_SDK_CONTRACT_VERSION` 1.0.0). |
| `src/schema.ts` | Runtime zod validators (strict objects; sorted-set semantics; security refinements). |
| `src/parity.ts` | Compile-time contract sync: zod inference must equal the published types. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection; digests in `schemas/manifest.json`. |
| `test/contract-drift.test.ts` | Pins the committed schema files byte-identical to the emission (regeneration: `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/extension-sdk test contract-drift`). |
| `test/sdk-parity` (in `@epoch/extension-runtime`) | Cross-package parity: the host's structural mirror is member-for-member identical (devDependency tests). |

Serialized manifests carry `schemaVersion: 1` and are content-addressed:
the SHA-256 of the canonical JSON is the exact-revision address
(`computeExtensionManifestDigest`); a registration envelope whose
claimed digest does not match the content is rejected
(`digest-mismatch` — tamper detection).

## Commands

```
pnpm --filter @epoch/extension-sdk typecheck
pnpm --filter @epoch/extension-sdk lint
pnpm --filter @epoch/extension-sdk test
```
