// W032 — the fixture scenarios for the harness self-tests: a complete
// positive/negative scenario over the fixture ledger driver.
import type { ScenarioDefinition } from '../src';

/** The home + foreign tenants of the fixture scenarios. */
export const FIXTURE_HOME_TENANT = 'tenant:fixture-home';
export const FIXTURE_FOREIGN_TENANT = 'tenant:fixture-foreign';

/**
 * The reference fixture scenario: appends, a read, an identity projection,
 * a cross-tenant denial, and an authority-bypass rejection — exercising
 * every invariant on its satisfied path.
 */
export function ledgerScenario(): ScenarioDefinition {
  return {
    schemaVersion: 1,
    scenarioId: 'scenario:fixture-ledger',
    name: 'Fixture ledger scenario',
    description:
      'The harness self-test scenario: appends with provenance chains, an identity projection, a cross-tenant denial, and an authority-bypass rejection.',
    tenantId: FIXTURE_HOME_TENANT,
    actors: [
      { actorId: FIXTURE_HOME_TENANT, kind: 'tenant', tenantId: FIXTURE_HOME_TENANT },
      { actorId: 'principal:lead', kind: 'principal', tenantId: FIXTURE_HOME_TENANT, role: 'lead' },
      { actorId: FIXTURE_FOREIGN_TENANT, kind: 'tenant', tenantId: FIXTURE_FOREIGN_TENANT },
      { actorId: 'principal:foreign-agent', kind: 'principal', tenantId: FIXTURE_FOREIGN_TENANT },
    ],
    fixtures: [
      {
        fixtureId: 'fixture:record-alpha',
        kind: 'ledger-record',
        content: { recordId: 'record:alpha', payload: { note: 'first' } },
      },
    ],
    steps: [
      {
        stepId: 'step:append-alpha',
        kind: 'call',
        driverOp: 'ledger.append',
        label: 'append the first record',
        actorId: 'principal:lead',
        route: 'public-api',
        input: { recordId: 'record:alpha', payload: { note: 'first' } },
        expect: 'ok',
      },
      {
        stepId: 'step:append-beta',
        kind: 'call',
        driverOp: 'ledger.append',
        label: 'append the second record (chains to alpha)',
        actorId: 'principal:lead',
        route: 'public-api',
        input: { recordId: 'record:beta', payload: { note: 'second' } },
        expect: 'ok',
      },
      {
        stepId: 'step:read-count',
        kind: 'call',
        driverOp: 'ledger.read',
        label: 'read the ledger (no state delta)',
        actorId: 'principal:lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:project-ids',
        kind: 'call',
        driverOp: 'ledger.project-ids',
        label: 'project the record ids onto two surfaces',
        actorId: 'principal:lead',
        route: 'public-api',
        input: {
          surfaces: [
            { surface: 'ledger-records', ids: ['record:alpha', 'record:beta'] },
            { surface: 'ledger-index', ids: ['record:alpha', 'record:beta'] },
          ],
        },
        expect: 'ok',
      },
      {
        stepId: 'step:assert-identity',
        kind: 'assert',
        invariant: 'identity-preservation',
        label: 'the record ids identity-map across both surfaces',
        argument: { canonicalSurface: 'ledger-records', projectionSurfaces: ['ledger-index'] },
        expect: 'satisfied',
      },
      {
        stepId: 'step:foreign-append',
        kind: 'call',
        driverOp: 'ledger.append-foreign',
        label: 'a foreign tenant attempts an append (must be denied)',
        actorId: 'principal:foreign-agent',
        route: 'cross-tenant-attempt',
        input: { foreignTenantId: FIXTURE_FOREIGN_TENANT },
        expect: 'denied',
        expectedErrorCode: 'cross-tenant-denied',
      },
      {
        stepId: 'step:forge-state',
        kind: 'call',
        driverOp: 'ledger.forge-state',
        label: 'a direct-state write attempt (must be rejected)',
        actorId: 'principal:lead',
        route: 'direct-write-attempt',
        input: { recordId: 'record:forged' },
        expect: 'authority-rejected',
        expectedErrorCode: 'authority-bypass-rejected',
      },
    ],
    identityMap: [
      { canonicalId: 'record:alpha', surfaces: ['ledger-records', 'ledger-index'] },
      { canonicalId: 'record:beta', surfaces: ['ledger-records', 'ledger-index'] },
    ],
    invariants: [
      { invariant: 'tenant-isolation' },
      { invariant: 'provenance-chain' },
      { invariant: 'authority-routing' },
      { invariant: 'identity-preservation' },
      { invariant: 'scenario-round-trip' },
      { invariant: 'replay-determinism' },
    ],
  };
}

/** A scenario whose declared expectation is WRONG (the runner must fail it). */
export function expectationMismatchScenario(): ScenarioDefinition {
  const base = ledgerScenario();
  return {
    ...base,
    scenarioId: 'scenario:fixture-expectation-mismatch',
    steps: base.steps.map((step) =>
      step.stepId === 'step:foreign-append' && step.kind === 'call'
        ? { ...step, expect: 'ok' as const }
        : step,
    ),
  };
}

/** A scenario whose identity map is UNSATISFIABLE (an id never observed). */
export function brokenIdentityScenario(): ScenarioDefinition {
  const base = ledgerScenario();
  return {
    ...base,
    scenarioId: 'scenario:fixture-broken-identity',
    identityMap: [
      { canonicalId: 'record:never-appended', surfaces: ['ledger-records', 'ledger-index'] },
    ],
  };
}
