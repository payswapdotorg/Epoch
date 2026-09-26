// W017 acceptance: the desktop shell state machine — host-envelope
// dispatch, window lifecycle through envelopes, single-session scoping,
// and the typed unknown-window/unknown-session/malformed rejections.
import { describe, expect, it } from 'vitest';
import {
  KIND_COMPLETE_RENDERER,
  createDesktopShell,
  createReferenceHost,
} from '../src/index';
import {
  PRINCIPAL,
  TENANT_A,
  buildHierarchy,
  compiledExperience,
  expectFailure,
  goldenScenario,
} from './fixtures';

describe('shell session dispatch', () => {
  it('opens a tenant-scoped session through the host envelope and acknowledges it', () => {
    const scenario = goldenScenario({ withMount: false });
    expect(scenario.shell.sessionId).toBe('dss-alpha-1');
    const session = scenario.shell.session;
    expect(session).toBeDefined();
    if (session) {
      expect(session.scope.tenantId).toBe(TENANT_A);
      expect(session.principal).toBe(PRINCIPAL);
      expect(session.state).toBe('active');
      expect(session.windows.size).toBe(1);
    }
    // The first emitted envelope is the session-opened acknowledgement.
    expect(scenario.shellEnvelopes[0].body.kind).toBe('session-opened');
  });

  it('rejects a duplicate session-open (single-session shell)', () => {
    const scenario = goldenScenario({ withMount: false });
    const duplicate = scenario.host.send(
      {
        kind: 'session-open',
        payload: { scope: { tenantId: TENANT_A }, principal: PRINCIPAL },
      },
      90,
    );
    if (!duplicate.ok) {
      throw new Error(duplicate.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(duplicate.value.envelope), 'malformed-record');
  });

  it('rejects a cross-tenant session open at scope resolution (R12)', () => {
    const shell = createDesktopShell({ tenancy: buildHierarchy() });
    const host = createReferenceHost({
      sessionId: 'dss-beta-1',
      scope: { tenantId: TENANT_A, workspaceId: 'workspace:other' }, // workspace of tenant B
      principal: PRINCIPAL,
    });
    const opened = host.send(
      { kind: 'session-open', payload: { scope: { tenantId: TENANT_A, workspaceId: 'workspace:other' }, principal: PRINCIPAL } },
      0,
      'env-host-session-open',
    );
    if (!opened.ok) {
      throw new Error(opened.error.message);
    }
    expectFailure(shell.applyHostEnvelope(opened.value.envelope), 'cross-tenant-denied');
  });

  it('rejects envelopes before any session exists (unknown-session family)', () => {
    const shell = createDesktopShell({ tenancy: buildHierarchy() });
    const host = createReferenceHost({
      sessionId: 'dss-alpha-1',
      scope: { tenantId: TENANT_A },
      principal: PRINCIPAL,
    });
    const windowOpen = host.send(
      { kind: 'window-open', payload: { windowId: 'win-early', title: 'Too early', renderer: KIND_COMPLETE_RENDERER } },
      0,
    );
    if (!windowOpen.ok) {
      throw new Error(windowOpen.error.message);
    }
    const rejected = shell.applyHostEnvelope(windowOpen.value.envelope);
    expectFailure(rejected, 'malformed-record');
    if (!rejected.ok) {
      expect(rejected.error.message).toContain('session-open');
    }
  });
});

describe('shell window dispatch (lifecycle through envelopes)', () => {
  it('opens, focuses, blurs, refocuses, and closes windows through host envelopes', () => {
    const scenario = goldenScenario({ withMount: false });
    const focusEnv = scenario.host.send({ kind: 'window-focus', payload: { windowId: 'win-alpha' } }, 80);
    if (!focusEnv.ok) {
      throw new Error(focusEnv.error.message);
    }
    const focused = scenario.shell.applyHostEnvelope(focusEnv.value.envelope);
    expect(focused.ok).toBe(true);
    if (focused.ok) {
      expect(focused.value.emitted[0].body.kind).toBe('window-focused');
    }
    expect(scenario.shell.session?.windows.get('win-alpha')?.state).toBe('focused');
    const blurEnv = scenario.host.send({ kind: 'window-blur', payload: { windowId: 'win-alpha' } }, 81);
    if (!blurEnv.ok) {
      throw new Error(blurEnv.error.message);
    }
    const blurred = scenario.shell.applyHostEnvelope(blurEnv.value.envelope);
    expect(blurred.ok).toBe(true);
    expect(scenario.shell.session?.windows.get('win-alpha')?.state).toBe('blurred');
    const refocusEnv = scenario.host.send({ kind: 'window-focus', payload: { windowId: 'win-alpha' } }, 82);
    if (!refocusEnv.ok) {
      throw new Error(refocusEnv.error.message);
    }
    expect(scenario.shell.applyHostEnvelope(refocusEnv.value.envelope).ok).toBe(true);
    expect(scenario.shell.session?.windows.get('win-alpha')?.state).toBe('focused');
    const closeEnv = scenario.host.send({ kind: 'window-close', payload: { windowId: 'win-alpha' } }, 83);
    if (!closeEnv.ok) {
      throw new Error(closeEnv.error.message);
    }
    const closed = scenario.shell.applyHostEnvelope(closeEnv.value.envelope);
    expect(closed.ok).toBe(true);
    expect(scenario.shell.session?.windows.get('win-alpha')?.state).toBe('closed');
    // The renderer binding closed with the window.
    expect(scenario.shell.session?.bindings.get('win-alpha')?.state).toBe('closed');
  });

  it('rejects unknown windows with the typed unknown-window', () => {
    const scenario = goldenScenario({ withMount: false });
    const focus = scenario.host.send({ kind: 'window-focus', payload: { windowId: 'win-ghost' } }, 80);
    if (!focus.ok) {
      throw new Error(focus.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(focus.value.envelope), 'unknown-window');
  });

  it('rejects duplicate window ids (malformed-record)', () => {
    const scenario = goldenScenario({ withMount: false });
    const duplicate = scenario.host.send(
      { kind: 'window-open', payload: { windowId: 'win-alpha', title: 'Duplicate', renderer: KIND_COMPLETE_RENDERER } },
      80,
    );
    if (!duplicate.ok) {
      throw new Error(duplicate.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(duplicate.value.envelope), 'malformed-record');
  });

  it('rejects window focus from a non-focusable state (invalid-transition)', () => {
    const scenario = goldenScenario({ withMount: false });
    const close = scenario.host.send({ kind: 'window-close', payload: { windowId: 'win-alpha' } }, 80);
    if (!close.ok) {
      throw new Error(close.error.message);
    }
    expect(scenario.shell.applyHostEnvelope(close.value.envelope).ok).toBe(true);
    const focus = scenario.host.send({ kind: 'window-focus', payload: { windowId: 'win-alpha' } }, 81);
    if (!focus.ok) {
      throw new Error(focus.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(focus.value.envelope), 'invalid-transition');
  });
});

describe('shell experience dispatch', () => {
  it('caches offered experiences (graph + plan) and mounts on request', () => {
    const scenario = goldenScenario(); // includes mount
    const session = scenario.shell.session;
    expect(session?.experiences.size).toBe(1);
    expect(session?.cache.listAddresses()).toContain(scenario.experience.graph.digest);
    expect(session?.cache.listAddresses()).toContain(scenario.experience.plan.digest);
    const binding = session?.bindings.get('win-alpha');
    expect(binding?.mountedStateDigest).toBe(scenario.experience.graph.digest);
    expect(binding?.invocationCount).toBe(3); // mount + frame + intent
    expect(session?.receipts).toHaveLength(3);
    // The host ledger recorded the receipt evidence.
    expect(scenario.host.ledger.filter((entry) => entry.kind === 'receipt')).toHaveLength(3);
  });

  it('rejects a mount of an unknown experience (cache-violation)', () => {
    const scenario = goldenScenario({ withMount: false });
    const mount = scenario.host.send(
      { kind: 'mount-request', payload: { windowId: 'win-alpha', graphDigest: 'c'.repeat(64), planDigest: 'd'.repeat(64) } },
      80,
    );
    if (!mount.ok) {
      throw new Error(mount.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(mount.value.envelope), 'cache-violation');
  });

  it('rejects a mount naming a mismatched plan digest (digest-mismatch)', () => {
    const scenario = goldenScenario({ withMount: false });
    const mount = scenario.host.send(
      {
        kind: 'mount-request',
        payload: {
          windowId: 'win-alpha',
          graphDigest: scenario.experience.graph.digest,
          planDigest: 'e'.repeat(64),
        },
      },
      80,
    );
    if (!mount.ok) {
      throw new Error(mount.error.message);
    }
    expectFailure(scenario.shell.applyHostEnvelope(mount.value.envelope), 'digest-mismatch');
  });

  it('invalidates cached addresses through host envelopes', () => {
    const scenario = goldenScenario();
    const invalidation = scenario.host.send(
      { kind: 'cache-invalidation', payload: { address: scenario.experience.plan.digest, reason: 'host-invalidated' } },
      80,
    );
    if (!invalidation.ok) {
      throw new Error(invalidation.error.message);
    }
    expect(scenario.shell.applyHostEnvelope(invalidation.value.envelope).ok).toBe(true);
    expect(scenario.shell.session?.cache.listEntries().find((entry) => entry.address === scenario.experience.plan.digest)?.freshness.fresh).toBe(false);
  });

  it('surfaces W013 denials as typed invocation-rejected with the verbatim cause', () => {
    const scenario = goldenScenario({ withMount: false });
    const experience = compiledExperience('2d');
    const offer = scenario.host.send(
      { kind: 'experience-offer', payload: { graph: experience.graph, plan: experience.plan } },
      21,
    );
    if (!offer.ok) {
      throw new Error(offer.error.message);
    }
    expect(scenario.shell.applyHostEnvelope(offer.value.envelope).ok).toBe(true);
    // A non-monotonic frame before any mount: frame 0 is illegal (must
    // be strictly increasing from -1), so frame 0 IS the first legal.
    const frame = scenario.host.send({ kind: 'frame-request', payload: { windowId: 'win-alpha', frameIndex: 5 } }, 30);
    if (!frame.ok) {
      throw new Error(frame.error.message);
    }
    expect(scenario.shell.applyHostEnvelope(frame.value.envelope).ok).toBe(true);
    const regression = scenario.host.send({ kind: 'frame-request', payload: { windowId: 'win-alpha', frameIndex: 5 } }, 31);
    if (!regression.ok) {
      throw new Error(regression.error.message);
    }
    const rejected = scenario.shell.applyHostEnvelope(regression.value.envelope);
    expectFailure(rejected, 'invocation-rejected');
    if (!rejected.ok && rejected.error.code === 'invocation-rejected') {
      expect(rejected.error.cause.code).toBe('invalid-invocation');
    }
  });
});

describe('shell authoring dispatch', () => {
  it('projects authoring requests as typed proposals toward the host', () => {
    const scenario = goldenScenario();
    const proposals = scenario.host.ledger.filter((entry) => entry.kind === 'proposal');
    expect(proposals).toHaveLength(1);
    // The emitted envelope carries the sealed proposal.
    const emitted = scenario.shellEnvelopes.find(
      (envelope) => envelope.body.kind === 'authoring-proposal',
    );
    expect(emitted).toBeDefined();
    if (emitted && emitted.body.kind === 'authoring-proposal') {
      const proposal = emitted.body.payload.proposal as { status?: string; digest?: string };
      expect(proposal.status).toBe('proposed');
      expect(proposal.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(proposals[0].digest).toBe(proposal.digest);
    }
  });
});

describe('shell snapshot dispatch', () => {
  it('reports snapshots through the seam and the host ledger records them', () => {
    const scenario = goldenScenario({ withMount: false });
    // Drive one snapshot request and capture the outcome's snapshot (the
    // snapshot is taken at capture time; the report envelope is emitted
    // after, so the channel head inside the snapshot precedes the report).
    const request = scenario.host.send({ kind: 'snapshot-request', payload: {} }, 70);
    expect(request.ok).toBe(true);
    if (!request.ok) {
      throw new Error(request.error.message);
    }
    const outcome = scenario.shell.applyHostEnvelope(request.value.envelope);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }
    const snapshot = outcome.value.snapshot;
    expect(snapshot).toBeDefined();
    const emitted = outcome.value.emitted.find(
      (envelope) => envelope.body.kind === 'session-snapshot',
    );
    expect(emitted).toBeDefined();
    if (snapshot && emitted && emitted.body.kind === 'session-snapshot') {
      expect(emitted.body.payload.snapshotDigest).toBe(snapshot.digest);
      // The host ledger records the same digest once delivered.
      const ledgerBefore = scenario.host.ledger.filter((entry) => entry.kind === 'snapshot').length;
      const received = scenario.host.receive(emitted);
      expect(received.ok).toBe(true);
      const ledgerAfter = scenario.host.ledger.filter((entry) => entry.kind === 'snapshot').length;
      expect(ledgerAfter).toBe(ledgerBefore + 1);
      expect(
        scenario.host.ledger.filter((entry) => entry.kind === 'snapshot')[ledgerAfter - 1].digest,
      ).toBe(snapshot.digest);
    }
  });
});
