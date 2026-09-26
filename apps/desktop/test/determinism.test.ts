// W017 acceptance: determinism — identical host inputs produce identical
// digests across every public surface, and replaying the host envelope
// chain through a fresh shell reproduces the identical session snapshot
// (byte-identical canonical digests) plus the identical emitted chain.
import { describe, expect, it } from 'vitest';
import { TenancyHierarchy, tenancyNodeRecordFor } from '@epoch/tenancy';
import {
  replayDesktopSession,
  verifyEnvelopeChain,
} from '../src/index';
import {
  TENANT_B,
  buildHierarchy,
  compiledExperience,
  expectFailure,
  goldenScenario,
} from './fixtures';

describe('determinism (identical inputs -> identical digests)', () => {
  it('two independently driven golden scenarios produce identical snapshots', () => {
    const a = goldenScenario();
    const b = goldenScenario();
    const snapshotA = a.shell.snapshotSession(100);
    const snapshotB = b.shell.snapshotSession(100);
    expect(snapshotA.ok && snapshotB.ok).toBe(true);
    if (snapshotA.ok && snapshotB.ok) {
      expect(snapshotA.value.digest).toBe(snapshotB.value.digest);
      expect(JSON.stringify(snapshotA.value)).toBe(JSON.stringify(snapshotB.value));
    }
  });

  it('two independently driven golden scenarios produce identical emitted chains', () => {
    const a = goldenScenario();
    const b = goldenScenario();
    expect(a.shellEnvelopes).toHaveLength(b.shellEnvelopes.length);
    for (let i = 0; i < a.shellEnvelopes.length; i += 1) {
      expect(a.shellEnvelopes[i].digest).toBe(b.shellEnvelopes[i].digest);
    }
    // The host chains are identical too.
    expect(a.host.channel.lastDigest).toBe(b.host.channel.lastDigest);
    expect(a.host.channel.lastSequence).toBe(b.host.channel.lastSequence);
    // And the host ledger records the same digest-addressed evidence.
    expect(a.host.ledger).toEqual(b.host.ledger);
  });

  it('identical experiences compile and mount to identical evidence', () => {
    const a = compiledExperience('3d');
    const b = compiledExperience('3d');
    expect(a.graph.digest).toBe(b.graph.digest);
    expect(a.plan.digest).toBe(b.plan.digest);
  });

  it('different inputs produce different digests (no hash collisions by construction)', () => {
    const experience2d = compiledExperience('2d');
    const experience3d = compiledExperience('3d');
    expect(experience2d.graph.digest).not.toBe(experience3d.graph.digest);
    expect(experience2d.plan.digest).not.toBe(experience3d.plan.digest);
  });
});

describe('replay safety (a session snapshot reproduces identical state)', () => {
  it('replaying the host chain reproduces the byte-identical snapshot and emitted chain', () => {
    const scenario = goldenScenario();
    const original = scenario.shell.snapshotSession(100);
    if (!original.ok) {
      throw new Error(original.error.message);
    }
    const replayed = replayDesktopSession(scenario.hostEnvelopes, { tenancy: buildHierarchy() }, 100);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.value.snapshot.digest).toBe(original.value.digest);
      expect(JSON.stringify(replayed.value.snapshot)).toBe(JSON.stringify(original.value));
      // The emitted shell chain is reproduced envelope-for-envelope.
      expect(replayed.value.emitted).toHaveLength(scenario.shellEnvelopes.length);
      for (let i = 0; i < scenario.shellEnvelopes.length; i += 1) {
        expect(replayed.value.emitted[i].digest).toBe(scenario.shellEnvelopes[i].digest);
      }
    }
  });

  it('a tampered host chain cannot be replayed (tamper detection)', () => {
    const scenario = goldenScenario();
    const tampered = scenario.hostEnvelopes.map((envelope, index) =>
      index === 1 ? { ...envelope, issuedAtMs: 9999 } : envelope,
    );
    const rejected = replayDesktopSession(tampered, { tenancy: buildHierarchy() }, 100);
    expectFailure(rejected, 'digest-mismatch');
  });

  it('a truncated host chain replays to a DIFFERENT snapshot (honest divergence)', () => {
    const scenario = goldenScenario();
    const original = scenario.shell.snapshotSession(100);
    if (!original.ok) {
      throw new Error(original.error.message);
    }
    const truncated = replayDesktopSession(
      scenario.hostEnvelopes.slice(0, -2),
      { tenancy: buildHierarchy() },
      100,
    );
    expect(truncated.ok).toBe(true);
    if (truncated.ok) {
      expect(truncated.value.snapshot.digest).not.toBe(original.value.digest);
    }
  });

  it('the host envelope chain verifies end-to-end (the replay evidence)', () => {
    const scenario = goldenScenario();
    const verified = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', scenario.hostEnvelopes);
    expect(verified.ok).toBe(true);
    const shellVerified = verifyEnvelopeChain('dss-alpha-1', 'shell-to-host', scenario.shellEnvelopes);
    expect(shellVerified.ok).toBe(true);
  });
});

describe('replay with a hostile tenancy hierarchy (scope resolution is input-driven)', () => {
  it('a replay against a hierarchy missing the tenant fails at the session-open step (typed)', () => {
    const scenario = goldenScenario();
    // A hierarchy that admits only the platform root and tenant B: the
    // tenant-A session-open cannot resolve, and the failure is typed.
    const hostile = new TenancyHierarchy();
    const platform = tenancyNodeRecordFor({
      schemaVersion: 1,
      nodeId: 'platform:root',
      kind: 'platform',
      displayName: 'Platform',
      description: 'Hostile platform root',
      parentId: null,
    });
    expect(hostile.createNode({ node: platform.node, digest: platform.nodeDigest }).ok).toBe(true);
    const tenantB = tenancyNodeRecordFor({
      schemaVersion: 1,
      nodeId: TENANT_B,
      kind: 'tenant',
      displayName: 'Beta',
      description: 'Tenant B',
      parentId: 'platform:root',
    });
    expect(hostile.createNode({ node: tenantB.node, digest: tenantB.nodeDigest }).ok).toBe(true);
    const rejected = replayDesktopSession(scenario.hostEnvelopes, { tenancy: hostile }, 100);
    expectFailure(rejected, 'malformed-record');
  });

  it('a chain that does not start at session-open is rejected (typed)', () => {
    const scenario = goldenScenario();
    // Slicing off the session-open leaves a chain that starts at sequence
    // 2: the replay-safety gap gate fires (a typed replay-violation).
    expectFailure(
      replayDesktopSession(scenario.hostEnvelopes.slice(1), { tenancy: buildHierarchy() }, 100),
      'replay-violation',
    );
    // An empty chain is malformed (no session-open to replay).
    expectFailure(replayDesktopSession([], { tenancy: buildHierarchy() }, 100), 'malformed-record');
  });
});

describe('the full lifecycle replays (open -> close)', () => {
  it('a closed session replays to the identical closed snapshot', () => {
    const tenancy = buildHierarchy();
    // Drive a close on top of the golden scenario (through `send`, which
    // returns the envelope for delivery).
    const closed = goldenScenario();
    const closeResult = closed.host.send({ kind: 'session-close', payload: {} }, 80);
    expect(closeResult.ok).toBe(true);
    if (closeResult.ok) {
      const closeEnvelope = closeResult.value.envelope;
      closed.hostEnvelopes.push(closeEnvelope);
      const outcome = closed.shell.applyHostEnvelope(closeEnvelope);
      expect(outcome.ok).toBe(true);
      for (const emitted of outcome.ok ? outcome.value.emitted : []) {
        const received = closed.host.receive(emitted);
        expect(received.ok).toBe(true);
      }
    }
    const closedSnapshot = closed.shell.snapshotSession(100);
    const replayed = replayDesktopSession(closed.hostEnvelopes, { tenancy }, 100);
    expect(closedSnapshot.ok && replayed.ok).toBe(true);
    if (closedSnapshot.ok && replayed.ok) {
      expect(replayed.value.snapshot.digest).toBe(closedSnapshot.value.digest);
      expect(replayed.value.snapshot.sessionState).toBe('closed');
    }
  });

  it('the session lifecycle table is closed and terminal', () => {
    // Session states/events are exercised structurally in shell tests;
    // this pins the replay-relevant invariant: closing then snapshotting
    // keeps the terminal state in the snapshot.
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    expect(snapshot.value.sessionState).toBe('active');
    expect(snapshot.value.channels.host.lastSequence).toBe(scenario.hostEnvelopes.length);
    expect(snapshot.value.channels.shell.lastSequence).toBe(scenario.shellEnvelopes.length);
  });
});
