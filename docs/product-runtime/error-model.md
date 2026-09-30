# The Recoverable Client Error Model (W046)

Six typed error classes with typed discriminators so all three product clients (web/desktop/mobile) map any gateway failure to a UI state: **offline re-queue vs. re-authenticate vs. conflict surface vs. input correction vs. authority feedback vs. hard failure**. No client-local semantic errors: every semantic rejection arrives as `authority-rejected` carrying the authority's own typed error verbatim.

`@epoch/client-runtime/src/errors.ts` is the source; every class round-trips losslessly through the serialization boundary (`serializeGatewayError` / `parseGatewayError` — a malformed payload becomes a typed `response-malformed` error, never a throw).

## The taxonomy

| Class | Codes | Retryable | Client recovery action |
|---|---|---|---|
| `transient` | `network-unavailable`, `connector-unavailable`, `gateway-overloaded`, `deadline-exceeded` | yes | `retry-with-backoff` (or offline re-queue) |
| `auth-session-expired` | `session-expired`, `session-revoked`, `session-unknown`, `principal-authentication-required` | no | `re-authenticate` |
| `conflict` | `idempotency-fingerprint-mismatch`, `idempotency-key-reuse`, `version-conflict`, `duplicate-submission` | no | `surface-conflict` |
| `validation` | `request-validation`, `request-envelope-malformed`, `operation-unknown`, `idempotency-key-required`, `tenant-scope-mismatch` | no | `surface-input` |
| `authority-rejected` | `authority-denied`, `authority-rejected-input` | no | `surface-authority-rejection` |
| `unrecoverable` | `contract-version-unsupported`, `internal-invariant-violated`, `response-malformed` | no | `surface-failure` |

## The typed discriminators

Every `GatewayError` carries: `class`, `code`, `message`, `operation`, `correlationId`, `retryable`, and a class-specific typed `details` payload:

- `transient` → `{ retryAfterMs?: number }`
- `auth-session-expired` → `{ sessionId, reauthRequired: true }`
- `conflict` → `{ idempotencyKey?, requestFingerprint?, recordedFingerprint? }`
- `validation` → `{ issues: { path, code?, message }[] }`
- `authority-rejected` → `{ authority, authorityCode, authorityError }` — the authority's own typed error rides VERBATIM (e.g. `@epoch/solution-delivery`'s `baseline-mutation-rejected`, `@epoch/action-gateway`'s validation issues, the W009 denial outcome)
- `unrecoverable` → `{ hint? }`

`clientRecoveryAction(error)` is the canonical class → action mapping (pinned by tests); clients switch on it for UI states.

## How the gateway produces errors

The call pipeline (`services/application-gateway/src/gateway.ts`) maps every failure into the taxonomy:

- envelope failures → `validation/request-envelope-malformed`;
- session failures (the `@epoch/authentication` seam) → `auth-session-expired` with the typed session code;
- tenant-scope mismatch → `validation/tenant-scope-mismatch` (R12);
- a missing/malformed idempotency key on a mutating operation → `validation/idempotency-key-required`;
- the W009 authorization gate denial → `authority-rejected` (authority `@epoch/authorization`, fail-closed);
- kernel/authority typed failures AND kernel throws → `authority-rejected` with the authority error verbatim (the gateway never invents semantic errors and never masks the source);
- idempotency fingerprint mismatches → `conflict/idempotency-fingerprint-mismatch`.

## Offline admission (the five named negatives)

A local queue may hold **PENDING PROJECTIONS of user intent, never semantic state**. `@epoch/client-runtime/src/offline.ts` enforces the five named negatives with dedicated rejection codes (each pinned by a named test that fails if the prohibition is violated):

| Negative | Code | Enforcement |
|---|---|---|
| (a) no local approval ever counts as authority | `local-approval-not-authority` | Intent payloads carrying outcome/approval/decision claims are rejected; outcomes are produced ONLY by the replay port (the Action Gateway path). |
| (b) no local mutation of World/Solution/Delivery/ProgramOfWork truth | `local-semantic-mutation-rejected` | Only queueable operations (routed through the Action Gateway path) may be queued; semantic-truth mutations are rejected. |
| (c) no local tenant/identity minting | `local-identity-minting-rejected` | Identity/tenant assertions must match the session scope exactly; minting fields are rejected. |
| (d) no local digest/verification forgery | `local-digest-forgery-rejected` | Verification/proof/attestation claims in intent payloads are rejected; digests are recomputed server-side. |
| (e) queue replay must go through the Action Gateway with idempotency keys or be rejected | `idempotency-key-required` | Intents without well-formed keys are rejected; `drain` forwards every intent to the replay port WITH its key. |
