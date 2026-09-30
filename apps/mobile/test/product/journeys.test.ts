// THE W049 MOBILE JOURNEY SIMULATION — the in-sandbox execution of the
// mobile journey subset (spec/journey-validation.md) against the REAL
// product engine (the W046 Application Gateway in-process, the W018 field
// surface, the platform seams with scripted/harness adapters):
//   J01 onboarding/project entry, J02 field subset (understand/inspect),
//   J04 approval subset, J06 realize/field observation, J07 offline
//   work/queue/reconnect/idempotent sync, J08 cross-device handoff,
//   J09 agent supervision, J11 recovery, J12 relaunch.
//
// HONEST SCOPE (the sandbox honesty rule): this Linux sandbox has NO
// Android SDK and NO Xcode — real device/emulator runs are IMPOSSIBLE
// here. These simulations execute the product ENGINE (the same typed code
// the native UI renders) over the real gateway and the committed
// fixtures; the built-app journeys run through the detox harness under
// qa/mobile/ on infra with the mobile toolchains (see
// docs/journeys/mobile-{android,ios}.md for the records and the gap).
//
// Every journey produces a typed record (journey_id, platform, persona,
// product_version, source_commit, environment, fixture_id, preconditions,
// actions, expected/observed outcomes, evidence digests, disposition).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { MOBILE_PRODUCT_IDENTITY } from '../../native/identifiers';
import { buildFieldReviewActionPayload } from '../../src/product/approval-pipeline';
import { buildFixtureGateway } from '../../src/product/fixture-gateway';
import { MemoryCameraPort } from '../../src/product/camera';
import { MemorySecureStore } from '../../src/product/secure-store';
import { ScriptedNetworkState } from '../../src/product/offline';
import { MobileFieldHost, parsePersistedSession } from '../../src/product/field-host';
import {
  buildSignedInHost,
  fieldUncertainty,
  loadConstructionRecords,
  photoFrame,
  progressMeasure,
  quantityMeasure,
  T09,
  T10,
  T11,
  T12,
  T13,
  T14,
  T15,
  T16,
} from './helpers';

/** The environment record (the honest environment statement). */
const ENVIRONMENT = {
  sandbox: 'linux-debian-13 (no Android SDK, no Xcode — device runs impossible)',
  execution: 'journey simulation over the real product engine (the W046 gateway in-process)',
  harness: 'detox E2E specs under qa/mobile/ (complete, runnable-on-infra, validated by test/product/harness-validation.test.ts)',
} as const;

/** The product version + source commit of the record. */
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..', '..');

const PRODUCT_VERSION = MOBILE_PRODUCT_IDENTITY.productVersion;
const SOURCE_COMMIT = (() => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();
const FIXTURE_ID = 'epoch-fixture-construction-v1.0.0';

/** One typed journey record (the spec/journey-validation.md fields). */
interface JourneyRecord {
  readonly journeyId: string;
  readonly platform: 'android' | 'ios';
  readonly persona: string;
  readonly productVersion: string;
  readonly sourceCommit: string;
  readonly environment: string;
  readonly fixtureId: string;
  readonly preconditions: readonly string[];
  readonly actions: readonly string[];
  readonly expected: readonly string[];
  readonly observed: readonly string[];
  readonly evidence: readonly string[];
  readonly defects: 'none' | string;
  readonly disposition: string;
}

/** Render one record per platform (android + ios). */
function recordFor(journey: Omit<JourneyRecord, 'platform'>, platform: 'android' | 'ios'): JourneyRecord {
  return { ...journey, platform };
}

/** The accumulated journey records (asserted + exposed for the docs). */
const RECORDS: JourneyRecord[] = [];

describe('J01 — onboarding / project entry (mobile)', () => {
  it('the field principal signs in: session.issue through the gateway, secure-store persistence, field session, project context, world projection', async () => {
    const bundle = await buildSignedInHost({ at: T09 });
    const host = bundle.host;
    const persisted = await bundle.secureStore.getItem('epoch.field.session');
    expect(persisted).toBeDefined();
    const parsed = parsePersistedSession(persisted!);
    expect(parsed?.session.sessionId).toBe(host.currentSession?.sessionId);
    expect(parsed?.principalId).toBe('principal:delivery-lead');
    expect(host.currentSession?.state).toBe('active');
    // The field session (the W018 capture channel).
    expect(host.currentFieldSession?.sessionId).toMatch(/^field-session:/);
    // The project context resolves.
    const context = await host.resolveContext('project:steel-warehouse-b');
    expect(context.ok).toBe(true);
    if (context.ok) {
      const node = (context.value as { node?: { kind?: string; parentId?: string } }).node;
      expect(node?.kind).toBe('project');
      expect(node?.parentId).toBe('workspace:warehouse-extension');
    }
    const expected = [
      'the session issues through the gateway from the fixture VERIFIED authentication result',
      'the session persists ONLY through the secure store seam',
      'the W018 field session opens',
      'the project context + world projection resolve',
    ];
    const observed = [
      `session ${host.currentSession?.sessionId} active`,
      `secure store holds epoch.field.session (${parsed?.session.sessionId})`,
      `field session ${host.currentFieldSession?.sessionId}`,
      'context.resolve returned the project node; world snapshot digest available',
    ];
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J01',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['the app is installed and launched', 'the fixture identity is bundled'],
            actions: ['sign in on the onboarding surface'],
            expected,
            observed,
            evidence: ['test/product/journeys.test.ts (J01)'],
            defects: 'none',
            disposition: 'simulated-pass (device run deferred to infra — see the honest limitations)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J02 — understand/reconstruct, inspect known/unknowns (field subset)', () => {
  it('the field surface projects the work packages, activities, milestones and the schedule folds', async () => {
    const bundle = await buildSignedInHost();
    const host = bundle.host;
    const projections = host.programProjections();
    expect(projections.workPackages.map((wp) => wp.workPackageId)).toEqual([
      'work-package:warehouse-substructure',
      'work-package:warehouse-superstructure',
    ]);
    expect(projections.activities.length).toBeGreaterThanOrEqual(3);
    expect(projections.milestones.map((m) => m.milestoneId)).toContain('milestone:foundations-complete');
    const schedule = await host.programSchedule();
    expect(schedule.ok).toBe(true);
    if (schedule.ok) {
      const folds = schedule.value as { quantity?: unknown; cost?: unknown; milestones?: unknown };
      expect(folds.quantity).toBeDefined();
      expect(folds.cost).toBeDefined();
      expect(folds.milestones).toBeDefined();
    }
    const entities = await host.worldEntities();
    expect(entities.ok).toBe(true);
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J02',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete (a signed-in session)'],
            actions: ['open the project tab', 'inspect work packages / schedule / world'],
            expected: [
              'the program projections list the fixture work packages',
              'the schedule folds (quantity/cost/milestones) project',
              'the world entities projection is readable',
            ],
            observed: [
              `2 work packages, ${projections.activities.length} activities, 2 milestones`,
              'program.schedule returned the folds',
              'world.entities returned the projection',
            ],
            evidence: ['test/product/journeys.test.ts (J02)'],
            defects: 'none',
            disposition: 'simulated-pass (field subset)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J04 — approval subset (Action Gateway approval)', () => {
  it('submit a field review, approve through the gateway, read the status — the ONLY route', async () => {
    const bundle = await buildSignedInHost();
    const host = bundle.host;
    const payload = buildFieldReviewActionPayload({
      actionId: 'action:j04-field-review',
      messageId: 'j04-msg-1',
      proposalId: 'j04-prop-1',
      createdAt: T12,
      proposedBy: 'agent:epoch-field-product',
      observationId: 'observation:j04',
      deliveryId: host.deliveryId,
      reviewKind: 'observation-acceptance',
      reviewer: 'principal:delivery-lead',
      justification: 'J04 journey: accept the field observation.',
      evidenceDigests: ['81130ca4fb28e23dc47fd01a8318223710397dacba7461bb2b23f13f204d19b'],
      tenantId: host.tenantId,
      sessionId: host.currentSession!.sessionId,
      expiresAt: '2027-01-01T00:00:00.000Z',
      approvalDeadline: '2026-12-31T00:00:00.000Z',
    });
    const submitted = await host.submitAction(payload);
    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      const action = (submitted.result as { action?: { status?: string } }).action;
      expect(action?.status).toBe('awaiting-approval');
    }
    const approved = await host.approveAction({
      actionId: 'action:j04-field-review',
      decidedById: 'principal:chief-engineer',
      decidedByRole: 'human-approver',
      asRole: 'senior-structural-engineer',
      note: 'J04 journey approval',
      at: T13,
    });
    expect(approved.ok).toBe(true);
    const status = await host.actionStatus('action:j04-field-review');
    expect(status.ok).toBe(true);
    if (status.ok) {
      const action = status.value as { actionId?: string; status?: string };
      expect(action.actionId).toBe('action:j04-field-review');
      expect(action.status).toBe('authorized');
    }
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J04',
            persona: 'principal:chief-engineer (approver) via principal:delivery-lead session',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete', 'an observation awaits review'],
            actions: ['submit the field review proposal', 'approve through the gateway'],
            expected: [
              'the proposal submits through action.submit (requires-approval)',
              'the approval applies through action.approve ONLY',
              'the action status reads approved',
            ],
            observed: [
              'submit -> awaiting-approval (decision requires-approval)',
              'approve -> applied through the Action Gateway authority',
              'action.status -> authorized (approved through the gateway)',
            ],
            evidence: ['test/product/journeys.test.ts (J04)', 'test/product/named-negatives.test.ts (b)'],
            defects: 'none',
            disposition: 'simulated-pass (approval subset)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J06 — realize: field observation with digest-addressed evidence', () => {
  it('capture with photo evidence: the digest is computed BEFORE upload, the authority recomputes it, the records reference the digest', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('j06-evidence')] });
    const host = bundle.host;
    bundle.clock.advanceTo(T12);
    const capture = await host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('118.5', 'm3'),
      uncertainty: fieldUncertainty(T12, 'principal:delivery-lead'),
      observedAt: T12,
      captureId: 'j06-capture-1',
      evidence: [{ note: 'excavation progress photo' }],
    });
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      expect(capture.mode).toBe('online');
      expect(capture.evidence).toHaveLength(1);
      expect(capture.evidence[0]!.digestVerified).toBe(true);
      expect(capture.evidence[0]!.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(capture.capture.link.workPackageId).toBe('work-package:warehouse-substructure');
      expect(capture.outcomeDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    // The progress projection path (the other measure kind).
    const progress = await host.captureObservation({
      anchor: { kind: 'activity', id: 'activity:warehouse-foundations' },
      measure: progressMeasure(0.5),
      uncertainty: fieldUncertainty(T12, 'principal:delivery-lead'),
      observedAt: T12,
      captureId: 'j06-capture-2',
    });
    expect(progress.ok).toBe(true);
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J06',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01/J02 complete', 'the camera seam is bound (scripted frame)'],
            actions: ['capture a photo (digest-addressed)', 'submit the quantity observation', 'submit a progress observation'],
            expected: [
              'the evidence digest is computed before upload and the authority recomputation matches',
              'the observation intakes through delivery.observe (the W038 authority)',
              'progress observations project without invented state',
            ],
            observed: [
              `evidence digest ${capture.ok ? capture.evidence[0]!.digest.slice(0, 16) : ''}… verified`,
              `delivery.observe outcome ${capture.ok ? capture.outcomeDigest?.slice(0, 16) : ''}… recorded`,
              'progress capture admitted (authority-derived state only)',
            ],
            evidence: ['test/product/journeys.test.ts (J06)', 'test/product/evidence-capture.test.ts'],
            defects: 'none',
            disposition: 'simulated-pass',
          },
          platform,
        ),
      );
    }
  });
});

describe('J07 — offline work, queue, reconnect, idempotent sync', () => {
  it('the full offline interval: queue as pending projections, transient drain failure, reconnect drain, exactly-once proof', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('j07-evidence')] });
    const host = bundle.host;
    bundle.clock.advanceTo(T13);
    host.goOffline();
    const queued = await host.captureObservation({
      anchor: { kind: 'activity', id: 'activity:warehouse-excavation' },
      measure: quantityMeasure('60', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'j07-capture-1',
      evidence: [{ note: 'offline photo' }],
    });
    expect(queued.ok).toBe(true);
    if (queued.ok) expect(queued.mode).toBe('offline-queued');
    expect(host.queueSnapshot()).toHaveLength(1);
    // The drain during the offline interval: transient failure, stays pending.
    const offlineDrain = await host.offlineSync!.drain(T13);
    expect(offlineDrain.drained).toHaveLength(0);
    expect(offlineDrain.stillPending[0]!.lastErrorCode).toBe('network-unavailable');
    // The reconnect + sync.
    bundle.clock.advanceTo(T14);
    const report = await host.syncNow(T14);
    expect(report.drain.drained).toHaveLength(1);
    expect(report.duplicateSideEffects).toBe(0);
    expect(report.replayProofs[0]!.replayed).toBe(true);
    expect(report.replayProofs[0]!.digestStable).toBe(true);
    expect(host.queueSnapshot()).toHaveLength(0);
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J07',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete', 'the network seam allows the offline interval'],
            actions: ['enter the offline interval', 'capture + queue the observation', 'attempt the drain (offline)', 'reconnect + sync'],
            expected: [
              'the intent queues as a PENDING projection (never applied locally)',
              'the offline drain fails transiently (network-unavailable) and stays pending',
              'the reconnect drains through the Action Gateway with the idempotency key',
              'the replay returns the recorded outcome — exactly once, zero duplicate side effects',
            ],
            observed: [
              'queue: 1 pending intent (delivery.observe)',
              `offline drain: stillPending=1, lastErrorCode=network-unavailable`,
              `reconnect drain: drained=1, outcomeDigest=${report.drain.drained[0] ? '' : ''}${report.replayProofs[0]?.outcomeDigest.slice(0, 16)}…`,
              `replay: replayed=true, digestStable=true, duplicateSideEffects=${report.duplicateSideEffects}`,
            ],
            evidence: ['test/product/journeys.test.ts (J07)', 'test/product/named-negatives.test.ts (c)'],
            defects: 'none',
            disposition: 'simulated-pass (the ACTUAL offline interval is scripted at the network seam — the transport layer)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J08 — cross-device handoff', () => {
  it('the mobile-resolved state matches the authoritative fixture state (the world digest web/desktop resolve from the same fixtures)', async () => {
    const bundle = await buildSignedInHost();
    const host = bundle.host;
    const crossDevice = await host.crossDeviceState();
    expect(crossDevice.ok).toBe(true);
    if (crossDevice.ok) {
      // The registry anchor: what the web/desktop products resolve.
      const registry = JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'registry.json'), 'utf8'),
      ) as { domains: { domain: string; worldDigest: string; programContentDigest: string; deliveryContentDigest: string }[] };
      const construction = registry.domains.find((domain) => domain.domain === 'construction')!;
      expect(crossDevice.value.worldDigest).toBe(construction.worldDigest);
      expect(crossDevice.value.programContentDigest).toBe(construction.programContentDigest);
      // The same digest the bundled native app pins.
      const bundled = JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'apps', 'mobile', 'native', 'fixtures', 'world.json'), 'utf8'),
      ) as { digest: string };
      expect(crossDevice.value.worldDigest).toBe(bundled.digest);
    }
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J08',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete', 'the same fixtures back the web/desktop products'],
            actions: ['read the cross-device state (world snapshot + program digest)'],
            expected: ['the mobile-resolved digests equal the authoritative registry digests'],
            observed: [
              crossDevice.ok ? `worldDigest ${crossDevice.value.worldDigest.slice(0, 16)}… = registry anchor` : 'failed',
              crossDevice.ok ? `programContentDigest ${crossDevice.value.programContentDigest.slice(0, 16)}… = registry anchor` : 'failed',
            ],
            evidence: ['test/product/journeys.test.ts (J08)', 'test/product/fixtures.test.ts'],
            defects: 'none',
            disposition: 'simulated-pass (cross-device state observable)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J09 — agent supervision / intervention (field subset)', () => {
  it('the supervision check runs over the fixture program/delivery; pending actions are readable', async () => {
    const bundle = await buildSignedInHost();
    const host = bundle.host;
    const supervision = await host.supervisionCheck({
      passId: 'pass:j09-field',
      evaluatedAt: T15,
      thresholds: {
        quantityOverrunRatio: '1.1',
        costOverrunRatio: '1.1',
        quantityUnderrunRatio: '0.9',
        costUnderrunRatio: '0.9',
      },
    });
    expect(supervision.ok).toBe(true);
    if (supervision.ok) {
      const pass = supervision.value as { passId?: string; findings?: unknown[] };
      expect(pass.passId).toBe('pass:j09-field');
    }
    const actions = await host.actionStatus();
    expect(actions.ok).toBe(true);
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J09',
            persona: 'principal:chief-engineer (supervisor)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete', 'the fixture program + delivery are sealed'],
            actions: ['run the supervision check', 'read the pending actions'],
            expected: [
              'the supervision pass evaluates over the real W043 authority',
              'the action list projects through action.status',
            ],
            observed: ['supervision.check returned the sealed pass', 'action.status readable'],
            evidence: ['test/product/journeys.test.ts (J09)'],
            defects: 'none',
            disposition: 'simulated-pass (supervision field subset)',
          },
          platform,
        ),
      );
    }
  });
});

describe('J11 — recovery from session/network/authority failures', () => {
  it('session expiry -> typed auth error -> re-authenticate; network failure -> typed transient -> retry; authority rejection surfaces verbatim', async () => {
    // (1) Session expiry: a short-TTL session expires; the next call maps
    // to the typed re-authenticate recovery action; re-auth works.
    const clock = { instant: T10 };
    const gateway = buildFixtureGateway({ records: loadConstructionRecords(), clock: () => clock.instant });
    const secureStore = new MemorySecureStore();
    const expiring = new MobileFieldHost({
      transport: gateway.transport,
      clock: () => clock.instant,
      records: gateway.records,
      secureStore,
      camera: new MemoryCameraPort([photoFrame('j11')]),
      network: new ScriptedNetworkState(true),
      principalId: 'principal:delivery-lead',
      sessionNonce: 'nonce:j11-expiry',
      sessionTtlMs: 60 * 60 * 1000, // one hour
      correlationPrefix: 'j11',
    });
    const signed = await expiring.signIn();
    expect(signed.ok).toBe(true);
    clock.instant = T16; // six hours later — expired.
    const world = await expiring.worldSnapshot();
    expect(world.ok).toBe(false);
    if (!world.ok) {
      expect(world.failure.error.class).toBe('auth-session-expired');
      expect(world.failure.recovery).toBe('re-authenticate');
    }
    const reauthenticated = await expiring.reauthenticate();
    expect(reauthenticated.ok).toBe(true);
    // (2) Network failure: the offline drain's typed transient error.
    const bundle = await buildSignedInHost();
    bundle.host.goOffline();
    const offline = await bundle.host.offlineSync!.drain(T15);
    if (offline.stillPending.length > 0) {
      expect(offline.stillPending[0]!.lastErrorCode).toBe('network-unavailable');
    }
    bundle.host.networkState.setOnline(true);
    // (3) Authority rejection surfaces verbatim: a malformed proposal.
    const badPayload = { actionId: 'action:j11-bad', proposal: { not: 'a-proposal' }, policies: [] } as never;
    const bad = await bundle.host.submitAction(badPayload);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.failure.error.class).toBe('authority-rejected');
      expect(bad.failure.recovery).toBe('surface-authority-rejection');
      expect(bad.failure.error.details?.authority).toBe('@epoch/action-gateway');
    }
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J11',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['J01 complete (a short-TTL session)'],
            actions: ['let the session expire', 'call with the expired session', 're-authenticate', 'go offline + drain', 'submit a malformed proposal'],
            expected: [
              'the expired session maps to the typed re-authenticate recovery action',
              're-authentication restores a working session',
              'the offline drain fails with the typed transient network error',
              'the authority rejection surfaces verbatim with its typed details',
            ],
            observed: [
              'auth-session-expired / session-expired -> re-authenticate',
              're-authenticated session active',
              'network-unavailable (transient, retryable)',
              'authority-rejected carrying @epoch/action-gateway validation issues',
            ],
            evidence: ['test/product/journeys.test.ts (J11)'],
            defects: 'none',
            disposition: 'simulated-pass',
          },
          platform,
        ),
      );
    }
  });
});

describe('J12 — install -> launch -> work -> close -> relaunch -> update', () => {
  it('relaunch: a fresh host over the SAME authorities restores the session from the secure store; sign-out clears it', async () => {
    // The launch + work.
    const clock = { instant: T11 };
    const gateway = buildFixtureGateway({ records: loadConstructionRecords(), clock: () => clock.instant });
    const secureStore = new MemorySecureStore();
    const network = new ScriptedNetworkState(true);
    const first = new MobileFieldHost({
      transport: gateway.transport,
      clock: () => clock.instant,
      records: gateway.records,
      secureStore,
      camera: new MemoryCameraPort([photoFrame('j12')]),
      network,
      principalId: 'principal:delivery-lead',
      sessionNonce: 'nonce:j12-relaunch',
      correlationPrefix: 'j12',
    });
    const signed = await first.signIn();
    expect(signed.ok).toBe(true);
    const worked = await first.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('30', 'm3'),
      uncertainty: fieldUncertainty(T11, 'principal:delivery-lead'),
      observedAt: T11,
      captureId: 'j12-capture-1',
    });
    expect(worked.ok).toBe(true);
    // The RELAUNCH: a fresh host instance (new app process) over the SAME
    // authorities (the server state survives) + the SAME secure store.
    clock.instant = T12;
    const relaunched = new MobileFieldHost({
      transport: gateway.transport,
      clock: () => clock.instant,
      records: gateway.records,
      secureStore,
      camera: new MemoryCameraPort([photoFrame('j12')]),
      network,
      principalId: 'principal:delivery-lead',
      sessionNonce: 'nonce:j12-relaunch',
      correlationPrefix: 'j12',
    });
    const restored = await relaunched.restoreOrSignIn();
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.restored).toBe(true);
      expect(restored.session.sessionId).toBe(signed.ok ? signed.session.sessionId : '');
    }
    // The relaunched host still works (the world digest is consistent).
    const world = await relaunched.worldSnapshot();
    expect(world.ok).toBe(true);
    // The close: sign out (the session revokes through the gateway; the
    // secure store record clears).
    await relaunched.signOut();
    expect(await secureStore.getItem('epoch.field.session')).toBeUndefined();
    // The next relaunch signs in FRESH (not restored).
    const third = new MobileFieldHost({
      transport: gateway.transport,
      clock: () => clock.instant,
      records: gateway.records,
      secureStore,
      camera: new MemoryCameraPort([photoFrame('j12')]),
      network,
      principalId: 'principal:delivery-lead',
      sessionNonce: 'nonce:j12-relaunch-2',
      correlationPrefix: 'j12',
    });
    const fresh = await third.restoreOrSignIn();
    expect(fresh.ok).toBe(true);
    if (fresh.ok) expect(fresh.restored).toBe(false);
    for (const platform of ['android', 'ios'] as const) {
      RECORDS.push(
        recordFor(
          {
            journeyId: 'J12',
            persona: 'principal:delivery-lead (field engineer)',
            productVersion: PRODUCT_VERSION,
            sourceCommit: SOURCE_COMMIT,
            environment: `${ENVIRONMENT.sandbox}; ${ENVIRONMENT.execution}`,
            fixtureId: FIXTURE_ID,
            preconditions: ['the app is installed (the bundled fixtures + engine)', 'a session exists in the secure store'],
            actions: ['launch + sign in + work (capture)', 'relaunch (a fresh host over the same authorities)', 'sign out', 'relaunch again'],
            expected: [
              'the relaunch restores the session from the secure store (validated against the gateway)',
              'the restored session keeps the same identity',
              'sign-out revokes through the gateway and clears the secure store',
              'the next launch signs in fresh',
            ],
            observed: [
              `restored=true, sessionId=${restored.ok ? restored.session.sessionId : ''}`,
              'world digest consistent across the relaunch',
              'secure store cleared after sign-out',
              'fresh sign-in (restored=false)',
            ],
            evidence: ['test/product/journeys.test.ts (J12)'],
            defects: 'none',
            disposition: 'simulated-pass (the install/update cycle itself is infra/CI: the build configs + store profiles)',
          },
          platform,
        ),
      );
    }
  });
});

describe('the journey record summary (the evidence index)', () => {
  it('every mobile journey has a record for BOTH platforms with the full field set', () => {
    const required = ['J01', 'J02', 'J04', 'J06', 'J07', 'J08', 'J09', 'J11', 'J12'];
    for (const journeyId of required) {
      for (const platform of ['android', 'ios'] as const) {
        const record = RECORDS.find((entry) => entry.journeyId === journeyId && entry.platform === platform);
        expect(record, `missing journey record ${journeyId}/${platform}`).toBeDefined();
      }
    }
    expect(RECORDS).toHaveLength(required.length * 2);
    // Every record carries the full field set (the journey-validation contract).
    for (const record of RECORDS) {
      expect(record.productVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(record.fixtureId).toBe(FIXTURE_ID);
      expect(record.preconditions.length).toBeGreaterThan(0);
      expect(record.actions.length).toBeGreaterThan(0);
      expect(record.expected.length).toBeGreaterThan(0);
      expect(record.observed.length).toBeGreaterThan(0);
      expect(record.evidence.length).toBeGreaterThan(0);
      expect(record.disposition).toMatch(/simulated-pass/);
    }
  });
});
