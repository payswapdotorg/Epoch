# @epoch/verification

Epoch Verification kernel — Work Order W006
(Verification/Evidence/Provenance). Layer: `kernel`.

The **verification chain** (architecture.md, binding):

```
Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval
```

No UI, no persistence, no workflow engine: the typed chain model, chain
validation, digest discipline, and reference chain-validation only.

## Core concepts

- **Verification and validation are DISTINCT stages** (architecture lock
  rule 7 corollary): verification asks *"was the work done to spec"*;
  validation asks *"is the spec right"*. Every Claim, Method, Run, and
  Result carries a `stage`, and the validator rejects confusion — a
  validation method cannot operationalize a verification claim, a
  verification run cannot execute a validation method, and a validation
  result cannot satisfy a verification claim (or vice versa).
- **Evidence is exact-revision addressable** (`@epoch/evidence`): runs
  declare `producedEvidence` digests, results cite `evidenceDigests`, and
  every cited digest must be the canonical SHA-256 of an evidence record
  in the chain — tampered or mismatched evidence no longer resolves and is
  rejected. A result may only consume evidence its own run produced.
- **Approval is a distinct authority act**: results never self-approve.
  An Approval references the result, the approver identity (+ PROV agent
  kind), the decision (`approved`/`rejected`), and the time; the approver
  must differ from the executor of the run behind the result.
- **Uncertainty travels with the chain**: Results carry the W002-aligned
  `Confidence` model (see `@epoch/evidence`).
- **Provenance is first-class**: `chainProvenance(chain)` deterministically
  maps a validated chain to a PROV-DM-adapted graph (`@epoch/provenance`):
  executors/approvers as agents, runs/approvals as activities (stage
  visible as `verification-run` / `validation-run`), requirements / claims
  / methods / results / content-addressed evidence as entities, and
  generation/usage/association/derivation statements tying the story
  together.

## Chain validation (`admitChain` / `validateChain`)

The reference validator walks the chain and rejects, with typed issue
codes and precise paths:

| Class | Codes |
| --- | --- |
| Orphan references | `unknown-requirement`, `unknown-claim`, `unknown-method`, `unknown-run` (orphan results), `unknown-result` (absent-result approvals) |
| Missing methods | `claim-without-method` (the chain cannot skip the Method stage) |
| Stage confusion | `stage-mismatch` (claim↔method, method↔run, claim↔result, run↔result) |
| Evidence discipline | `evidence-digest-mismatch` (tampered/mismatched/absent digests), `evidence-not-produced-by-run`, `evidence-run-mismatch`, `evidence-method-mismatch`, `evidence-subject-conflict` |
| Approval authority | `self-approval`, `duplicate-approval` |
| Provenance consistency | `actor-kind-conflict` (one actor, one PROV kind) |
| Temporal sanity | `run-time-order`, `result-before-run-end`, `approval-before-result` |
| Attached provenance | `provenance-invalid` (each graph validated via `@epoch/provenance`) |
| Structure | `schema`, `duplicate-id`, `version-mismatch` (distinct, at chain and record level) |

Partial-but-consistent chains are **valid** (no workflow engine): a run may
exist without a result; a result without an approval; an empty chain is
vacuously valid. Broken chains are not.

## Public API

| Export | Purpose |
| --- | --- |
| `admitChain(input)` | THE reference entry: total parse + semantic walk, typed issues |
| `parseVerificationChain(input)` | schema-level parse with distinct version reporting |
| `validateChain(chain)` | semantic validation of a typed chain |
| `chainProvenance(input)` | PROV graph construction from a validated chain |
| `computeChainDigest(chain)` | canonical SHA-256 content address of a chain |
| `VerificationChainSchema` / `RequirementSchema` / … | runtime zod validators (strict shapes) |
| `renderVerificationContractFiles()` | deterministic emission of `schemas/` |
| `VERIFICATION_STAGES` / `RESULT_OUTCOMES` / … | closed vocabularies |

## Contract surface

`VERIFICATION_CONTRACT_VERSION` 1.0.0. Serialized chains (and every nested
record) carry `schemaVersion: 1`; skew is reported as a distinct
`version-mismatch` issue, at chain level and per record. The published
JSON Schema projection lives in `schemas/` (byte-pinned by
`test/contract-drift.test.ts`; regenerate via `EPOCH_UPDATE_CONTRACTS=1
pnpm --filter @epoch/verification test contract-drift`). Compile-time
parity is pinned by `src/parity.ts`.

## Neutrality

Requirement/claim/method/run/actor identifiers are opaque strings owned by
their producing domains; approver/executor PROV kinds come from
`@epoch/provenance`. Pinned by `test/neutrality.test.ts`.

## Tests

- `chain.positive.test.ts` — full-chain round trip (verification AND
  validation stages), partial chains, quorum approvals, rejection
  decisions, content-addressed evidence lookup through the chain, chain
  digests, PROV construction incl. stage-visible activity kinds.
- `chain.negative.test.ts` — orphan references at every stage, claims
  without methods, all four stage-confusion cases, tampered-evidence
  digest mismatch, foreign-evidence results, miscredited run/method,
  revision-label conflicts, self-approval, duplicate approvals, temporal
  violations, duplicate ids, invalid attached provenance, schema
  violations, version skew (chain and record level).
- `contract-drift.test.ts` — committed artifacts byte-identical to
  emission.
- `neutrality.test.ts` — no provider vocabulary; opaque identifiers.

## Limitations (v1)

- Results must cite ≥1 evidence digest (ungrounded judgments are
  structurally rejected); confidence **aggregation** from evidence to
  result is not prescribed by the kernel (W005 evaluation territory).
- Approval authority checks are structural (self-approval, duplication,
  ordering); role/tenancy-based approver eligibility is W009/W022.
- `chainProvenance` namespaces graph node ids (`requirement:<id>`,
  `claim:<id>`, `run:<id>`, `result:<id>`, `evidence:<digest>`,
  actor ids verbatim) to guarantee intra-graph uniqueness; the mapping is
  deterministic but the namespaced ids are graph-local.
- No persistence, no eventing, no UI: durable chain stores and approval
  workflows are service-layer Work Orders (W022 action gateway/human
  approval).
