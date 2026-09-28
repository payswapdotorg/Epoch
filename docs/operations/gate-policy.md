# Gate policy (W033)

**A plan may not promote without the verification battery green.** The
gate is a typed, content-addressed POLICY record whose battery is an
ordered list of commands with expected exit codes — DATA, never code
paths:

```
DeployGatePolicy {
  gateId: 'gate:<slug>'          // the reference gate: gate:verification-battery
  description
  required: true                 // literal: gates are refusal points
  battery: [ { command, expectExitCode, timeoutMs } ]   // ordered, data
  provenance, digest
}
```

## The reference battery

The reference policy (`referenceVerificationGatePolicy`) pins the Epoch
verification battery VERBATIM — the same commands the reviewer runs:

1. `pnpm install` (exit 0)
2. `pnpm check` (exit 0)
3. `pnpm exec turbo run typecheck lint test build --concurrency=1 --force` (exit 0)

The battery is executed OUTSIDE the model (by operators/CI) and recorded
as typed fixture `GateReport`s — `{ gateId, command, exitCode,
completedAt, provenance }` — which the executor consumes as data. Nothing
in this tree executes a command.

## The refusal semantics

`evaluateGateReports(policy, reports)` is green iff EVERY battery command
has a report with its expected exit code AND no foreign reports exist:

| Condition | Typed refusal |
| --- | --- |
| A battery command has NO report | `gate-skip-rejected` |
| A report's exit code ≠ expected | `gate-failed-rejected` |
| A report for a command not in the battery | `unknown-gate` |
| A report from a different gate id | `unknown-gate` |
| Duplicate reports for one command | `duplicate-record` |

The executor runs this evaluation at ADMISSION — before any step of the
plan executes. A plan whose battery is not green never starts: there is
no "promote anyway" path, and no optional gates exist (`required` is the
literal `true`; sealing a `false` is a typed `validation` refusal).

## Plan ↔ gate binding

A plan is planned AGAINST one gate policy (the verify steps carry the
gate digest). The executor refuses a policy that does not match the
plan's gate (`plan-gate-skew`) — you cannot swap a weaker battery under a
sealed plan.

## Versioning + integrity

Policies are content-addressed; serialization round-trips with digest
verification (`serializeGatePolicy` / `deserializeGatePolicy`); a mutated
policy fails its digest (`digest-mismatch`).
