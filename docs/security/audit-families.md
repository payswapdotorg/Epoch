# Audit Families (W030)

The two **audit families** of the `@epoch/observability` kernel: pure,
deterministic verifiers over the observed record. They are the W030
answer to the Work Order's dispatch pin — "packages/tenancy/** (W009
tenant isolation), packages/access-projection/** (W041 authorization +
redaction invariants your audits verify)".

The enforcement host (`@epoch/security-runtime.runAuditPass`) runs
both families and records every finding as a `security-audit`
observation (outcome `violated`, severity `critical`), plus a
`security:audit-recorded` event on the tenant host stream.

## Family 1 — the tenant boundary (R12)

**Claim under audit**: the W009/W010 machinery denies cross-tenant
access BY CONSTRUCTION (R12: tenant isolation is a security
boundary). The audit re-examines the OBSERVED record for agreement.

**Input**: every admitted `tenant-boundary-check` observation. Each
carries BOTH tenants in its neutral detail:

```json
{
  "observationClass": "tenant-boundary-check",
  "outcome": "denied",
  "detail": { "subjectTenantId": "tenant:globex", "actorTenantId": "tenant:initech" }
}
```

**The rule (fail-closed)**:

| Record | Finding |
|---|---|
| subject tenant ≠ actor tenant AND outcome ≠ `denied` | `cross-tenant-breach` — the R12 invariant failed on the observed record |
| missing subject/actor tenant detail | `cross-tenant-breach` — the boundary claim is UNVERIFIABLE, which is non-compliant (fail-closed: unverifiable is not compliant) |
| subject tenant = actor tenant | compliant (no finding) |
| subject tenant ≠ actor tenant AND outcome = `denied` | compliant (the boundary held) |

Findings are listed in observation-id order (deterministic).

**Evidence**: `tests/security/test/scenario.positive.test.ts` (the
denied boundary observation audits CLEAN);
`services/security/test/flow.positive.test.ts` (an ALLOWED
cross-tenant record is flagged and flips the metrics);
`packages/observability/test/metrics-health-audit.test.ts` (every
row of the table above).

## Family 2 — the access projection (W041 invariants)

**Claim under audit**: authorized projections never mint identities,
never silently drop fields, and always ground on a sealed W009
decision + a policy revision (the W041 published invariants).

**Input**: `ProjectionSummary` records mirrored from the REAL
`SealedAuthorizedProjection` values (objectId, objectDigest,
releasedPaths, redactedPaths, decisionDigest, policyId), each audited
against its `CanonicalObjectRef` (the W036 record identity).

**The rules**:

| Code | Trigger |
|---|---|
| `projection-identity-fork` | the projection's object id or content digest disagrees with the canonical record — projections carry the SAME identity, never mint new ones |
| `projection-path-overlap` | a path is BOTH released AND redacted — every field is exactly one of the two |
| `projection-decision-missing` | a RELEASED projection references no authorization-decision digest — the two-stage evaluation requires the sealed W009 decision |
| `projection-policy-missing` | the projection references no policy revision — policy-as-data requires the linkage |

**Evidence**:
`tests/security/test/scenario.positive.test.ts` + `services/security/
test/parity.test.ts` — a REAL W041 `evaluateProjection` output (over a
REAL W036 program, a REAL sealed W009 decision, a REAL projection
policy) audits CLEAN: the invariants hold on real records. The same
suites flag a FORKED summary (`projection-identity-fork`).

## What the audits are NOT

- The audits are NOT re-implementation of authorization (W009 owns
  decisions), of projection evaluation (W041 owns projections), or of
  tenancy (W009 owns containment). They VERIFY the observed record
  against the invariants those authorities publish.
- The audits are NOT state mutation: findings are recorded as
  observations (facts); remediation is quarantine/release or upstream
  corrections — never an audit-side mutation.
- The audits are NOT clocked: `auditedAt` is caller-supplied; two
  audit passes over the same records produce byte-identical findings.
