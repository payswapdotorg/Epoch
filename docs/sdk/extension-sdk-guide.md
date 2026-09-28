# The Extension SDK Guide (W035)

How to AUTHOR an Epoch extension (`@epoch/extension-sdk`, Work Order
W008) — the typed authoring surface behind the sandboxed extension
host. The runnable companion is
[`examples/sdk/extension-example.ts`](../../examples/sdk/extension-example.ts),
exercised by `release/test/examples.test.ts`.

## What authors program against

Extension authors write a DECLARATIVE MANIFEST plus (per flavor) typed
entry points; the sandboxed host machinery that admits, enforces and
invokes extensions is `@epoch/extension-runtime` — this SDK never
ships host behavior, zero concrete extensions, zero React machinery.

## The manifest

```ts
const manifest = {
  schemaVersion: 1,
  extensionId: 'extension:stress-toolkit',
  version: '1.2.3',
  displayName: 'Stress Toolkit',
  description: 'Stress analysis contributions for structural workflows.',
  flavor: 'declarative',                       // declarative | ui | wasm | remote
  capabilityBindings: [
    { capabilityId: 'engineering.stress-analysis',
      versionRange: { kind: 'caret', version: '1.0.0' } },
  ],
  grants: [
    {
      capabilityId: 'engineering.stress-analysis',
      hostFunctions: ['clock.read', 'log.write', 'world.read'],
      resourceScopes: [{ resource: 'world', access: 'read' }],
    },
  ],
  entryPoints: [/* per-flavor entry point records */],
  contracts: [{ contractId: 'epoch.extension-sdk', contractVersion: '1.0.0' }],
  trustClass: 't2',
  license: 'Apache-2.0',
  dataHandling: { classification: 'sandbox-only' },
  sideEffects: [{ kind: 'evidence-append', description: '…' }],
};
```

- **Capability bindings** point at the W007 registry vocabulary;
  binding to unknown or retired capabilities is rejected by the host.
- **Grants are the allow-list surface** (lock rules 9/10): per bound
  capability, a set of host functions from a closed, narrow vocabulary
  plus resource scopes. Anything not explicitly granted is denied at
  the boundary with a typed error and a precise path.
- **The trust class (T0..T4) materializes as a grant ceiling** —
  escalation by declaration is inexpressible.
- The four **flavors** shape the entry points: `declarative`
  (contributions), `ui` (abstract typed surface declarations), `wasm`
  (component model descriptors), `remote` (service descriptors).

## Content addressing

`computeExtensionManifestDigest(manifest)` is the SHA-256 of the
canonical JSON — the extension's exact-revision address. A
registration envelope whose claimed digest does not match the content
is rejected (`digest-mismatch` — tamper detection at the sandbox
boundary).

## The admission paths

- `parseExtensionManifest(input)` — total: a value or a typed
  `validation` error with flattened issue paths.
- `sealExtensionManifest(manifest)` — the registration envelope
  (manifest + recomputed digest).
- `verifyExtensionManifestDigest(registration)` — round-trip
  verification.

## Where the evidence lives

- Manifest positive/negative admission, lifecycle transitions, host
  contract surface, Wasm descriptors, neutrality, contract drift:
  `packages/extension-sdk/test/`.
- Cross-package parity with the host's structural mirror:
  `packages/extension-runtime/test/` (the sdk-parity suite).
- The runnable author → parse → seal → round-trip-verify path:
  `release/test/examples.test.ts` — "examples/sdk — extension (W008)".

## Version pins

The current published contract surface is pinned in
[`sdk-versions.md`](./sdk-versions.md) and machine-checked by
`release/test/contract-sync.test.ts`.
