# Provider-neutrality contract (W033)

## The contract

The Epoch deployment model is provider-NEUTRAL by construction
(architecture lock rule 13: "Provider-specific behavior is adapterized"):

1. **No provider vocabulary anywhere in the model.** Ids, names, paths,
   commands and free text of every record are scanned at every admission
   door against a closed blocklist of infrastructure-provider tokens
   (cloud vendors, orchestrators, container runtimes/registries,
   infrastructure tooling, provider address forms). Hits are the typed
   `provider-vocabulary-rejected` refusal. The blocklist lives in code —
   `deploy/src/neutrality.ts` (`PROVIDER_VOCABULARY_TOKENS`,
   `PROVIDER_VALUE_PREFIXES`) — versioned with this tree.
2. **Strict records.** Every schema is a strict object: unknown fields
   are rejected, so provider semantics cannot enter through any door
   even when spelled neutrally.
3. **Neutral vocabularies only.** Component kinds name REPOSITORY roles
   (`package`/`service`/`app`/`adapter`/`pack`); capacity is abstract
   replica units; health is `readiness`/`liveness`/`startup` declarations
   with millisecond budgets; revisions are content-derived (`rev:<hex>`)
   — never an image tag, build number or registry coordinate.
4. **The battery is commands-as-data.** Gate commands are opaque strings
   with expected exit codes; the model never executes them.

The token-boundary scan is precise: tokens match on camelCase,
kebab-case, snake-case and punctuation boundaries (and value-prefix forms
like provider address schemes), so ordinary engineering words never trip
it — `runbook-reaches-recovery`, `rollback-restores-prior-revision` and
`gate-skip-rejected` are all legal, while a vendor token hidden inside a
camelCase key (`awsRegion`) is caught. Every rejection names the exact
record path and token.

## Why nothing here calls a provider

This Work Order's deployment discipline is DETERMINISTIC, provider-neutral
and IN-REPO: the platform is a typed topology model with a
fixture-driven reference executor — proof-of-correctness artifacts, not
live deploys. There are:

- NO real cloud provider calls,
- NO real infrastructure provisioning,
- NO credentials (the evidence suite is a secret-free zone; the PR
  verifies the diff carries no secrets).

Determinism (zero wall-clock, zero randomness, zero network) is what
makes the proofs replayable: identical inputs produce identical plan
digests, receipts and recovery proofs — in every process, forever.

## How a real provider would be admitted

Any real provider is a FUTURE ADAPTER behind the topology model — the
W029 adapter pattern applied to deployment:

```
@epoch/deploy-model (this tree)          provider adapter (future WO)
  typed topology records          <----   translates provider resources
  typed plans + gates                     INTO neutral records, and
  reference executor                      neutral step outcomes INTO
  (proof-of-correctness)                  provider operations
```

An adapter would live in its own surface (e.g. `adapters/<provider>`),
declare its own provider-scoped vocabulary behind its boundary (exactly
as W029's `src/provider` directory quarantines the hosted-software
vocabulary), and NEVER leak that vocabulary into the neutral records —
the same neutrality tests would pin it. Until such an adapter exists and
passes its own gate review, the typed model + fixtures in this tree are
the deployment truth: every plan digest, receipt and recovery proof
verifies offline.
