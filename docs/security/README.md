# Security Documentation (W030)

Owned by Work Order **W030** (`packages/observability/*`,
`services/security/*`, `tests/security/*`, `docs/security/*`).

The Security/Isolation/Observability documentation set of the Epoch
program: how Epoch enforces sandbox isolation, verifies tenant
boundaries, audits access projections, and observes its execution
surfaces — deterministically, provider-neutrally, and fail-closed.

| Document | What it covers |
|---|---|
| [Isolation profiles](./isolation-profiles.md) | The sandbox admission model: policy-as-data, the W008 trust-class ceiling tables, the fail-closed admission order, quarantine semantics. |
| [Audit families](./audit-families.md) | The tenant-boundary (R12) audit and the W041 access-projection invariant verification; finding codes and their evidence. |
| [Observability guide](./observability-guide.md) | The observation model, the `security:*` event vocabulary, the metrics fold, the health projection, and how the surface integrates with the W033 ops kit. |

## Authority boundaries (one responsibility, one authority)

- **Sandbox host machinery** (admission, permission enforcement,
  invocation envelopes) — `@epoch/extension-runtime` (W008). W030
  MIRRORS its closed vocabularies and VERIFIES conformance; it never
  re-implements hosting.
- **Authorization decisions** — `@epoch/authorization` (W009). W030's
  host gates every operation through the REAL decision point; the
  kernel observes decisions by digest reference, never re-evaluates.
- **Tenancy/identity** — `@epoch/tenancy` / `@epoch/identity` (W009).
- **The change history** — `@epoch/event-log` (W010). `security:*`
  events ride the W010 shapes; digests are identical through the REAL
  `sealEvent`.
- **Access projections** — `@epoch/access-projection` (W041). W030's
  audit family VERIFIES their published invariants.
- **Marketplace listings/trust** — `@epoch/marketplace` (W023). W030
  verifies listing versions through the REAL verifier at admission.
- **Execution surfaces** — `services/agent-runtime` (W020),
  `packages/simulation-fabric` (W021), `services/action-gateway`
  (W022). W030 OBSERVES them; it never re-schedules, re-drives, or
  re-authorizes them.
- **Deployment/ops** — `deploy/` + `ops/` (W033). W030's health
  projection feeds the ops observability seam by DOCUMENTED mapping
  (see the observability guide); no ops files are modified.

## The three laws of the W030 surface

1. **Fail-closed everywhere**: no active policy → no admission;
   unknown principal → denied; not-applicable → rejected; authority
   drift (mirror vs. REAL W008 ceiling) → admission rejected;
   unverifiable → non-compliant.
2. **Facts, not mutations**: observations, quarantine facts, policies
   and events are append-only, sealed, content-addressed; corrections
   are new records; history never disappears (health may recover,
   metrics never forget).
3. **Zero wall-clock, zero randomness, zero vendor vocabulary**: every
   instant is caller-supplied; every read is sorted; SIEM/monitoring
   products are future adapters behind the capability fabric.

## How to run the evidence

```bash
# kernel + host
pnpm --filter @epoch/observability test
pnpm --filter @epoch/security-runtime test

# cross-surface evidence suite
pnpm --filter @epoch/security-runtime exec vitest run --root ../../tests/security
```
