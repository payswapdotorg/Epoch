# qa/cross-platform — the W050 cross-platform journey harness

The closing acceptance battery of the ACR-005 productization program
(W050 — Cross-Platform Release + Journey Closure). It proves the
cross-platform invariants of `spec/productization-architecture.md`
against the REAL product engines of all three clients:

- **web** — the W047 server product runtime + the client envelope
  builders the visible UI uses (`apps/web/src/server/product-runtime`,
  `apps/web/src/client/envelopes`, `apps/web/src/product/derivation`);
- **desktop** — the W048 `DesktopProduct` over the embedded fixture-backed
  gateway, the exact composition root the Tauri webview drives
  (`apps/desktop/src/native`);
- **mobile** — the W049 `MobileFieldHost` over the seeded fixture gateway,
  the exact field product the React Native app hosts
  (`apps/mobile/src/product`).

All three compose the SAME authorities (the W046 Application Gateway)
over the SAME deterministic fixtures (`qa/fixtures`, registry-verified)
— one semantic truth, three projections.

## The checks

| ID | What it proves |
| --- | --- |
| X-01 | **Digest continuity** — the world digest every platform projects equals the registry anchor (both fixture domains). |
| X-02 | **Cross-device session continuity** — the same fixture principal signs in on every platform; tenant/principal resolve identically; semantics never mutate on sign-in. |
| X-03 | **Capture continuity** — the same fixture bytes produce the same digest through every platform's evidence path (mobile digest-before-upload, desktop authority-recomputed intake, web record binding). |
| X-04 | **Approval continuity** — approvals run only through the Action Gateway on every platform, with one status vocabulary (awaiting-approval → authorized → executed). |
| X-05 | **Offline no-drift** — the same capture content, online on one device and offline-then-synced on another, resolves to the identical authoritative outcome digest, exactly once. |
| X-06 | **Release identity** — the `release/clients` manifest covers all six platforms with precise source commits, git tree identities and checksums that recompute over the delivered definition files. |

## Running

```bash
# from apps/web (the harness owner — the canonical client):
pnpm run cross:journeys          # the harness alone
pnpm test                        # the full apps/web battery (includes the harness)
```

The harness rides `apps/web`'s vitest config (the W048 qa/desktop
precedent: an out-of-workspace harness wired through its owning app).
`apps/web/scripts/link-cross-harness.mjs` creates the harness's
`node_modules` symlink (idempotent, gitignored, CI-safe via vitest
globalSetup); the typecheck of the harness never depends on it
(`qa/cross-platform/tsconfig.json` resolves every bare import
declaratively — cold-checkout safe).

## Evidence

With `EPOCH_EMIT_CROSS_RECORDS=1` the run emits
`records/cross-platform-records.json` — the committed typed records
(one per check per domain, the `spec/journey-validation.md` field
contract) cited by `docs/journeys/cross-platform.md`.

## Honest scope

This Linux sandbox has no cargo/webkit2gtk, no Android SDK and no Xcode:
the packaged-binary journeys belong to the per-platform records
(`docs/journeys/desktop-*.md`, `docs/journeys/mobile-*.md`) and the
release identity of the config-delivered platforms is carried by
`release/clients/` with declared environment gaps. This harness executes
the REAL product engines in-process — never a mock or a parallel
reimplementation.
