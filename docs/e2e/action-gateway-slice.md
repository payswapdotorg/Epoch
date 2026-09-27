# action-gateway-slice

The action path: a typed action proposal from an agent-runtime work
item, decided by the REAL W022 policy kernel, executed only through the
authority seam, recorded as execution events. Scenario definition:
`examples/e2e/scenarios/action-gateway.ts` — test:
`tests/e2e/test/action-gateway-slice.test.ts` (11 tests).

## The path

```
W029 GithubAdapterHost.ingestSnapshot + projectSnapshot (the workspace
     state is observed; digest identity across ingestion/projection)

W029 buildChangeProposal — the deterministic W003 proposal (round-trips
     the REAL parseActionProposal; content-addressed)

W020 the agent binding (the adapter's OWN declared capability
     'software.change-routing' 1.0.0, digested via the kernel's
     computeAgentBindingDigest + validated by parseAgentBinding)
   ──▶ the authored plan (the work item = one step referencing the
        EXACT proposal revision)
   ──▶ compilePlan (deterministic) ──▶ createSessionRecord
   ──▶ transitionSessionStatus('running') ──▶ the ProposalHandoff
        (the kernel's published handoff contract, digested + parsed)

W022 PolicyRegistryAuthorityPort — the ActionAuthorityPort seam over
     the REAL ActionPolicyRegistry (the production implementation is
     the Action Gateway service; this port composes the same kernel)
   ──▶ routeChange #1: requires-approval (the adapter's reference pin)
   ──▶ recordApproval (the REAL human-approval flow: quorum role gate,
        deadline gate, idempotency)
   ──▶ routeChange #2: the registry's idempotent decision echo carries
        the approval → authorized → executeAction → the OUTCOME record
        → disposition 'executed'

W022 the full decision vocabulary (all through the real kernel):
     allow (a sibling proposal without human approval, executed
     through the port) · deny 'no-applicable-policy' (empty policy set,
     fail-closed) · deny 'proposal-expired' · deny 'constraint-blocked'
     (violated hard constraint: changeCount 99 ≥ 10)

W036/W038 the integration solution + program + tracking store
   ──▶ admitTrackingState (the authority-authorized change applied)
   ──▶ sealExecutionEvent 'execution:tracking-recorded' (the W038
        realization record, canonical work-package subject)

W010 the action lifecycle stream 'stream:action-workspace-change-1'
     (proposed → authorized → executed; every event carries the EXACT
     proposal reference; parseActionLifecycleEventData validates)
```

## Invariants (assertion → named test)

| Invariant | Test |
| --- | --- |
| The proposal digest is THE SAME at every surface — W003 admission, W029 plan reference, W020 work item + handoff, W022 decisions (both routings), every W010 lifecycle event | `the proposal digest is THE SAME at every surface` |
| The OUTCOME record references the exact proposal digest (outcome → the dispatch's decision → the registry's sealed decision → `proposalRef.canonicalDigest`; the plan digest rides the outcome's evidence refs) | `the OUTCOME record references the exact proposal digest…` |
| requires-approval → approved → executed (the reference path, with the registry's approval-request state) | `the W022 decision vocabulary: requires-approval…` |
| allow (no human approval; decision mirror authorized; outcome succeeded; the proposal digest in the evidence refs) | `the W022 decision vocabulary: allow` |
| deny — no-applicable-policy (fail-closed) | `the W022 decision vocabulary: deny — no-applicable-policy` |
| deny — proposal-expired | `the W022 decision vocabulary: deny — proposal-expired` |
| deny — constraint-blocked | `the W022 decision vocabulary: deny — constraint-blocked` |
| The W022 decision chain verifies (append-only, hash-linked: the empty-policy denial chains onto the approval-path decision; every record verifies) | `the W022 decision chain verifies` |
| `gateway-bypass-rejected`: an execute-direct envelope is the typed rejection AND the authority is NEVER CALLED (a throwing port proves the negative) | "`gateway-bypass-rejected`…" |
| The W038 execution event + W010 action lifecycle events carry canonical identities (phases, chain, digests verified) | `the W038 execution event + W010 action lifecycle events…` |
| Determinism + round-trip | the shared gates |

## The dependency deviation (documented)

The W022 decision vocabulary requires at least one SATISFIED compiled
ECL constraint: the W004 composite over the effective bindings is
fail-closed — an empty composition is `not-applicable`, which maps to
deny `no-applicable-policy` BEFORE the approval/allow branches.
Compilation is `@epoch/policy-contracts`' authority (the W004 kernel),
which is NOT in W031's frozen devDependency enumeration but IS an
existing workspace package and already a runtime dependency of
`@epoch/action-policy` (which IS in the enumeration). The scenario
declares it as ONE additional devDependency — without it, this slice's
mandated positive path (decision → outcome record → execution event)
is unreachable and the slice collapses to deny-only evidence. The
constraint fixture (`change-budget`: violated iff `changeCount ≥ 10`,
compiled through the REAL `compileConstraint`) mirrors the github
adapter's own reference test wiring.

The `allow` vocabulary is exercised at the authority seam (the port
over the real registry) because the W029 reference adapter pins
`requiresHumanApproval: true` on every proposal it builds — an
adapter-routed `allow` is structurally impossible with the reference
adapter (see the known-gaps section of the [README](./README.md)).

## How to run

```bash
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e \
  test/action-gateway-slice.test.ts
```
