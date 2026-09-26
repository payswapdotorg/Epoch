# @epoch/mobile

Epoch Mobile Field Client (W018) — the typed field-shell architecture plus an
in-memory reference host. Per `spec/architecture.md` §Clients: *web canonical;
mobile is optimized for field capture/review/approval* — this package is the
typed reference implementation of that mobile role.

## Reference implementation discipline

This is the W020/W022/W029 precedent applied to the mobile client: the package
ships the **typed field-shell architecture** (contracts, invariants, digests,
typed error taxonomy) and an **in-memory reference host** that proves the
flows end-to-end. There is **no real native bundling** (no vendor shell, no
vendor mobile toolchain) and **no new third-party runtime dependency**. A real
native host would carry the same typed envelopes across its transport; the
seams below are exactly where it plugs in.

Runtime dependency pin (frozen by the Tech Lead): `@epoch/experience-protocol`,
`@epoch/solution-delivery`, `@epoch/action-protocol`, `@epoch/agent-protocol`,
`@epoch/tenancy`, `zod` — nothing else. Parity with `@epoch/action-policy`,
`@epoch/evidence`, `@epoch/renderer-runtime`, `@epoch/identity` and
`@epoch/authorization` is pinned by devDependency parity tests, never runtime
deps.

## The field-shell contracts

| Surface | Module | Role |
| --- | --- | --- |
| Field sessions | `src/session.ts` | Tenant-scoped capture sessions (open/pause/resume/close as immutable sealed records) with the FIELD-fidelity device descriptor. |
| Field device descriptor | `src/device.ts` | The mobile `DeviceDescriptor` at FIELD fidelity per the W011 device-descriptor slot and the experience-architecture fidelity ladder. |
| Capture envelopes | `src/capture.ts` | Versioned, content-addressed, replay-safe capture channels: quantity/progress observations shaped as W036 Observation-distinction record content, evidence by digest, mandatory uncertainty, unambiguous work-package linkage. |
| Field evidence | `src/evidence.ts` | Photo/sensor/note references in the W006 convention — content digests only, never embedded payloads. |
| Review/approval | `src/approval.ts` | Field review/approval as W003 typed proposals through the W022 action-gateway seam (`FieldApprovalGatewayPort`); gateway decision records (allow/deny/requires-approval) are received, never executed. |
| Offline queue | `src/queue.ts` | Typed, content-addressed, idempotent intent records; duplicate capture = sealed prior record; replay through kernel seams with provenance. |
| Reference sync host | `src/sync.ts` | The in-memory host that replays queued intents through the W036 observation-intake seam and the gateway seam. |

## Invariants (enforced as typed values, never exceptions)

- **Actions execute only through the Action Gateway** (lock rule 3): the
  client holds no credentials and executes nothing; approval intents without
  the gateway seam are typed `gateway-bypass-rejected`.
- **Tenant isolation** (R12): field sessions, capture envelopes, queue
  records and proposals are tenant-scoped via `@epoch/tenancy`; cross-tenant
  admissions are typed `cross-tenant-denied`.
- **Provider neutrality** (lock rule 13): no vendor, engine, framework or
  device-product vocabulary outside the neutral W011 descriptor vocabulary;
  the neutrality test scans every shipped source file.
- **Determinism**: same inputs → same digests; canonical JSON over
  canonically ordered arrays; zero wall-clock, zero randomness.
- **Provenance on every capture/proposal**: capture context
  (device descriptor digest, instants, principals) plus the mandatory W036
  uncertainty state (`observed` provenance kind for field captures).
- **The queue is never a second semantic store** (lock rules 8/16): sync
  admission replays through the kernel seams; queue records carry digests of
  the payloads they reference, not competing semantics.

## Scripts

```
pnpm --filter @epoch/mobile typecheck   # tsc --noEmit
pnpm --filter @epoch/mobile lint        # eslint .
pnpm --filter @epoch/mobile test        # vitest run
```

See `spec/work-orders/W018-mobile-field-client.md` for the Work Order and
`spec/worker-runbook.md` for the branch/PR/evidence rules this package was
delivered under.
