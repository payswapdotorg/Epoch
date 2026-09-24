# @epoch/constraint-language

Epoch Constraint Language (ECL) kernel — Work Order W004 (Constraint & Policy
Language). Layer: `kernel` (see the W001 boundary model).

The ECL is the frozen-E1.0 architecture's constraint language (requirement R3).
It supports the six constraint classes — **hard**, **soft**, **resource**,
**safety/regulatory**, **epistemic/evidence** and **authority/governance** —
through a deterministic authoring → compilation → evaluation pipeline:

```
authored constraint (structured, human-editable, serializable AST)
   │  compileConstraint()          zod validation + semantic validation +
   │                               static type checking + constant folding +
   │                               annotation + digest
   ▼
compiled constraint (deterministic evaluation contract; pure, total,
   │                               side-effect-free over declared inputs)
   │  evaluateConstraint()         reference evaluator (pure function over a
   │                               typed evaluation context)
   ▼
evaluation result (deterministic, serializable, digest-addressable;
                                  violation semantics per class)
```

## Design contract

- **Authoring vs enforcement**: natural-language tools may AUTHOR constraints
  into the structured AST (NL parsing itself is out of scope — an adapter
  concern); deterministic COMPILED enforcement is the preferred path
  (architecture.md / Constraints).
- **Determinism**: the compiled form and the evaluator are pure, total and
  side-effect-free. The operator set is closed and contains no clocks,
  randomness, calls or effects — environment facts must arrive as declared
  context inputs. Results are JSON-serializable and carry an FNV-1a digest
  over their canonical form (key-sorted, whitespace-free), so identical
  constraint+context pairs always produce identical evidence. Digests are
  non-cryptographic change detectors; proof-grade hashing belongs to the
  Verification/Evidence domain (W006).
- **Totality**: `compileConstraint` and `evaluateConstraint` never throw. All
  inputs are treated as untrusted: a structural guard bounds depth/size
  before any recursive validation, and every failure is a typed rejection
  (`ok: false` with `ValidationIssue[]`).
- **Integrity**: the evaluator recomputes the compiled digest and rejects
  tampered artifacts (`digest-mismatch`) — enforcement artifacts are
  exact-revision addressable.
- **Violation semantics** (carried in the result types):
  hard/safety/resource/epistemic/authority violations → `block`;
  soft violations → `penalize` with the authored weight;
  `not-applicable` (appliesWhen false) → `none`.
- **Numbers** are IEEE-754 doubles. Inputs must be finite; runtime division
  follows IEEE semantics (÷0 → ±Infinity, 0/0 → NaN; comparisons with NaN are
  false), and non-finite computed values in result details are normalized to
  `null` so results stay JSON-serializable. Division by a *constant* zero is
  rejected at compile time.
- **Provider neutrality**: no provider types, no I/O, no persistence, no
  OPA/OpenFGA — those are adopt/adapt layers behind adapters (lock rule 13).

## Public API

| Export | Purpose |
| --- | --- |
| `compileConstraint(authored)` | total compile: authored AST → compiled contract |
| `evaluateConstraint(compiled, context)` | total pure evaluation → result or typed rejection |
| `buildContextSchema(compiled)` | strict per-constraint context schema from declared inputs |
| `authoredConstraintSchema` / `compiledConstraintSchema` / `evaluationResultSchema` / … | runtime zod validation surface |
| `canonicalJson` / `fnv1a32` / `digestOf` | deterministic canonical serialization + digests |
| `ECL_LANGUAGE_VERSION` / `ECL_COMPILER` / `ECL_LIMITS` | version and limit constants |

Published types and JSON Schemas live at `contracts/constraints/v1`
(ownership boundary). This package's zod-inferred types are asserted
structurally identical to that surface by `test/contracts-sync.test.ts`.

## Expression operators

`lit`, `input`, `lt`, `le`, `gt`, `ge`, `eq`, `ne`, `and`, `or`, `not`,
`implies`, `add`, `mul`, `sub`, `div`, `has` (record key), `get` (total
record lookup with fallback), `count` (list length), `contains` (list
membership). Ordered comparisons are number-only; equality is primitive-only
(no deep equality in v1).

## Tests

`pnpm --filter @epoch/constraint-language test` — positive and negative
coverage for every class, the compiler's semantic rejections (undeclared
inputs, type errors, impure constructs, structural abuse), evaluator
rejections (tampered digests, context violations), purity/determinism, and
golden digests pinned to this revision.

Regenerate the committed JSON Schemas after a deliberate schema change:

```
ECL_UPDATE_SCHEMAS=1 pnpm --filter @epoch/constraint-language test
```
