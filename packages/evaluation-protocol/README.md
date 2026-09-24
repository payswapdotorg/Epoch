# @epoch/evaluation-protocol

Epoch **Evaluation Protocol v1** — runtime implementation (kernel
layer, Work Order W005). Provider-neutral evaluator registration,
evaluation request/verdict messages with machine-referenceable
justifications, cross-document conformance checks, and a
reference-grade threshold evaluator.

Evaluation **judges**; simulation **predicts** (architecture lock rule
6). This package has no runtime dependency on
`@epoch/simulation-protocol`: subjects are referenced neutrally by
kind (`simulation-result` | `world-outcome`), opaque id, and the
SHA-256 digest of the subject document's canonical JSON. The
simulation package appears only as a devDependency of the end-to-end
composition test.

The published contract surface for this package lives IN-PACKAGE at
`contracts/` (TypeScript declarations, JSON Schema projection, manifest
with digests) because W005 owns no repository-root `contracts/*`
directory. `contracts/parity.ts` proves type identity at compile time.

## Layer and dependencies

- Epoch layer: `kernel` (declared in `package.json` under `epoch.layer`).
- Runtime dependencies: `zod` and `@epoch/agent-protocol` (kernel →
  kernel edge; canonical JSON serialization, SHA-256 digests, message
  admission pipeline, parameter specs, and cost/latency profiles are
  reused from the base protocol package).
- Dev-only: `@epoch/simulation-protocol` (kernel → kernel, test-only —
  end-to-end composition proof).
- No Node APIs in runtime code; `node:` imports appear only in tests.

## Public API overview

- `parseEvaluatorRegistration(input)` /
  `validateEvaluatorRegistration(input)` — admit an
  `evaluation.registration` message. An evaluator that cannot state its
  judgment basis and assumptions is not registrable.
- `parseEvaluationRequest(input)` / `validateEvaluationRequest(input)` —
  admit an `evaluation.request` binding the evaluator id to the exact
  registration digest and judging a subject by exact-revision
  reference.
- `parseEvaluationVerdict(input)` / `validateEvaluationVerdict(input)` —
  admit an `evaluation.verdict` (pass-fail or scored outcome union,
  request/evaluator bindings, subject echo, referenced justifications,
  determinism claim; NO wall-clock fields).
- Cross-document conformance: `checkEvaluationRequestConformance`,
  `checkVerdictConformance`, `evaluatorRegistrationDigest`,
  `evaluationRequestDigest`, `valueConformsToSpec` — typed violations
  for binding, criteria-contract, verdict-form, determinism, and
  justification-reference checks.
- Reference evaluator (REFERENCE-GRADE, NOT A JUDGE PRODUCT):
  `REFERENCE_EVALUATOR_REGISTRATION`, `runReferenceEvaluation(input,
  subjects)` — a deterministic threshold evaluator (unknown subjects are
  rejected with a typed `unknown-subject` failure).
- Contract emission: `renderEvaluationContractFiles()` — deterministic
  JSON Schema projection + manifest for the in-package `contracts/`
  surface (drift-tested byte-for-byte).

## Evidence chain

registration digest → evaluation request (binds registration digest;
references subject by digest) → request digest → verdict (binds request
digest + evaluator reference; echoes subject) → verdict digest. Every
admitted message is exact-revision addressable evidence.
