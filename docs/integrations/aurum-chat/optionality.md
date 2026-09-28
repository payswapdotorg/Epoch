# The optionality guarantee (W042)

The acceptance, verbatim: **"Core project flows remain functional with
no bridge installed."** The bridge is an OPTIONAL capability — never a
lifecycle authority, never a required dependency of any core kernel.

## Why it holds (by construction)

1. **The bridge is a pure library.** Nothing in
   `@epoch/external-event-bridge` runs at import: no auto-registration,
   no background tasks, no side effects. The in-memory reference host
   (`ExternalEventBridgeRuntime`) is constructed explicitly by the
   embedding application.
2. **The import direction is one-way.** Adapters and hosts import the
   bridge; the bridge imports only the adapter SDK, the shared
   protocol primitives, and tenancy. No core package declares a
   dependency on the bridge and no core package source imports it —
   verified structurally by the no-bridge test, which scans every
   sibling package manifest and source file.
3. **The bridge owns no authority.** Observations belong to the W036
   delivery authority (the bridge only PROPOSES intake); authorization
   belongs to W009 (consumed decisions); visibility belongs to the W041
   projection policy (consumed references); change history belongs to
   W010 (W010-shaped facts). Removing the bridge removes an exchange
   seam — never an authority.
4. **Lifecycle neutrality.** The bridge may acquire information or
   relay supervision for ANY domain pack, and carries zero
   pack-specific branches (`pack-branching-rejected`), so no pack's
   flows can depend on the bridge's presence either.

## The evidence test

`packages/external-event-bridge/test/no-bridge-operation.test.ts`
deliberately imports ONLY core kernel packages — it never imports
`@epoch/external-event-bridge`, not even the types or the shared test
fixtures — and runs their reference fixtures:

- a REAL W036 observation seals through the REAL delivery authority
  path (`sealDistinctionRecord`);
- a REAL W010 event appends to a REAL stream (`EventLog.appendEvent`
  after `sealEvent`);
- a REAL W041 projection policy seals as data (`sealProjectionPolicy`);
- structurally: no core package manifest declares a dependency on the
  bridge, and no core package source imports it.

## What "installing" the bridge adds

- A provider-neutral exchange seam: normalized inbound events and
  four-class outbound requests.
- The runtime host with the W009 gate, idempotent intake/dispatch,
  class-based provider resolution, typed retries, per-attempt
  receipts, and the three fallback modes.
- The `bridge:*` event vocabulary over the W010 shapes.

None of these change any core flow's behavior when absent — and the
fallback discipline guarantees that even when INSTALLED, a missing
provider degrades to explicit unresolved records rather than affecting
core behavior.
