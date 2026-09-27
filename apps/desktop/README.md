# @epoch/desktop

Epoch desktop client (Work Order **W017**) — the **typed reference
implementation** of the desktop host shell.

Per `spec/architecture.md` (§Clients, binding): the web experience is
canonical; the Tauri 2 desktop/mobile shells share its semantic contracts,
and desktop may expose optional foundation-backed authoring surfaces whose
native timelines/documents/projects remain projections and working
artifacts. This package is the **typed shell architecture + in-memory
reference host** that the future native wrapper embeds: no native
bundling, no new third-party runtime dependencies, no engine, no
UI-framework coupling (the reference-implementation discipline).

## What lives here

- **Host-shell contracts** (`src/window.ts`, `src/session` state in
  `src/shell.ts`, `src/tenancy.ts`): the typed window model (a closed
  lifecycle state machine, content-addressed records with provenance,
  deterministic W013 session-id derivation) and session-scoped tenants
  resolved against `@epoch/tenancy` (the runtime pin).
- **The host↔shell envelope seam** (`src/envelopes.ts`): the typed IPC
  contract a native backend carries — versioned (one protocol version,
  skew fails fast), content-addressed (every envelope sealed with the
  canonical-JSON SHA-256), and replay-safe (per-session, per-direction
  channels with monotonic sequences and a digest chain; gaps, forks, and
  out-of-order deliveries are typed `replay-violation` rejections).
- **The full-fidelity desktop DeviceDescriptor** (`src/device.ts`): the
  W011 device-descriptor slot filled at the top rung of the device
  adaptation ladder (`spec/experience-architecture.md`: "desktop = full")
  — every desktop-serviceable modality, every Experience Graph kind
  hostable, spatial budgets at the renderer ceilings so the descriptor
  never downgrades any lawful renderer. Typed as data; concrete display
  adaptation is W019's surface.
- **Experience mounting** (`src/mounting.ts`, `src/plan.ts`): the shell
  mounts W011 Experience Graph projections through W012 compiler
  artifacts (a strict structural projection of the Render Plan, parity-
  pinned against the real compiler by a devDependency test) and drives
  W013 renderer invocations — `InvocationEnvelope` in, `RendererReceipt`
  out, `admitInvocation` enforcement ALWAYS honored. Bypass attempts are
  typed `authority-violation` rejections.
- **The authoring projection surface** (`src/authoring.ts`): optional,
  foundation-backed authoring affordances as PROJECTIONS — typed
  proposals through the kernel-seam action-type shape (R30: identical to
  the control-intent / action-protocol `ActionTypeReference`), status
  always `proposed`, zero shell authority (approval/execution are
  kernel-side through the Action Gateway).
- **The offline/session cache** (`src/cache.ts`): session-state snapshots
  and experience caches as typed, content-addressed projections with
  freshness/invalidation records — never a second semantic store
  (architecture lock rules 8/16).
- **The in-memory reference host** (`src/host.ts`): the native-side
  counterpart (lifecycle commands, input-driven requests,
  content-addressed offers, a digest-addressed ledger of shell reports)
  that the verification battery drives and a native backend replaces.

## Non-negotiables

- **Composition, never authority** (lock rules 8/16): the shell HOSTS
  projections and drives invocations; it never authors presentation,
  never mutates kernel state, and holds no authoring authority of its
  own.
- **Provider-neutral by construction** (lock rule 13): zero engine,
  vendor, framework, and native-toolkit vocabulary in source (pinned by
  `test/neutrality.test.ts`); the reference host is engine-free. The one
  locked seam where the native-wrapper product name may appear is the
  architecture-level client-family contract (`spec/architecture.md`
  §Clients) and this README, which quotes it.
- **Tenant isolation (R12)**: sessions are tenant-scoped through the
  reference tenancy hierarchy; cross-tenant scopes, offers, proposals,
  and cache reads are typed `cross-tenant-denied` rejections.
- **Determinism**: zero wall-clock, zero randomness; every derived
  identifier is a pure function of the applied host envelope chain.
  Replaying a verified chain through a fresh shell reproduces
  byte-identical snapshots and emitted chains
  (`test/determinism.test.ts`).
- **Provenance on every projected artifact**: windows, sessions,
  envelopes, proposals, snapshots, and cache entries all carry typed
  provenance records.

## Runtime dependencies (the frozen W017 pin)

`@epoch/experience-protocol`, `@epoch/renderer-runtime`,
`@epoch/agent-protocol`, `@epoch/tenancy`, `zod` — nothing else.
`@epoch/experience-compiler` (the W012 artifact shapes),
`@epoch/identity`, and `@epoch/authorization` are devDependency parity
pins, never runtime couplings (the W014 app pattern).

## Scripts

- `pnpm typecheck` — strict TS, no emit.
- `pnpm lint` — the shared Epoch ESLint boundary (app layer).
- `pnpm test` — the vitest evidence battery (positive, negative,
  boundary; every acceptance criterion of the Work Order maps to a named
  test — see the PR body).
