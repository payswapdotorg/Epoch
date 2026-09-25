# @epoch/identity

Epoch Identity kernel (**Work Order W009**): provider-neutral principal
modeling — typed principals and principal ids, credential-assertion
descriptors, and authentication-result records with typed failure
reasons.

## Scope (frozen architecture)

- **Identity != tenancy != authorization != policy** (lock rule 12):
  identity owns PRINCIPALS and AUTHENTICATION RESULTS. A principal
  record carries no tenant and no membership — where a principal may act
  is `@epoch/authorization`'s decision point fed by tenancy facts;
  policy semantics are `@epoch/policy-contracts`'.
- **Provider neutrality** (lock rule 13): ZERO concrete
  IdPs/OAuth vendors/OIDC clients — those are future adapters behind the
  Capability Fabric. The credential vocabulary names neutral MECHANISM
  CLASSES (`shared-secret`, `asymmetric-key`, `signed-assertion`,
  `one-time-token`, `biometric`); the vendor never enters the contract.
- **ZERO network, ZERO secrets storage**: credential assertions are
  descriptors (mechanism class, moment, audit note) — never a secret,
  token value, or key; strict objects reject secret-shaped fields.
- **Authentication is a RESULT, not a session and not an authorization**:
  verified (no reason) or failed (exactly one typed reason:
  `invalid-credential`, `expired-credential`, `revoked-credential`,
  `malformed-assertion`, `challenge-mismatch`, `unknown-principal`,
  `inactive-principal`). It says nothing about WHERE a principal may act.
- **Reference in-memory registry**: no persistence, no event log, no
  UI, no clocks (timestamps are caller-supplied canonical UTC instants).
  Iteration is always sorted (no insertion-order leaks).

## Model

- `Principal` — the immutable, digested content: `schemaVersion`,
  `principalId` (opaque, `principal:<slug>` — never encodes a tenant or
  provider), `kind` (`human` | `agent` | `service`), `displayName`.
- `PrincipalRecord` — the published record: principal + lifecycle +
  `principalDigest` (SHA-256 of the content's canonical JSON —
  transitions never rewrite the digest).
- `CredentialAssertion` — a provider-neutral descriptor of what a
  presenter claimed to hold (`assertionId`, principal, mechanism class,
  `assertedAt`, audit note).
- `AuthenticationResult` — the typed outcome for one assertion:
  `resultId`, `assertionId`, principal, `outcome` (`verified` | `failed`),
  `reason` (iff failed), `decidedAt`, optional `evidenceDigest`.
- `AuthenticationResultRecord` — result + `resultDigest` (content
  address — authentication results are evidence, R5/R17).

## Principal lifecycle

`active -> suspended -> deactivated` (typed, forward-only;
`active -> deactivated` is legal for immediate yanks; no revival — a
deactivated principal that must return registers as a NEW principal id).
While `suspended`, authentication attempts fail with the typed
`inactive-principal` reason.

## Error taxonomy

Typed, categorized (values, never thrown): `validation` (malformed ids,
vendor/secret fields, reason/outcome mismatches), `unknown-principal`,
`duplicate-principal`, `lifecycle-conflict`, `digest-mismatch`.

## Integrity (tamper detection)

Registration is sealed: `{ principal, digest }` where `digest` is the
SHA-256 of the principal content's canonical JSON
(`computePrincipalDigest` / `sealPrincipal`); authentication results
seal the same way. `registerPrincipal`, `recordAuthentication`, and the
parse functions recompute the digest and reject mismatches with a typed
`digest-mismatch` error — a record whose digest does not match its
content never enters the registry.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` / `@epoch/verification` /
`@epoch/evidence`: version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/identity test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared patterns: `MessageId`, `Timestamp`) and
`zod` (frozen catalog). Dev/test only: the workspace toolchain.
`@epoch/authorization` pins compatibility with this package's principal
id pattern and lifecycle vocabulary via devDependencies + parity tests —
no runtime coupling in either direction.
