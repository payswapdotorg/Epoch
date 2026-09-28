# Isolation Profiles (W030)

The sandbox **admission model** of the Epoch security surface:
`@epoch/observability` (the kernel: the check + the policy records) +
`@epoch/security-runtime` (the host: the admission gate).

Binding pins: architecture lock rule 10 ("Public arbitrary code is
sandboxed."), rule 9 ("Extensions are capability-scoped."), and the
Extensions section ("Public extensions are sandboxed and
capability-scoped.").

## Policy is data

A `SealedSecurityPolicy` record binds one tenant's ISOLATION PROFILE:

| Field | Semantics |
|---|---|
| `maxTrustClass` | The highest W008 trust class (`t0`..`t4`) this tenant admits. A subject ABOVE it is the typed `trust-class-exceeds-ceiling` violation. |
| `allowedFlavors` | The admitted extension flavors (the W008 vocabulary: `declarative` / `ui` / `wasm` / `remote`). Others are `flavor-not-admitted`. |
| `allowedDataHandling` | The admitted data-handling classifications (`sandbox-only` / `tenant-scoped` / `external-transfer`). Others are `data-handling-not-admitted`. |
| `requireMarketplaceListing` | Admission requires a marketplace listing reference that resolves to a REGISTERED, REAL-verified W023 listing version (`unknown-listing` / `listing-required`). |
| `quarantineOnViolation` | An isolation violation automatically imposes quarantine (deny-by-default) on the subject. |

…plus the OBSERVABILITY THRESHOLDS (`degradedAtCriticalViolations`,
`criticalAtCriticalViolations`) that drive the health projection, and
the lifecycle status (`active` / `retired` — the ACTIVE policy of a
tenant is the latest activation; retirement never deletes history).

**Swapping a policy revision changes enforcement with zero code
change**: the host resolves the active policy at admission time, so
publishing a new revision (with a later `activatedAt`) re-targets
every subsequent admission.

## The admission order (deterministic, fail-closed)

`SecurityRuntime.admitExtension(subject, admittedAt)` proceeds in
this exact order:

1. **Kernel schema validation** — the subject must satisfy the W008
   mirrored shape (strict objects; vendor fields rejected).
2. **The W009 authorization gate** — the caller must be authorized for
   `security.admit-extension` on the extension resource.
3. **Deny-by-default quarantine** — a quarantined subject is the typed
   `quarantined-subject-rejected` (a denial observation is recorded).
4. **Active-policy lookup** — no ACTIVE policy → `unknown-policy`
   (never open admission).
5. **Listing provenance** — when the profile requires marketplace
   listings, the subject's `listingId` must resolve to a REGISTERED,
   verified W023 listing version (`unknown-listing`).
6. **The kernel isolation check** — the deterministic predicate over
   the mirrored W008 tables (see below).
7. **The REAL W008 ceiling differential** — for every grant, the host
   re-runs the REAL `@epoch/extension-runtime`
   `grantExceedsCeiling`; a mirror/authority disagreement is the
   fail-closed `isolation-authority-conflict` (drift never admits).
8. **Admission** — conforming: an `allowed` sandbox-admission
   observation + `security:observation-recorded` event. Violating:
   the typed `isolation-violation` rejection (carrying the violation
   list) + a `critical` sandbox-violation observation +
   `security:violation-detected` event + (per policy) auto-quarantine
   + `security:quarantine-imposed` event.

## The isolation check (the kernel predicate)

`checkIsolation(subject, profile)` lists violations in the FIXED order
(both inputs being equal, the verdict is byte-identical):

| Code | Trigger |
|---|---|
| `trust-class-exceeds-ceiling` | `trustClassRank(subject.trustClass) > trustClassRank(profile.maxTrustClass)` |
| `flavor-not-admitted` | the subject's flavor is outside the admitted set |
| `data-handling-not-admitted` | the subject's data handling is outside the admitted set |
| `host-function-not-legal` | a grant names a host function outside the W008 vocabulary |
| `resource-scope-not-legal` | a grant names a (resource, access) pair outside the W008 legal table |
| `grant-exceeds-trust-ceiling` | a grant exceeds the mirrored W008 trust-class ceiling table |
| `capability-binding-missing` | grants without capability bindings to ground them |
| `listing-required` | the profile requires a listing and the subject carries none |

The ceiling table, host-function vocabulary, legal resource scopes,
flavors, data handling and trust classes are **MIRRORED from W008**
(member-for-member, parity-pinned by compile-time
`src/kernel-parity.ts` and runtime `test/parity.test.ts` — including
verdict AGREEMENT with the REAL `grantExceedsCeiling` over every
(trust-class × host-function / resource-scope) combination).

## Quarantine semantics

- A quarantine FACT is append-only, sealed, content-addressed
  (`quarantine-imposed` / `quarantine-released`), always carrying a
  REQUIRED reason and the acting principal (security actions must be
  auditable).
- The derived state is a pure fold: the LAST fact by instant wins;
  impose breaks release ties (deny-by-default under ambiguity).
- Double imposition is `quarantine-conflict`; baseless release is
  `quarantine-release-rejected` (no silent no-ops).
- Any quarantined subject flips the tenant's health to `critical` and
  the host's liveness to `degraded`.
- RECOVERY is explicit: release (gated, reasoned) → the subject
  re-admits through the normal isolation gate. Health restores; the
  violation FACTS stay in the metrics (append-only history — the
  audit trail never forgets).

## Determinism

The check is pure: zero wall-clock, zero randomness, zero I/O. Every
instant is caller-supplied; the violation list order is fixed; the
sealing digests are canonical SHA-256 over canonical JSON.
