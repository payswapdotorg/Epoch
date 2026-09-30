# epoch/application-gateway — Contract Surface (W046, ACR-005)

The frozen client-facing contract shared by the three product clients (web W047 / desktop W048 / mobile W049) and implemented by `services/application-gateway`.

## Files

| File | Content |
|---|---|
| `index.d.ts` | Self-contained TypeScript declarations of the complete surface (versions, the operation vocabulary, envelopes, error taxonomy, correlation, idempotency, offline admission, session references, projection cache). |
| `parity.ts` | Compile-time strict type-identity assertions vs `@epoch/client-runtime` (compiled by the runtime package's `tsconfig.contracts.json`; drift fails `pnpm typecheck`). |
| `manifest.json` | The declared data-type surface + per-schema SHA-256 digests (emitted by `renderApplicationGatewayContractFiles()`). |
| `schemas/*.json` | The JSON Schema projection (draft 2020-12) of every surface type. |

## The surface

- **Operations** — the 32-operation frozen vocabulary (`GatewayOperationName`): identity/session, tenant/workspace/project context, world reads, evidence, capability discovery, the action path (the Action Gateway is the execution authority), constraints, verification, solutions, program of work / BOQ, delivery, procurement, actualization/forecast, outcomes, authorized projections, supervision, alerts, marketplace, events (READ only), recovery.
- **Envelopes** — `GatewayRequestEnvelope` (operation + session ref + correlation + tenant scope + idempotency key + payload) and `GatewayOutcome` (result + digest + echoed correlation + replay marker).
- **Error taxonomy** — six classes (`transient`, `auth-session-expired`, `conflict`, `validation`, `authority-rejected`, `unrecoverable`) with typed discriminators and the client recovery-action mapping.
- **Correlation** — `RequestCorrelation` (correlation id, causation id, origin, issued-at).
- **Idempotency** — the typed `IdempotentReplay` (operation key, request fingerprint, recorded outcome; replays never double-apply).
- **Offline admission** — `QueuedIntent` (pending projections of user intent only; the five named negatives).
- **Sessions** — `ClientSession` / `SessionRef` (the client-facing session projection).
- **Projection cache** — `ProjectionCacheEntry` (read-only, digest-addressed).

## Verification

- `packages/client-runtime/test/contract-drift.test.ts` re-renders the emission and compares byte-for-byte (update mode: `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/client-runtime test contract-drift`).
- `packages/client-runtime/test/contract-drift.test.ts` also asserts the declared public surface == the manifest `dataTypes`.
- `parity.ts` asserts declaration/implementation type identity.
- JSON Schema fidelity is structural-only: zod refinements are enforced by the runtime validators in `@epoch/client-runtime`.
