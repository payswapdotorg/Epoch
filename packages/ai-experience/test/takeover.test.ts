// Takeover/release transitions with provenance + typed denials with
// recorded provenance + preemption, handover, and re-assertion semantics.
import { describe, expect, it } from 'vitest';
import { admitIntent, projectCollaboration, type AiCollaborationEvent } from '../src/index';
import {
  AGENT_PEER,
  INSPECTOR,
  LEAD,
  SESSION,
  TENANT,
  T2,
  T3,
  expectFailure,
  joinedEvents,
  validSession,
} from './helpers';

function takeoverEnvelope(actor: string, authority: unknown, sequence = 20) {
  return {
    sessionId: SESSION,
    tenantId: TENANT,
    actor,
    occurredAt: T2,
    sequence,
    intent: { kind: 'take-control', intentVersion: 1, authority },
  };
}

describe('take-control (authorized transitions)', () => {
  it('admits a role-grant takeover with full provenance', () => {
    const result = admitIntent(takeoverEnvelope(LEAD, { kind: 'role-grant' }), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.taken');
    expect(emitted.provenance).toEqual({
      actor: LEAD,
      occurredAt: T2,
      authority: { kind: 'role-grant' },
    });
    expect(emitted.supersededController).toBeUndefined();
  });

  it('admits a session-owner takeover (the opening principal)', () => {
    const result = admitIntent(takeoverEnvelope(LEAD, { kind: 'session-owner' }), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as AiCollaborationEvent).kind).toBe('control.taken');
  });

  it('admits an explicit handover from the current controller and records the superseded controller', () => {
    const result = admitIntent(
      takeoverEnvelope(AGENT_PEER, { kind: 'explicit-handover', from: LEAD }),
      { session: validSession(), control: { controller: LEAD } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.taken');
    expect(emitted.provenance?.authority).toEqual({
      kind: 'explicit-handover',
      from: LEAD,
    });
    expect(emitted.supersededController).toBe(LEAD);
  });

  it('admits a preempting takeover by a granted peer (the takeover semantic)', () => {
    const result = admitIntent(takeoverEnvelope(AGENT_PEER, { kind: 'role-grant' }), {
      session: validSession(),
      control: { controller: LEAD },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.taken');
    expect(emitted.supersededController).toBe(LEAD);
  });

  it('admits a control re-assertion by the current controller', () => {
    const result = admitIntent(takeoverEnvelope(LEAD, { kind: 'role-grant' }), {
      session: validSession(),
      control: { controller: LEAD },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.taken');
    expect(emitted.supersededController).toBe(LEAD);
  });
});

describe('take-control (typed denials — provenance recorded)', () => {
  it('denies a takeover by a principal whose role lacks control authority', () => {
    const result = admitIntent(takeoverEnvelope(INSPECTOR, { kind: 'role-grant' }), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.denied');
    expect(emitted.rejection).toEqual({
      actor: INSPECTOR,
      occurredAt: T2,
      claimedAuthority: { kind: 'role-grant' },
      reason: 'actor-lacks-control-authority',
    });
  });

  it('denies a claimed session-owner authority by a non-opener', () => {
    const result = admitIntent(takeoverEnvelope(AGENT_PEER, { kind: 'session-owner' }), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.denied');
    expect(emitted.rejection?.reason).toBe('claimed-authority-invalid');
    expect(emitted.rejection?.claimedAuthority).toEqual({ kind: 'session-owner' });
  });

  it('denies a handover claimed from a principal that is not the controller', () => {
    const result = admitIntent(
      takeoverEnvelope(AGENT_PEER, { kind: 'explicit-handover', from: INSPECTOR }),
      { session: validSession(), control: { controller: LEAD } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as AiCollaborationEvent).rejection?.reason).toBe(
      'claimed-authority-invalid',
    );
  });

  it('denies a handover claim when nobody holds control', () => {
    const result = admitIntent(
      takeoverEnvelope(AGENT_PEER, { kind: 'explicit-handover', from: LEAD }),
      { session: validSession(), control: { controller: undefined } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as AiCollaborationEvent).rejection?.reason).toBe(
      'claimed-authority-invalid',
    );
  });

  it('the denial itself is history: the fold records it with its provenance', () => {
    const denied = admitIntent(takeoverEnvelope(INSPECTOR, { kind: 'role-grant' }), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(denied.ok).toBe(true);
    if (!denied.ok) return;
    const taken = admitIntent(takeoverEnvelope(LEAD, { kind: 'role-grant' }, 21), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      denied.value,
      taken.value,
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.controller).toBe(LEAD);
    expect(projection.value.controlDenials).toHaveLength(1);
    expect(projection.value.controlDenials[0]).toEqual({
      actor: INSPECTOR,
      occurredAt: T2,
      claimedAuthority: { kind: 'role-grant' },
      reason: 'actor-lacks-control-authority',
    });
  });
});

describe('release-control', () => {
  function releaseEnvelope(actor: string, sequence = 22) {
    return {
      sessionId: SESSION,
      tenantId: TENANT,
      actor,
      occurredAt: T3,
      sequence,
      intent: { kind: 'release-control', intentVersion: 1 },
    };
  }

  it('admits a release by the current controller with provenance', () => {
    const result = admitIntent(releaseEnvelope(LEAD), {
      session: validSession(),
      control: { controller: LEAD },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.released');
    expect(emitted.provenance?.actor).toBe(LEAD);
  });

  it('denies a release by a non-controller (typed rejection with provenance)', () => {
    const result = admitIntent(releaseEnvelope(AGENT_PEER), {
      session: validSession(),
      control: { controller: LEAD },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.denied');
    expect(emitted.rejection?.reason).toBe('actor-not-controller');
    expect(emitted.rejection?.actor).toBe(AGENT_PEER);
  });

  it('denies a release when nobody holds control', () => {
    const result = admitIntent(releaseEnvelope(LEAD), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as AiCollaborationEvent).kind).toBe('control.denied');
  });

  it('denies a release by a principal whose role lacks release authority', () => {
    const result = admitIntent(releaseEnvelope(INSPECTOR), {
      session: validSession(),
      control: { controller: INSPECTOR },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    expect(emitted.kind).toBe('control.denied');
    expect(emitted.rejection?.reason).toBe('actor-lacks-control-authority');
  });
});

describe('control projection semantics', () => {
  it('the fold applies taken/released facts and clears the controller', () => {
    const taken = admitIntent(takeoverEnvelope(LEAD, { kind: 'role-grant' }, 20), {
      session: validSession(),
      control: { controller: undefined },
    });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const release = admitIntent(
      { sessionId: SESSION, tenantId: TENANT, actor: LEAD, occurredAt: T3, sequence: 21, intent: { kind: 'release-control', intentVersion: 1 } },
      { session: validSession(), control: { controller: LEAD } },
    );
    expect(release.ok).toBe(true);
    if (!release.ok) return;
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      taken.value,
      release.value,
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.controller).toBeUndefined();
  });

  it('the fold rejects a member-inconsistent takeover (missing provenance)', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 20,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        kind: 'control.taken',
      },
    ]);
    expectFailure(projection, 'validation');
  });
});
