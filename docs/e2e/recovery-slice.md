# recovery-slice

Replay + recovery evidence — the Work Order's recovery acceptance.
Scenario definition: `examples/e2e/scenarios/recovery.ts` — test:
`tests/e2e/test/recovery-slice.test.ts` (6 tests).

## The path

```
slice 1 (construction-delivery) runs in full and produces the W010
  EventLog stream 'stream:delivery-warehouse-v1' (9 sealed lifecycle
  events: solution-sealed, baseline-approved, program-built, po-issued,
  observation-recorded ×2, actualization-applied, variance-computed,
  attribution-recorded — every event's data carries the exact kernel
  record digests)

  ──▶ REPLAY FROM SCRATCH: foldVerified(records) — every record's
       claimed digest is recomputed (verifyEventDigest) BEFORE it
       applies; the derived state accumulates the canonical ids+digests
  ──▶ REPLAY AGAIN (in-process): byte-identical state digest
  ──▶ REPLAY FROM A RESTORED LOG: EventLog.fromSnapshot(log.snapshot())
       → readStream → fold: byte-identical state digest
  ──▶ LIVE CROSS-CHECK: the replayed state ≡ the live kernel state
  ──▶ TAMPER: record #5 (mid-stream) has its payload mutated while the
       claimed digest is kept
  ──▶ the tampered record fails verifyEventDigest (typed
       digest-mismatch); the EventLog refuses its append; the verified
       fold halts at index 5 and its state is byte-identical to folding
       the UNTAMPERED records [0, 5) — the verified-prefix continuation
```

## The derived state (the replay model)

`DeliveryLifecycleState` folds: the solution digest, the baseline
approval digest, the program digest, the PO digest, the observation
id→digest map, the actual ids, the delivery head digest, the variance +
attribution (id, digest) pairs. The state digest is the canonical
SHA-256 over the state — byte-identical across identical folds by
construction.

## Invariants (assertion → named test)

| Invariant | Test |
| --- | --- |
| REPLAY DETERMINISM — twice in-process AND from a restored log snapshot → byte-identical derived-state digests | `REPLAY DETERMINISM…` |
| LIVE CROSS-CHECK — the replayed observation ids + digests, actual ids and delivery head digest EQUAL the live delivery record's; the variance + attribution pin the exact kernel digests | `LIVE CROSS-CHECK…` |
| TAMPER DETECTION — a mid-stream tampered record is the TYPED `digest-mismatch` (claimed vs recomputed), and the EventLog refuses its append | `TAMPER DETECTION…` |
| VERIFIED-PREFIX CONTINUATION — the fold halts exactly at the tampered record and its state is byte-identical to folding the untampered prefix | `VERIFIED-PREFIX CONTINUATION…` |
| The untampered stream verifies end-to-end; the restored log re-seals identically | `the untampered stream still verifies…` |
| Determinism + round-trip | the shared gates |

## How to run

```bash
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e \
  test/recovery-slice.test.ts
```
