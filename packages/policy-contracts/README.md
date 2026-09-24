# @epoch/policy-contracts

Epoch policy-side typed contracts — Work Order W004 (Constraint & Policy
Language). Layer: `kernel`.

Policy is **distinct from constraint semantics** (architecture lock rule 12):
a policy document decides *which* constraints apply *where*, with *what*
precedence, and *how* their evaluation results compose. It never redefines
what a constraint means.

## Core concepts

- **PolicyDocument** — `languageVersion`, `id`, `version`, `name`, `enabled`,
  `applicability` (scope), `bindings` (constraint references),
  `precedence` (`tier`: platform > tenant > workspace > project, plus a
  numeric `rank`), `composition` (`additive` | `override`).
- **PolicyScope / PolicyTarget** — applicability matching. Every present
  matcher must match (AND); an empty scope applies universally; a matcher for
  a field the target does not carry is a non-match (fail-closed).
- **Precedence & composition** (`resolveApplicablePolicies`) — deterministic
  resolution:
  1. validate all documents (typed issues for malformed documents, duplicate
     policy ids, or duplicate bindings within a policy);
  2. keep enabled, scope-matching policies;
  3. order by (tier, rank, id) — a deterministic total order;
  4. fold ascending: `additive` unions bindings, `override` **replaces** all
     lower-precedence accumulated bindings;
  5. a constraintId re-bound by a higher-precedence policy replaces the
     earlier binding;
  6. emit effective bindings (highest contributing precedence first) plus an
     audit trace.
- **Composition of evaluation results** (`composeConstraintEvaluations`) —
  deny-overrides decision: any rejection (ok:false) or `block` effect blocks;
  soft violations sum penalties (`allow-with-penalties`); `not-applicable`
  contributes nothing; an empty composition is `not-applicable`.
- **Policy-set evaluation** (`evaluatePolicySet`) — resolves, evaluates each
  effective binding via the caller-supplied constraint resolver, and composes.
  Fail-closed: unresolved bindings and rejected evaluations block; an
  unresolvable policy never silently allows. This is the integration point
  the Constraint Engine / Action Gateway (W022) wires up.

`PolicyTarget` is a minimal additive reference type; field alignment with the
W003 action protocol and W002 world model contract surfaces happens when
those Work Orders merge (recorded as an architecture question in the W004 PR).

## Public API

This package re-exports the full `@epoch/constraint-language` surface, plus:

| Export | Purpose |
| --- | --- |
| `matchesScope(scope, target)` | total applicability match (fail-closed) |
| `resolveApplicablePolicies(policies, target)` | precedence/composition resolution with audit trace |
| `composeConstraintEvaluations(evaluations)` | deny-overrides + penalty composition |
| `evaluatePolicySet(policies, target, context, resolver)` | end-to-end policy evaluation |
| `policyDocumentSchema` / `policyScopeSchema` / … | runtime zod validation surface |

All entry points are total: never throw, typed issues on invalid input.

## Tests

`pnpm --filter @epoch/policy-contracts test` — scope matching (per dimension,
fail-closed), precedence ordering/tie-breaks, additive/override folds,
binding dedupe, determinism under shuffled input, composition semantics
(deny-overrides, penalty sums, fail-closed rejections), end-to-end policy-set
evaluation, and contract-sync against `contracts/constraints/v1`.

Regenerate `contracts/constraints/v1/schemas/policy.json` after a deliberate
schema change:

```
ECL_UPDATE_SCHEMAS=1 pnpm --filter @epoch/policy-contracts test
```
