# The Capability Registry Guide (W035)

How to REGISTER a capability in Epoch's capability registry
(`@epoch/capability-registry`, Work Order W007) — the vocabulary every
listing, extension and adapter binds to. The runnable companion is
[`examples/sdk/capability-registration.ts`](../../examples/sdk/capability-registration.ts),
exercised by `release/test/examples.test.ts`.

## What a capability is

A capability is a typed, versioned, content-addressed record of WHAT
Epoch can do: an identity (`engineering.stress-analysis`), a category
(one of the eight Capability Fabric categories — `source`, `semantic`,
`reconstruction`, `visualization`, `simulation`, `evaluator`, `action`,
`verification`), a semver-core version, an input/output descriptor, the
contract references it exposes, and its trust origin (`first-party`,
community, external, provisional). The registry is the authority for
the vocabulary; listings (W023), extensions (W008) and adapters (W007)
RESOLVE against it — they never carry their own private version
catalog.

## The registration path

```ts
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
  type CapabilityRegistration,
} from '@epoch/capability-registry';

const manifest = {
  schemaVersion: 1,
  capabilityId: 'engineering.stress-analysis',
  category: 'simulation',
  version: '1.2.3',
  descriptor: {
    displayName: 'Stress Analysis',
    description: 'Linear static stress analysis.',
    inputs:  [{ name: 'load-kn', kind: 'number', required: true, unit: 'kN' }],
    outputs: [{ name: 'max-stress-mpa', kind: 'number', required: true, unit: 'MPa' }],
    assumptions: ['Linear-elastic behavior.'],
  },
  contracts: [],
  trust: { origin: 'first-party' },
};

const registration: CapabilityRegistration = {
  manifest,
  digest: computeCapabilityManifestDigest(manifest),
};

const registry = new CapabilityRegistry();
const registered = registry.register(registration);   // RegistryResult<CapabilityRecord>
```

1. **Build the manifest** as typed data (the admission path validates —
   strict objects reject unknown fields, so vendor properties cannot
   sneak in through an open door).
2. **Compute the canonical digest** — the SHA-256 of the canonical
   JSON of the manifest: the capability's exact-revision content
   address. Registration verifies the claimed digest against the
   content (`digest-mismatch` on tamper).
3. **Register** in the in-memory registry. The result is TOTAL
   (`RegistryResult<T>`): a value or a typed error — never a throw.
   Re-registering the same `(capabilityId, version)` is the typed
   `duplicate-capability` rejection — versioned capabilities ship
   changed content as a NEW version, never a mutation.
4. **Resolve** at the exact version (`registry.get`) or by constraint
   (`registry.resolve`), and list with filters.

## The lifecycle vocabulary

Records carry a closed lifecycle state machine
(`registered` → `deprecated` → `retired`, with validated transitions):
retired capabilities never bind (adapters refuse — the
`lifecycle-conflict` negotiation error); deprecation is advisory and
still binds.

## The deterministic guarantees

- **Content addressing:** identical manifests derive identical
  digests; the digest is part of every binding pin downstream.
- **Total admission:** every failure is a typed `RegistryError` value
  with a precise code and path.
- **Parity:** the semver machinery is duplicated from (and
  parity-pinned against) the adapter SDK — both implementations run
  over a shared corpus with identical results.

## Where the evidence lives

- Registry positive/negative admission, semver, manifest
  digest/tamper, contract drift: `packages/capability-registry/test/`
  (`manifest.positive.test.ts`, `manifest.negative.test.ts`,
  `registry.positive.test.ts`, `registry.negative.test.ts`,
  `semver.test.ts`, `contract-drift.test.ts`).
- The runnable registration + resolution + listing path:
  `release/test/examples.test.ts` — "examples/sdk — capability
  registration (W007)".

## Version pins

The current published contract surface is pinned in
[`sdk-versions.md`](./sdk-versions.md) and machine-checked by
`release/test/contract-sync.test.ts`.
