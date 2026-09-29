# Capability Discovery — Security Boundary (W045)

This document describes the tenant, authorization, trust and sandbox
boundaries of the Role & Capability Discovery Plane, and how the five
named negative guarantees are enforced and tested.

## Governing rules

- Architecture lock, autonomous-discovery invariants:
  - external discovery "may enrich candidate capability knowledge but may
    not alter authoritative state merely from external claims";
  - "untrusted model/code artifacts remain outside the Epoch trust domain
    until applicable sandbox/security gates pass";
  - "discovery does not grant execution authority".
- Lock rule 12: identity, tenancy, authorization and policy are DISTINCT
  authorities — this plane owns none of them.
- CC1.0 security: external code and model artifacts are untrusted until
  sandboxing and policy checks pass; discovery may inspect metadata
  without executing untrusted artifacts; no discovery mechanism may grant
  itself access to customer secrets, credentials or authoritative state.
- Acceptance 9: security and authorization remain outside model prompts.

## Boundary 1 — Execution authority (negative a)

Discovery can never grant execution authority:

- **Structurally**: `DemandAuthorityConstraints.executionAuthority` and
  `RoleAuthorityBoundary.executionAuthority` admit exactly `'none'`
  (literal); `CandidateProfile` has NO authority field at all. Strict
  zod objects reject any smuggled authority field at every boundary
  (`test/security.test.ts`: "the CandidateProfile type has structurally
  NO authority field").
- **Behaviorally**: external artifacts whose self-descriptions claim
  execution powers are ingested as inert `declared` claims with
  `sandboxRequired: true` + `trustDomain: 'external'`; the claim text is
  never parsed as authority ("external artifact authority CLAIMS are
  inert metadata").
- Every discovery output (roles, demands) carries
  `executionAuthority: 'none'` ("every discovery output carries
  executionAuthority: 'none'").

## Boundary 2 — Canonical state (negative b)

The plane owns ONLY discovery records. World/solution/delivery state is
referenced OPAQUELY (`WorldRef`: id + content digest, never embedded
copies). The kernel has no import of any canonical-state package (pinned
by the import scan in `test/neutrality.test.ts`), and the service API
has no canonical-state write path (structural test). The behavioral
proof (`services/capability-discovery/test/canonical-state.test.ts`)
holds a REAL W002 `WorldModel` and a REAL W036 sealed solution version,
runs the full workflow (problem run + ecosystem scan with
authority-claiming artifacts + promotion), and asserts their serialized
state is byte-identical afterward.

## Boundary 3 — The promotion gate (negative c, acceptance 6)

External candidates enter at `discovered` and remain NON-CONSEQUENTIAL
until the CC1.0 chain is walked with mandatory evidence:

| Transition | Mandatory evidence |
|---|---|
| `discovered -> ingested` | evidence digest |
| `ingested -> sandboxed` | a PASSED sandbox report with a real isolation level |
| `sandboxed -> profiled` | evidence digest |
| `profiled -> evaluated` | measured evaluation evidence, every entry passed |
| `evaluated -> verified` | a HUMAN policy approval (`PolicyApproval`: principal + policy ref) |

`promoteCandidate` admits only successor transitions; skipping a step,
promoting an unverified candidate, or omitting the evidence is the typed
`promotion-gate-rejected` failure. Promotion records are hash-chained
(`previousPromotionDigest`) and content-addressed; `verifyPromotionChain`
detects tampering. In organization composition, primaries must be
consequential-eligible (`verified` + `epoch-verified` trust domain);
verified-external trust is reachable ONLY through the gate. Candidates
below `evaluated` cannot enter an organization at all; `evaluated`
primaries produce STAGED organizations that can be evaluated but never
selected.

## Boundary 4 — Template authority (negative d)

Domain packs contribute reusable priors; the universal compiler owns the
decision. Attempted relaxations (lower quality targets, removing human
cosign) and grouping conflicts are recorded as
`template-override-rejected` / overridden-template entries and ignored.
The universal derivation always stands
(`test/compile.test.ts`, `test/roles.test.ts`).

## Boundary 5 — Tenancy (negative e, R12)

Every record and operation is tenant-scoped:

- the kernel store denies cross-tenant reads/writes with the typed
  `cross-tenant-denied`;
- the service validates every tenant scope against a REAL
  `@epoch/tenancy` snapshot (unknown tenants are `unknown-tenant`) and
  rejects inputs scoped to a different tenant;
- run identities include the tenant scope (identical task content in two
  tenants yields different content-addressed run ids);
- scheduler schedules are tenant-scoped.

## Authorization (acceptance 9)

The kernel has no prompts and no inference machinery of any kind; it is
pure deterministic computation. The SERVICE gates every operation behind
a caller-supplied `AuthorizationDecision` (fail-closed: anything but an
explicit allow is `authorization-rejected`), evaluated BEFORE any kernel
admission — the W022/W030 gate pattern. The service never owns
authorization: the deployment's authorization authority (W009/W041
surfaces) supplies the decision. Policy approval for candidate
verification is a typed record naming a human principal and a policy
reference — never a model prompt.

## Trust domains

| Surface | Trust posture |
|---|---|
| Agent-protocol registrations (W003) | `epoch-verified` (protocol admission), `declared` claim basis |
| First-party capability-registry records (W007) | `epoch-verified` |
| Community/external-software/provisional registry records | `evaluated`, sandbox-required where external |
| Human declarations | `epoch-verified` (authorized declaration) |
| External source artifacts | `external`, sandbox-required, `declared` claims — until the promotion gate |

## Scheduling + sources

The scheduler is a pure CONTRACT plus an in-memory reference driver;
per-schedule authorization in `tickScheduler` is fail-closed (a denial is
recorded and the schedule advances without a scan). Source adapters are
the only seam through which external catalogs enter, as provider-neutral
`SourceArtifact` records — the reference adapter is a static fixture; no
real external registry is integrated, and adapters are never kernel
dependencies.
