# The SDK Version Matrix (W035)

The published contract surfaces this release documents, pinned to the
EXACT versions the packages export. This matrix is MACHINE-CHECKED by
`release/test/contract-sync.test.ts`: every version below is compared
against the real exported constant, so a drifted pin fails the release
readiness gate (`sdk-contract-synced` checklist items) by construction.

| Surface | Contract version |
| --- | --- |
| `@epoch/adapter-sdk` | `1.0.0` |
| `@epoch/capability-registry` | `1.0.0` |
| `@epoch/extension-sdk` | `1.0.0` |
| `@epoch/marketplace` | `1.0.0` |

## The schema-surface sizes

Each SDK package ships a committed JSON Schema projection (draft
2020-12) under `schemas/`, byte-pinned by its `contract-drift.test.ts`
(regenerate with `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter <pkg> test
contract-drift`):

| Surface | Committed schema files |
| --- | --- |
| `@epoch/adapter-sdk` | 23 committed JSON Schema files |
| `@epoch/capability-registry` | 12 committed JSON Schema files |
| `@epoch/extension-sdk` | 52 committed JSON Schema files |
| `@epoch/marketplace` | 54 committed JSON Schema files |

## The shared grammars underneath

| Grammar | Package | Version |
| --- | --- | --- |
| Canonical JSON + SHA-256 digests + timestamps | `@epoch/agent-protocol` | `1.0.0` |
| Tenant ids | `@epoch/tenancy` | `1.0.0` (record version 1) |
| Event shapes (the W010 mirrors) | `@epoch/event-log` | `1.0.0` (record version 1) |

## The sync discipline

1. **A contract version bump is a review gate.** Every bump breaks the
   compile-time parity pins and the contract-sync suite intentionally;
   the break surfaces in THIS tree as a failed release-readiness item,
   not as silent drift.
2. **Docs cite exact versions.** Guides link here; this matrix is the
   single pinning point (checked by
   `release/test/contract-sync.test.ts`).
3. **The release scope's SDK pins cite the same versions.** The
   reference scope's `sdk-contract-synced` evidence carries
   `documentedVersion === actualVersion`, with `actualVersion` read
   from the REAL packages at test time
   (`release/test/examples.test.ts` — the release readiness example).

## Related pins

- The release model's own contract: `@epoch/release-kit`
  `RELEASE_KIT_CONTRACT_VERSION` = `1.0.0` (record version 1) —
  `release/src/version.ts`.
- The upstream mirrored grammars (W033 battery/components/provenance,
  W034 budget vocabulary, W010 event shapes, W023 id grammars) are
  parity-pinned by `release/test/parity.test.ts`.
