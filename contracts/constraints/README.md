# contracts/constraints — published constraint & policy contract surface

Work Order W004 ownership boundary (typed, versioned contracts). Consumers:
the Constraint Engine runtime integration, the Action Gateway (W022 action
gating), policy tooling, and any adopt/adapt layer that needs the ECL
contract without depending on the kernel packages.

## Layout

- `v1/index.ts` — the versioned TypeScript declaration surface: authored
  constraints, compiled constraints (deterministic evaluation contract),
  evaluation contexts/results, compiler outcomes, and the policy-side
  contracts (policy documents, applicability scope, precedence/composition,
  composite decisions, policy-set evaluation).
- `v1/schemas/*.json` — JSON Schema (draft 2020-12) renderings, generated
  from the kernel packages' zod schemas and kept in sync by tests:
  - `authored.json` — authored constraint AST
  - `compiled.json` — compiled constraint contract
  - `result.json` — evaluation result
  - `outcome.json` — evaluation outcome (result | typed rejection)
  - `context.json` — evaluation context envelope
  - `input-declaration.json` — input slot declaration
  - `policy.json` — policy document

## Guarantees & versioning

- The TypeScript declarations are hand-maintained and are asserted
  structurally identical to the implementation types (zod-inferred) by the
  `contract-sync` tests in `packages/constraint-language` and
  `packages/policy-contracts`. The JSON Schemas are asserted byte-identical
  to `z.toJSONSchema` output on every test run.
- `v1` is the frozen surface for ECL/policy language version `1.0.0`.
  Additive changes may land in place; breaking changes require a new `v2`
  directory and an Architecture Change Request (spec/architecture-lock.md).
- The zod runtime surface (and therefore these schemas) adds cross-field
  checks beyond what JSON Schema alone can express (for example literal
  type/value correlation and payload/input pairing rules); JSON Schema
  consumers get the structural contract, zod consumers get the full checks.

## Semantics summary

- Constraint classes (R3): `hard` (violation blocks), `soft` (violation
  penalizes), `resource` (budget overage blocks, usage/limit/remaining in
  details), `safety` (violation blocks with regulation references),
  `epistemic` (confidence threshold + required-evidence counts; shortfall
  blocks), `authority` (permission assertion; denial blocks with the exact
  missing permission list).
- Compiled evaluation is pure, total and side-effect-free over its declared
  input types; results are deterministic and carry FNV-1a digests over their
  canonical JSON form (digest excluded), as does the compiled artifact
  itself (tamper detection at evaluation time).
- Policy resolution is a deterministic fold over (tier, rank, id)-ordered
  applicable policies with additive/override composition; decision
  composition is deny-overrides with penalty sums and fail-closed treatment
  of rejections and unresolved constraint references.
