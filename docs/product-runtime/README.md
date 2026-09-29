# Epoch Product Runtime — W046 Documentation

The shared product runtime + Application Gateway delivered by Work Order W046 (ACR-005): the client-facing composition layer that all three product clients (web W047, desktop W048, mobile W049) build on.

## Contents

| Document | Content |
|---|---|
| [authority-map.md](./authority-map.md) | **The first-class authority map**: every gateway operation -> the existing Epoch kernel/service that owns its semantics. Enforced by a walk test. |
| [persistence-spi.md](./persistence-spi.md) | The provider-neutral persistence SPI, the in-memory + PostgreSQL implementations, the golden-SQL corpus, and the pg binding policy. |
| [error-model.md](./error-model.md) | The recoverable client error taxonomy and the client recovery-action mapping (offline queue vs. re-auth vs. hard failure). |
| [fixtures.md](./fixtures.md) | The deterministic construction/software fixture format and the J07/J08/J11 journey scenario scripts. |
| [limitations.md](./limitations.md) | **What is explicitly NOT delivered in W046.** |

## Runtime architecture

```
   Web (W047)      Desktop (W048)      Mobile (W049)
      |                 |                  |
      +------- shared client contracts ---+      @epoch/client-runtime
                (frozen operation
                 vocabulary + envelopes)
                         |
              Application Gateway                 services/application-gateway
   (session/tenant/W009 gates, idempotency,
    correlation, error mapping — decides NOTHING semantic)
                         |
     +-------------------+-------------------+
     |                   |                   |
@epoch/action-gateway  existing Epoch    @epoch/persistence
  (EXECUTION          kernels/services    + @epoch/object-storage
   AUTHORITY)         (semantic truth)     (durable records + bytes)
```

**The Application Gateway composes existing authorities; it is NOT a new semantic authority** (ACR-005). Every operation maps to an existing authority — see the [authority map](./authority-map.md). PostgreSQL is the durable authority for the gateway's own records (sessions, idempotency, correlation) when the persistence SPI is bound to the PostgreSQL adapter; object storage holds bytes/evidence/assets by digest; kernel semantic state remains in the W001-W045 reference stores (see [limitations](./limitations.md)).

## The call pipeline

Every `ApplicationGateway.call(request)` runs, in order:

1. **Envelope validation** — the frozen `@epoch/client-runtime` contract (operation vocabulary, session ref, correlation, tenant scope, idempotency key, payload).
2. **Session gate** — the `@epoch/authentication` seam (`session.issue` is the bootstrap exception). Expired/revoked/unknown sessions are the `auth-session-expired` error class.
3. **Tenant gate** — the request scope must equal the session scope (R12 tenant isolation).
4. **Idempotency rule** — every mutating operation carries a well-formed `idem:<slug>` key.
5. **The W009 authorization gate** — the REAL `@epoch/authorization` decision point (fail-closed) on every mutating operation. UI/native code never grants authorization.
6. **Dispatch** — mutating operations run inside the typed `IdempotentReplay` (durable records through the persistence SPI); reads delegate directly. Kernel errors ride verbatim as `authority-rejected`.
7. **Correlation ledger** — every call that reached an authority is traced (correlation id, operation, authority, outcome digest).
8. **Outcome envelope** — the recorded result, its content digest, the echoed correlation id and the replay marker.

## Owned surfaces (W046)

- `contracts/application-gateway/` — the emitted contract set (index.d.ts + manifest.json + schemas/ + parity.ts).
- `packages/client-runtime/` — the shared client contract spine (operations, envelopes, errors, correlation, idempotency, offline admission, projection cache, contract emission).
- `packages/authentication/` — the auth/session seam over the W009 kernels.
- `packages/persistence/` — the provider-neutral persistence SPI + the in-memory and PostgreSQL implementations + the golden-SQL corpus.
- `packages/object-storage/` — the digest-addressed byte/evidence store SPI.
- `services/application-gateway/` — the gateway facade, the authority map, the pg bindings, the fixture generators.
- `qa/fixtures/` + `spec/journeys/fixtures/` — the deterministic product fixtures.
