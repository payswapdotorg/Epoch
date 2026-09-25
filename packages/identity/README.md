# @epoch/identity

Epoch Identity kernel (**Work Order W009**): typed, provider-neutral
principal modeling — opaque principal ids across the five principal
kinds, principal lifecycle governance, credential-assertion descriptors
over the factor-class taxonomy, and authentication-result records with
typed reasons.

## Scope (frozen architecture)

- **Provider-neutral by construction (lock rule 13)**: ZERO concrete
  identity providers, OAuth vendors, OIDC clients, or token issuers —
  those are future adapters behind the Capability/Adapter Fabric
  (W029+). The credential-method vocabulary names factor CLASSES
  (knowledge, possession, inherence, signature, attestation), never
  vendors. No `provider`/`issuer`/`endpoint`/`apiUrl`/`apiKey` fields
  exist anywhere in the contracts (strict objects reject them).
- **ZERO network, ZERO secrets storage**: this package models identity
  as typed data. A `CredentialAssertion` records THAT a principal
  asserted a credential of a class at a time — the credential material
  itself (secret, token, proof value) never enters kernel types.
  Verification is done by external providers behind adapters; this
  package records and validates the typed RESULTS.
- **Identity != tenancy != authorization != policy (lock rule 12)**:
  principals carry NO tenancy membership and NO permission semantics.
  Principal-to-tenant membership is host-wired knowledge supplied to
  `@epoch/authorization`'s decision point as caller-provided facts.
- **Principal kinds (R2)**: `human`, `agent`, `solver`, `robot`, plus
  `service` for Epoch's own gateways/runtimes.
- **Reference in-memory directory**: no persistence, no sessions, no
  token issuance, no clocks. Records are plain serialization-friendly
  JSON; iteration is always sorted; every entry point is total (typed
  errors, never thrown).

## Model

- `Principal` — `{ schemaVersion, principalId, kind, status,
  displayName, description? }`: the registered principal record.
- `CredentialAssertion` — `{ schemaVersion, assertionId, principalId,
  method, assertedAt }`: a provider-neutral assertion descriptor (no
  credential material).
- `AuthenticationResult` — `{ schemaVersion, resultId, assertionId,
  principalId, outcome: verified|failed, verifiedAt, reasons }`: the
  typed verification outcome; a `failed` outcome must carry at least one
  typed reason (refinement enforced by the runtime validator).
- `PrincipalDirectory` — `register` (admits `active`), `get`, `list`
  (sorted, filterable by kind/status), lifecycle transitions
  (`suspend`/`disable`/`activate`), and `verifyAuthentication`.
- Lifecycle: `active -> suspended -> active` (reversible bar),
  `active|suspended -> disabled`, `disabled -> active` (explicit
  re-activation). No self-transitions; illegal transitions are typed
  `lifecycle-conflict` errors.

## Security boundary (typed, tested)

A principal that is not `active` NEVER authenticates:
`verifyAuthentication` rejects suspended and disabled principals with a
typed `principal-inactive` error even when the authentication result is
`verified`. Failed outcomes surface as typed `authentication-failed`
errors carrying the record's typed reasons; unregistered principals
surface as `unknown-principal`.

## Integrity (tamper detection)

Credential assertions and authentication results are audit-grade
evidence, content-addressed by the SHA-256 of their canonical JSON
(`sealCredentialAssertion` / `sealAuthenticationResult`).
`parseSealedCredentialAssertion` / `parseSealedAuthenticationResult`
recompute the digest and reject mismatches with a typed
`digest-mismatch` error — a record whose claimed digest does not match
its content never resolves. Principals are registry state, not
evidence, and carry no digest by design.

## Error taxonomy

Typed, categorized, precise paths (values, never thrown): `validation`,
`unknown-principal`, `duplicate-principal`, `lifecycle-conflict`,
`authentication-failed`, `principal-inactive`, `digest-mismatch`.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` (W007) and
`@epoch/extension-sdk` (W008): version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/identity test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared MessageId/Timestamp validators) and
`zod` (frozen catalog). Dev/test only: the workspace toolchain and
`@epoch/action-protocol` — the W003 protocol's opaque
`PrincipalReference.id` field accepts every W009 `PrincipalId` (pinned
by `test/parity.test.ts`); no runtime coupling in either direction.
