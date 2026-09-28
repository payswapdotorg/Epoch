# The Adapter SDK Guide (W035)

How to SERVE a registered capability as an adapter
(`@epoch/adapter-sdk`, Work Order W007) — the per-category typed
contracts every concrete Capability Fabric adapter implements. The
runnable companion is
[`examples/sdk/adapter-example.ts`](../../examples/sdk/adapter-example.ts),
exercised by `release/test/examples.test.ts`.

## What the SDK is (and is not)

The adapter SDK is the CONTRACT layer: typed descriptors, typed
request/response envelopes discriminated by the eight Capability
Fabric categories, bind-time version negotiation, a typed error
taxonomy, and deterministic descriptor serialization. It ships ZERO
concrete adapters (the reference set — Git/IFC/MCP/FMI — is W029) and
zero runtime machinery (the extension runtime is W008). Any
vendor/model/API surface is a property of YOUR adapter, never of the
SDK (architecture lock rule 13).

## The descriptor

```ts
const descriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:stress-solver',
  category: 'simulation',
  displayName: 'Stress Solver Adapter',
  description: 'Runs the registered stress-analysis capability.',
  binding: {
    capabilityId: 'engineering.stress-analysis',
    versionRange: { kind: 'caret', version: '1.0.0' },
  },
};
```

- The **binding** declares which capability id + version range the
  adapter serves — `exact` or `caret`, NEVER a floating reference.
- The descriptor is content-addressed:
  `computeAdapterDescriptorDigest(descriptor)` is the SHA-256 of the
  canonical JSON — the adapter's exact-revision address that flows
  into every binding pin.
- `parseAdapterDescriptor` is the total admission path (strict objects
  reject unknown fields).

## Bind-time version negotiation

```ts
const negotiated = negotiateBinding(descriptor, capabilityRecord);
// → { ok: true, value: BindingPin } | { ok: false, error: AdapterSdkError }
```

Negotiation checks, in order: identity (the binding's capability id
matches the record), category (the adapter implements the category the
capability is registered under), lifecycle (retired capabilities never
bind), and version (the capability version satisfies the declared
range). The result is a `BindingPin` — capability manifest digest +
adapter descriptor digest, both content-addressed — or a typed error:

| Error | When |
| --- | --- |
| `binding-conflict` | id or category mismatch |
| `lifecycle-conflict` | the capability is retired |
| `version-unsatisfied` | the record's version does not satisfy the range (carries the constraint + available versions) |

`negotiateBestBinding` picks the highest satisfying non-retired
version deterministically (version descending, manifest digest
ascending as the tie-break — no insertion-order leaks).

The capability record flows in through the SDK's structural
`BindableCapability` view — REAL registry records are directly
assignable (pinned by the registry-parity tests inside
`packages/adapter-sdk/test/`).

## Per-category envelopes

Each category has typed request/response payload shapes, mirrored
(parity-pinned) from the kernel contracts: `simulation` mirrors W005's
invocation inputs/outcomes; `evaluator` mirrors the evaluation subject/
criteria/verdict; `action` mirrors W003's target/parameters — adapters
EXECUTE authorized interventions, proposals and authorization belong
to the Action Gateway (lock rule 3); `verification` mirrors W006's
stage/run-status/evidence digests; the four neutral categories
(`source`, `semantic`, `reconstruction`, `visualization`) use the
named-input/output neutral records.

## Where the evidence lives

- Descriptor admission, negotiation positive/negative, determinism,
  registry parity, contract drift: `packages/adapter-sdk/test/`.
- The runnable validate → content-address → negotiate →
  typed-`version-unsatisfied` path:
  `release/test/examples.test.ts` — "examples/sdk — adapter (W007)".
- The byte-stability of the whole example:
  `release/test/determinism.test.ts` — "the adapter example is
  byte-stable across runs".

## Version pins

The current published contract surface is pinned in
[`sdk-versions.md`](./sdk-versions.md) and machine-checked by
`release/test/contract-sync.test.ts`.
