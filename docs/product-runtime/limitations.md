# W046 — Honest Limitations (what is explicitly NOT delivered)

This section is required by the W046 work order ("docs/product-runtime/ ... an explicit limitations section"). Everything below is deliberately out of scope for W046; nothing here is silently missing.

## 1. No client trees are modified

`apps/web`, `apps/desktop`, `apps/mobile` are UNTOUCHED (forbidden by the work order). W047/W048/W049 build the actual products on top of the runtime delivered here. There is no UI, no native packaging, no transport implementation (HTTP/IPC servers) in W046 — `ApplicationGatewayPort` is the seam the clients bind.

## 2. No native packaging, no real external PostgreSQL server in CI

- No Tauri/Expo artifacts (W048/W049).
- CI runs no external PostgreSQL server: **PGlite (embedded real PostgreSQL) stands in** for the real-engine adapter tests, exactly as the dependency intake pinned it (TEST-ONLY). See §4 for the catalog gap that currently defers even the embedded-engine execution.

## 3. Kernel semantic state is not yet PostgreSQL-backed

The persistence SPI makes PostgreSQL the durable authority for the GATEWAY's own records (sessions, idempotency, correlation) and is the proven seam for the record-store primitives. The KERNELS' semantic stores (world, solution, delivery, event log, ...) remain the W001-W045 in-memory reference implementations — binding kernel state to PostgreSQL is a FUTURE program (it requires kernel-store persistence design, not a gateway concern). "PostgreSQL is authoritative when enabled" is therefore scoped in W046 to: the gateway's durable records + the adapter + conformance/golden-SQL/real-engine proof of the seam.

## 4. The pg/pglite catalog gap (structural bindings; real-engine suite deferred to the reconcile)

The W046 dependency intake (PR #99) declared exact pins — `pg` 8.23.0 (service-layer driver only), `@types/pg` 8.23.1, `@electric-sql/pglite` 0.5.8 (TEST-ONLY embedded real PostgreSQL) — in `scripts/DEPENDENCY-BASELINE.md`, but the mechanical `pnpm-workspace.yaml` catalog entries did NOT land with it (PR #99 changed only the doc). Root manifests are Tech-Lead-serial and CI-protected; per the baseline's own missing-dependency procedure ("raise it as an Architecture Question in your PR"), this tree references NO npm module for the driver:

- the pg binding is STRUCTURAL — `bindPgPool(pool)` duck-types the pg 8.23.0 pool API; the deployment injects the instantiated driver;
- `packages/persistence` never imports a driver at all (pg boundary test enforces this);
- the pglite real-engine suite (`services/application-gateway/test/pglite-engine.test.ts`) is COMPLETE and wired, but loads the engine through a non-literal specifier: until the catalog entry materializes (Tech Lead foundation branch + post-merge lockfile reconcile) its engine-dependent tests report an explicit, named skip — never a silent green — and execute against real embedded PostgreSQL with zero code changes once the dependency resolves.

**Ad-hoc real-engine evidence (not committed):** the identical adapter + suite were executed against real `@electric-sql/pglite` 0.5.8 in a throwaway workspace replica (catalog entry + devDependency added outside the repository): the full shared conformance suite and the golden-SQL execution passed against the embedded real engine. This is recorded as PR evidence, not repo state, because the committed tree must not reference an unpinned dependency.

## 5. Single-process composition

The gateway composes the authorities IN-PROCESS (typed library surface). Real client->gateway transport (HTTP/WebSocket deployment, authentication of the transport itself, horizontal scale) is W047+ scope. Correlation is recorded in the durable ledger and echoed in envelopes; the kernels' own interfaces carry no correlation parameters (they are untouched — not W046 surfaces).

## 6. Operation depth varies by area

All 32 operations are implemented, mapped and dispatch-verified, but depth varies honestly:

- **Full happy paths + typed negatives**: session lifecycle, context, world reads, evidence intake/get (digest recomputation), solution seal/approve, program build/schedule, delivery open/observe/close, the complete action path (submit -> approve -> execute -> status) with idempotency + correlation, constraints, verification, recovery.replay.
- **Delegation-contract level** (the operation dispatches to the real authority and surfaces its typed rejection verbatim, but no happy-path fixture is exercised): discovery.run (needs a full DiscoveryInput + candidate pool), procurement.quote/order, actualization.forecast, outcome.learn, access.project, supervision.check, alerts.raise, marketplace.entitlement. These are thin delegations by design; deep product usage arrives with W047+ journey validation against the fixtures.

## 7. Session tokens are descriptors, not credentials

The authentication seam models sessions as digest-disciplined records projected from verified W009 results, with caller-supplied entropy for id derivation. Real credential handling, token rotation, and IdP adapters are NOT in W046 (and are explicitly not modeled as secrets anywhere in the kernels).

## 8. The golden-SQL corpus is the emission contract, not a load test

No performance/scale work, no connection-pool tuning, no migration versioning beyond idempotent CREATE IF NOT EXISTS (the three gateway tables are the only migrated tables).
