# W052 — Public Web + Vercel Production Deployment

Status: BLOCKED (until W051 merges)
Wave: ACR-006 / concurrent wave 1 (web/product surface)
Depends On: W051
Worker Count: 1

## Objective
Deploy `apps/web` to a real public environment on Vercel, connected to the production Application Gateway binding (in-process, per the frozen W046/W051 seams), with production environment variables, a public URL, validated health/readiness behavior, validated auth/session behavior, validated production API routing, validated tenant boundaries, and real browser journeys executed against the deployed site.

The worker must not create a second backend and must not bypass the W046 Application Gateway (apps/web's `/api/gateway` route remains the ONLY client-facing mutation/read path).

## Owned write surfaces
- apps/web/* EXCEPT the W051-frozen files (read-only for W052): apps/web/src/server/production-*.ts, apps/web/app/api/healthz/*, apps/web/app/api/readyz/*, apps/web/.env.example, apps/web/vercel.json
- docs/journeys/production-web.md (the production web journey evidence)
- docs/deployment/vercel-setup.md (the reproducible Vercel setup runbook)

## Required
1. Deploy the production web application to Vercel from the repository main branch (or a deployment branch the TL authorizes), using the W051 deployment manifest; production deploys from `main` only.
2. Configure production environment variables through Vercel's secure environment mechanism (never in Git): EPOCH_DEPLOYMENT_PROFILE=production, EPOCH_DATABASE_URL (from W053's Neon provisioning or the TL's coordination), object-store + rate-limit + Apify variables as available.
3. Establish and record the public production URL (platform-assigned `*.vercel.app` is acceptable; no fabricated URLs — record only what actually resolves).
4. Validate public health/readiness: /api/healthz and /api/readyz return the expected typed payloads over HTTPS.
5. Validate production auth/session: sign-in through the product's identity boundary, session issue through the gateway, session persistence across deployment instances/restarts (durable persistence when bound).
6. Validate production API routing: gateway envelope operations over the public endpoint (typed errors for malformed/unknown operations; correlation IDs present).
7. Validate tenant boundaries over the public endpoint: cross-tenant session/operation attempts fail closed (negative test evidence).
8. Execute real browser journeys against the DEPLOYED site (not a local build): P01 onboarding, P02 sign-in/session, P03 tenant/project selection, P04 understand/reconstruct, P05 capability discovery, P06 decide/approve, P07 plan/acquire, P08 realize/observe/verify, P11 agent supervision, P12 recovery, P14 production persistence, P18 tenant isolation (P09/P10 web portions where the client permits). Record evidence per the journey contract (journey id, environment=production, URL, source commit, outcomes, screenshots/machine-readable traces, defects with severity, fix/rerun records).
9. Defect loop for everything found: observe → record → reproduce → regression test → fix → rerun (fixes in owned surfaces only; cross-surface defects are reported to the TL for W055).

## Acceptance
1. A real public URL serves the production application over HTTPS with the recorded source commit and Vercel deployment identifier; no dev server serves public traffic.
2. Health/readiness validated over the public URL.
3. Auth/session, API routing and tenant-boundary validation evidence recorded.
4. Production browser journeys pass with recorded evidence; P0/P1 defects resolved (or escalated to the TL with disposition); every P2 dispositioned.
5. All evidence records the exact public URL, source commit, deployment identifier and environment profile.
6. No changes to the W051-frozen files; no root manifest/lockfile changes; no new dependencies.
7. Standard battery green on the PR (governance/boundary/typecheck/lint/test/build + release-readiness).

## Honest-blocking rule
If Vercel credentials/the connected Vercel project are not yet available (operator input), the worker delivers everything up to the credential boundary: the verified setup runbook, the validated deployment manifest wiring, the production journey scripts/fixtures ready to execute against the deployed URL, and honest NOT-DEPLOYED status. No fabricated URLs, no "deployed" claims from local builds.
