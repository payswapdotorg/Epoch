# apps/web/src/features/agents — the W015 AI Collaboration UX feature module

A typed feature library for the **AI Collaboration UX** (Work Order W015):
feature contracts + runtime guards + pure view-model builders +
presentational components for the agent-collaboration panel (presence
roster, control state with recorded takeover denials, timeline with
branch points, typed activity feed, and Engineering Moment cards).

## Conventions

- **Self-contained**: the module imports NOTHING outside `apps/web`
  (react + relative paths only). The logic files (`contracts.ts`,
  `guards.ts`, `view-models.ts`) import no react at all.
- **Structural contracts**: `contracts.ts` mirrors the
  `@epoch/ai-experience` public surface field-for-field. The package's
  records are serialization-friendly plain JSON, so they satisfy these
  structural types at runtime without any import. The package-side test
  `packages/ai-experience/test/feature-projection.test.ts` pins the
  exact serialized key sets of every consumed record type — contract
  drift fails the workspace battery.
- **Runtime guards**: `guards.ts` validates the structural contracts at
  JSON boundaries (hand-written and deterministic — the app manifest is
  frozen during W015, so no zod in the app).
- **Pure view models**: `view-models.ts` derives deterministic display
  models (sorted rows, derived labels, bounded feed) — no clock, no
  randomness, no environment access.
- **Presentational components**: `components/` renders the view models
  with semantic markup only; the app shell (W014) owns the design system
  and route mounting.

## Integration path (deferred by design)

Wiring this module into the app — declaring `@epoch/ai-experience` in
`apps/web/package.json`, registering the feature descriptor with the
shell's mounting seam, and feeding the panel live collaboration
projections — is a serialized shell/integration change:
`apps/web/package.json`, `apps/web/app/*`, `apps/web/src/shell/*`, and
`apps/web/src/shared/*` are frozen surfaces during the W014/W015/W023
wave (features enter the shell ONLY through explicit typed registration
— never directory discovery). Until then the module stands alone: it
compiles, lints, and builds green within the app workspace
(`pnpm --filter @epoch/web typecheck`, `lint`, `build`).

## Testing (the standing feature-module convention)

Following the marketplace feature module's standing convention (W023),
this module ships no app-side test files: the app test harness landed
with the shell (W014) after this module's dispatch base, and the frozen
app manifest prevents declaring test-only dependencies for the feature
tree. The module's correctness is pinned from the OWNING package
instead:

- `packages/ai-experience/test/feature-projection.test.ts` pins the
  exact serialized key sets and semantic invariants of every record type
  these contracts mirror (drift fails the workspace battery);
- the view-model builders are pure, total, deterministic functions over
  those pinned shapes (typechecked by the app's `tsc --noEmit`);
- the runtime guards are exercised indirectly through the same pinned
  record fixtures.

Once an integration Work Order wires the app manifest, the parity pin
extends naturally into the app harness (the mirrors live in one file,
`contracts.ts`, precisely so that pin stays cheap).

## Public surface

`index.ts` re-exports the contracts, guards, view-model builders, and
components. The intended shell usage:

```tsx
import { AgentCollaborationPanel, buildAgentCollaborationViewModel } from '@/features/agents';
// (path aliasing is the shell's decision; the module itself uses relative imports)

const model = buildAgentCollaborationViewModel(session, projection, events, moments);
<AgentCollaborationPanel model={model} />
```
