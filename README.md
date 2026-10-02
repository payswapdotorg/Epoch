# Epoch

Epoch is a provider-agnostic engineering operating system: a shared, task-sufficient computational world where humans, AI agents, simulations, external software, and extensions collaborate.

## Source of truth

The repository is authoritative; chat is not. Start with:
1. AGENTS.md
2. AI_CONTINUATION.md
3. docs/LLM-ARCHITECT-HANDOFF.md
4. spec/PROJECT-STATE.md
5. spec/architecture.md
6. spec/architecture-lock.md
7. spec/requirements.md
8. spec/work-items.md
9. spec/dependency-graph.md
10. spec/worker-runbook.md
11. spec/universal-solution-lifecycle.md
12. spec/domain-pack-contract.md
13. spec/solution-navigator-architecture.md
14. spec/capability-foundation-policy.md
15. spec/autonomous-role-capability-discovery.md
16. spec/capability-contribution-contract.md
17. spec/productization-architecture.md
18. spec/journey-validation.md
19. spec/architecture-change-requests/ACR-006-public-deployment.md
20. spec/deployment-architecture.md
21. spec/production-environment.md
22. spec/free-tier-infrastructure.md

## Deployment status (honest)

The public deployment program (ACR-006, W051-W055) is COMPLETE at the credential boundary: the production environment contract, the provider-neutral infrastructure adapters (Neon PostgreSQL via the pg seam, Cloudflare R2 via the S3-compatible adapter with AWS SigV4, Upstash Redis via REST, Apify via the discovery-adapter seam), the request-guard/rate-limit port, health/readiness endpoints, the deployment manifests and runbooks, the free-tier cost-control contract, and the P01-P18 production journey harness are all implemented, tested, and CI-gated. NO public URL exists yet: real deployment requires operator-owned provider credentials (Vercel/Neon/Cloudflare/Apify accounts) — see docs/deployment/README.md and docs/journeys/production.md (the post-credential procedure). Nothing is claimed deployed that is not verified live.

## Product architecture

World Model + Agent System + Role/Capability Discovery + Constraints + Actions + Simulation/Evaluation + Verification/Evidence + Solution Delivery + Outcome/Learning, wrapped by a shared Experience Runtime and Capability/Adapter Fabric.

Epoch is the semantic and lifecycle authority. Mature external engineering software and future models are integrated as replaceable capabilities through provider-neutral adapters, sandboxed extensions, or optional client surfaces. Epoch can derive task-specific roles and capability demands and search compatible agents/models rather than requiring hard-coded role/model pairings. The canonical rule is integrate first; contribute upstream where useful; fork last.

## Clients

Web is the canonical client. Desktop is the power client. Mobile is the field client. All clients share semantic contracts and Experience Protocol.

Current implementation status:
- Web: canonical Next.js/React product; W047 and browser journey validation are complete.
- Desktop: Tauri 2 Linux/Windows/macOS product is implemented and journey-validated; native binary packaging is recorded as config-delivered where host toolchains were unavailable.
- Mobile: Expo/React Native Android/iOS product is implemented and journey-validated; mobile release packaging is recorded as config-delivered where SDK/Xcode toolchains were unavailable.
- ACR-005 W046-W050 is complete (50/50); the roadmap is closed until a new ACR authorizes another program.

## Development

W001-W050 are complete (50/50). ACR-005 is complete.

Current frontier is authoritative in spec/development-state/program-state.json, frontier-state.json and dependency-state.json: EMPTY.

No Work Order is currently dispatchable. Any new implementation requires a new Architecture Change Request and Work Order program.

One Work Order = one branch = one PR. Workers never merge. Root manifests and lockfiles are Tech Lead serial work.
