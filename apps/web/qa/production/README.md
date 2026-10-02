# Epoch Production Journey Harness (W052, ACR-006)

The P01-P18 production journeys (`spec/journey-validation.md`) executed
against a **real deployed Epoch web application** through its public surface
only — the gateway envelope API (`POST /api/gateway`), the identity boundary
(`POST /api/product/authenticate`), the session-gated bootstrap
(`POST /api/product/bootstrap`) and the health/readiness probes. The harness
sends exactly what the visible client sends: the envelope builder is the
client's own (`src/client/envelopes.ts`) and the payload derivations are the
client's own (`src/product/derivation.ts`).

## Running

From `apps/web/`:

```bash
# against any deployment (Vercel production URL, preview URL, or a local
# production build):
EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app \
EPOCH_HARNESS_TRACE=/tmp/production-journeys.trace.json \
npx vitest run qa/production

# P17 (rate-limit behavior) additionally requires the deliberate tiny-budget
# deployment documented in docs/deployment/vercel-setup.md §P17:
EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW=3   # on the TARGET
EPOCH_HARNESS_IP_BUDGET=3                   # on the harness
```

Without `EPOCH_PRODUCTION_BASE_URL` (or `BASE_URL`) the suite skips itself —
the standard hermetic battery never depends on a deployment.

## Environment variables

| Variable | Meaning |
|---|---|
| `EPOCH_PRODUCTION_BASE_URL` / `BASE_URL` | the deployment origin under test |
| `EPOCH_HARNESS_IP_BUDGET` | enables P17 and states the target's configured IP budget (`EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW` on the target) |
| `EPOCH_HARNESS_TRACE` | writes the machine-readable request journal (per-call journey/surface/status/correlation/replay evidence) to this path |

## Local production build (the honest local approximation)

The production profile without provider credentials fails closed BY DESIGN
(`spec/production-environment.md`), so the local run uses
`EPOCH_DEPLOYMENT_PROFILE=preview` (in-memory bindings, degradation
surfaced in `/api/readyz`). One script does the whole lifecycle (the
sandbox reaps background processes between commands, so build → start →
wait → run → kill must be one invocation):

```bash
cd apps/web
npx next build
EPOCH_DEPLOYMENT_PROFILE=preview npx next start -p 3100 &   # wait for /api/healthz
EPOCH_PRODUCTION_BASE_URL=http://127.0.0.1:3100 npx vitest run qa/production
kill %1
```

For P17, restart the server with the tiny budget
(`EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW=3`) and run only the P17 suite
with `EPOCH_HARNESS_IP_BUDGET=3`.

## Coverage + honest boundary

| Journey | Status |
|---|---|
| healthz/readyz, P01, P02, P03, P04, P05, P06, P07, P08, P11, P12, P14, P15, P17, P18 | executed by this suite |
| P09/P10 (offline queue / cross-device) | browser-client behaviors — covered by the W047 browser suite (`apps/web/e2e/`); the idempotent replay primitive they rely on is asserted here (P12/P14) |
| P13 (release/update) | requires a real deployment update (W055) |
| P16 (provider degradation) | requires the real providers (W053) |

Evidence record: `docs/journeys/production-web.md`. Journey records are
evidence, never semantic state.
