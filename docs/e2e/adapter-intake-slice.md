# adapter-intake-slice

The external-adapter path: a provider payload becomes an Epoch
observation through the full seam chain, with tenancy + authorization
gates at every boundary crossing. Scenario definition:
`examples/e2e/scenarios/adapter-intake.ts` — test:
`tests/e2e/test/adapter-intake-slice.test.ts` (11 tests).

## The path

```
W029 GithubAdapterHost.ingestSnapshot (the reference fixtures; the host
     is pinned to the home tenant — the R12 gate)
   ──▶ parseProviderSnapshot (the provider seam's own shape)
   ──▶ projectSnapshot (the NEUTRAL W002-convention projection)

W028 admitDocumentContent + deriveDocumentDescriptor (a REAL
     mapping-table document over the adapter's OWN neutral entity
     vocabulary: software:workspace / software:revision /
     software:work-item)
   ──▶ parseDocument ──▶ extractCandidates (sorted, content-addressed)
   ──▶ emitStageEvidence ×3 (uploaded → parsed → candidates-extracted)
        into a REAL W006 EvidenceStore ──▶ verifyEvidenceChain

W036 admitExternalRequest (status-check) ──▶ admitExternalEvent
     (observation-report, carrying the projection digest) ──▶
     correlateExternalEvent (tenant + correlation + system-ref gates)
   ──▶ externalEventToObservation (the reference adapter step: the
        event's content digest becomes the observation's evidence)
   ──▶ recordObservation (the delivery authority path)

W009 evaluate (allow, home tenant) + evaluate (deny
     'cross-tenant-denied', a KNOWN foreign tenant the principal holds
     no membership in) ──▶ sealAuthorizationDecision ×2 (the auditable
     gate pair) ──▶ verifyAuthorizationDecisionDigest ×2
```

## Invariants (assertion → named test)

| Invariant | Test |
| --- | --- |
| ONE content, ONE address: the snapshot digest is identical at W029 ingestion and in the projection's source reference | `ONE content, ONE address…` |
| The W028 document leg: the descriptor digest is COMPUTED from the content (recomputation agrees; the artifact id is the digest), the candidates target the adapter's OWN neutral vocabulary, and the evidence chain anchors the same document digest | `the W028 document leg…` |
| Provider vocabulary NEVER leaks past the adapter seam (the blocklist scan over the neutral projection, the W036 observation and the external event payload) | `provider vocabulary NEVER leaks…` |
| The observation flows through the W036 intake with the external event digest as evidence; the projection verifies end-to-end (every digest recomputed) | `the observation flows through the W036 intake…` |
| The W028 evidence chain verifies against the REAL W006 store (three stages, every stage digest resolves) | `the W028 evidence chain verifies…` |
| Cross-tenant external event DENIED at correlation (typed, both tenants named) | `a cross-tenant external event is DENIED…` |
| Cross-tenant observation DENIED at the W036 intake | `a cross-tenant observation is DENIED…` |
| Cross-tenant document descriptor DENIED at W028 admission | `a cross-tenant document descriptor is DENIED…` |
| Cross-tenant ingestion DENIED at the W029 host (`tenant-isolation-rejected`) | `a cross-tenant ingestion is DENIED…` |
| The denial is AUDITABLE: the sealed W009 decision verifies (digest-addressed, tamper-evident), paired with the verifying allow decision | `the cross-tenant denial is AUDITABLE…` |
| Determinism + round-trip | the shared gates |

## Why the document is a mapping table (not the raw snapshot)

The W028 kernel's document grammars are strict by design:
`structured-json` admits exactly `{documentKind, mappings}` and
`structured-text` admits the mapping-line grammar — a raw provider
snapshot is not a mapping table and is rejected as malformed (unknown
fields). The slice therefore feeds the document pipeline a REAL
mapping-table document whose mappings target the adapter's OWN
projected entity types (`SOFTWARE_ENTITY_TYPES`) — the document teaches
the same neutral vocabulary the projection speaks, and the
digest-computed-at-birth + evidence-chain invariants are exercised on
genuine W028 state.

## How to run

```bash
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e \
  test/adapter-intake-slice.test.ts
```
