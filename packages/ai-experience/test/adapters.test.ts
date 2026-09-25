// W010 substrate adapters: event-log emission/adaptation round-trips
// through the REAL event log, mirrored collaboration journal adaptation
// with shape parity against @epoch/collaboration (devDependency), digest
// tamper detection, and the closed adapter vocabulary.
import { describe, expect, it } from 'vitest';
import {
  EventLog,
  sealEvent,
  type EventRegistration,
} from '@epoch/event-log';
import {
  CollaborationEventRecordSchema,
  CollaborationEventSchema,
  type CollaborationEvent,
} from '@epoch/collaboration';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  buildEventLogContent,
  eventLogDiscriminatorOf,
  fromCollaborationEventRecord,
  fromEventLogRecord,
  toEventLogPayload,
  type AiCollaborationEvent,
} from '../src/index';
import {
  AGENT_PEER,
  INSPECTOR,
  LEAD,
  SESSION,
  STREAM,
  TENANT,
  T1,
  T2,
  event,
  expectFailure,
  validSession,
} from './helpers';

describe('event-log emission/adaptation (the substrate seam)', () => {
  it('derives ai-namespace discriminators per event kind', () => {
    expect(eventLogDiscriminatorOf('presence.changed')).toBe('ai:presence-changed');
    expect(eventLogDiscriminatorOf('control.taken')).toBe('ai:control-taken');
    expect(eventLogDiscriminatorOf('moment.captured')).toBe('ai:moment-captured');
    expect(eventLogDiscriminatorOf('session.closed')).toBe('ai:session-closed');
  });

  it('round-trips a typed event through payload -> content -> seal -> log -> read -> adapt', () => {
    const typed = event({
      sequence: 1,
      actor: AGENT_PEER,
      participant: AGENT_PEER,
      presence: 'joining',
    }) as never as AiCollaborationEvent;
    const content = buildEventLogContent(typed, {
      streamId: STREAM,
      sequence: 1,
      causalParent: null,
    });
    expect(content.tenantId).toBe(TENANT);
    expect(content.payload.discriminator).toBe('ai:presence-changed');
    const sealed = sealEvent(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const log = new EventLog({ expectedTenantId: TENANT });
    const appended = log.appendEvent(sealed.value as EventRegistration);
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    const read = log.readStream(STREAM);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toHaveLength(1);
    const adapted = fromEventLogRecord(read.value[0]);
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    expect(adapted.value.kind).toBe('presence.changed');
    expect(adapted.value.sessionId).toBe(SESSION);
    expect(adapted.value.sequence).toBe(1);
    expect(adapted.value.tenantId).toBe(TENANT);
    expect(adapted.value.actor).toBe(AGENT_PEER);
    expect(adapted.value.participant).toBe(AGENT_PEER);
    expect(adapted.value.presence).toBe('joining');
  });

  it('round-trips a full event set through the real event log and projects it', async () => {
    const { projectCollaboration } = await import('../src/index');
    const log = new EventLog({ expectedTenantId: TENANT });
    const typedEvents = [
      event({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      event({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
      event({ sequence: 3, actor: LEAD, participant: LEAD, presence: 'joining' }),
      event({ sequence: 4, actor: LEAD, participant: LEAD, presence: 'present' }),
    ];
    for (let i = 0; i < typedEvents.length; i += 1) {
      const content = buildEventLogContent(typedEvents[i]! as never, {
        streamId: STREAM,
        sequence: i + 1,
        causalParent: i === 0 ? null : { streamId: STREAM, sequence: i },
      });
      const sealed = sealEvent(content);
      expect(sealed.ok).toBe(true);
      if (!sealed.ok) return;
      const appended = log.appendEvent(sealed.value as EventRegistration);
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
    }
    const read = log.readStream(STREAM);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const adapted = read.value.map((record) => fromEventLogRecord(record));
    for (const result of adapted) {
      expect(result.ok).toBe(true);
    }
    const typed = adapted
      .filter((result): result is { ok: true; value: AiCollaborationEvent } => result.ok)
      .map((result) => result.value);
    const projection = projectCollaboration(validSession(), typed);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.presence).toHaveLength(2);
    expect(projection.value.eventCount).toBe(4);
  });

  it('rejects a non-ai event-log record (the adapter owns its namespace)', () => {
    const content = {
      schemaVersion: 1,
      streamId: STREAM,
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:lead-eng',
      causalParent: null,
      payload: { discriminator: 'world:subjects', data: { subjects: [{ kind: 'entity', entityId: 'element:column-c4' }] } },
      occurredAt: T1,
    };
    const sealed = sealEvent(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const adapted = fromEventLogRecord({ event: content, contentDigest: sealed.value.digest });
    expectFailure(adapted, 'validation');
  });

  it('rejects a tampered event-log record (digest-mismatch)', () => {
    const typed = event({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }) as never as AiCollaborationEvent;
    const content = buildEventLogContent(typed, {
      streamId: STREAM,
      sequence: 1,
      causalParent: null,
    });
    const adapted = fromEventLogRecord({
      event: { ...content, occurredAt: T2 },
      contentDigest: canonicalDigest(content as never),
    });
    expectFailure(adapted, 'digest-mismatch');
  });

  it('rejects a hand-crafted payload that smuggles a foreign tenant (cross-tenant-denied)', () => {
    // The emission helper keeps the tenant ONLY in the envelope (the
    // envelope is the scoping authority); a smuggled payload-level tenant
    // field is a typed rejection.
    const content = {
      schemaVersion: 1,
      streamId: STREAM,
      sequence: 1,
      tenantId: TENANT,
      actor: AGENT_PEER,
      causalParent: null,
      payload: {
        discriminator: 'ai:presence-changed',
        data: {
          schemaVersion: 1,
          sessionId: SESSION,
          sequence: 1,
          kind: 'presence.changed',
          participant: AGENT_PEER,
          presence: 'joining',
          tenantId: 'tenant:globex',
        },
      },
      occurredAt: T1,
    };
    const adapted = fromEventLogRecord({
      event: content,
      contentDigest: canonicalDigest(content as never),
    });
    const denial = expectFailure(adapted, 'cross-tenant-denied');
    expect(denial.expectedTenantId).toBe(TENANT);
    expect(denial.encounteredTenantId).toBe('tenant:globex');
  });

  it('toEventLogPayload throws on invalid typed events (producers validate first)', () => {
    expect(() =>
      toEventLogPayload({ kind: 'nonsense' } as never),
    ).toThrow();
  });
});

describe('the mirrored collaboration journal adapter', () => {
  function collaborationEvent(
    overrides: Partial<CollaborationEvent> = {},
  ): Record<string, unknown> {
    const base = {
      schemaVersion: 1,
      sessionId: SESSION,
      sequence: 1,
      tenantId: TENANT,
      actor: LEAD,
      kind: 'participant.joined',
      participant: AGENT_PEER,
      occurredAt: T1,
      ...overrides,
    };
    return { event: base, contentDigest: canonicalDigest(base as never) };
  }

  it('maps participant.joined to a joining presence fact', () => {
    const result = fromCollaborationEventRecord(collaborationEvent());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('presence.changed');
    expect(result.value.participant).toBe(AGENT_PEER);
    expect(result.value.presence).toBe('joining');
    expect(result.value.sequence).toBe(1);
  });

  it('maps participant.presence to a presence fact', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({ kind: 'participant.presence', presence: 'present' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presence).toBe('present');
  });

  it('maps participant.left to the terminal presence fact', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({ kind: 'participant.left' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presence).toBe('left');
  });

  it('maps subject.focused to a focus fact of the acting principal', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({
        kind: 'subject.focused',
        subject: { kind: 'world-entity', entityId: 'element:column-c4' },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('focus.changed');
    expect(result.value.participant).toBe(LEAD);
    expect(result.value.target).toEqual({ kind: 'world-entity', entityId: 'element:column-c4' });
  });

  it('maps subject.released to a focus release', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({ kind: 'subject.released' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('focus.released');
  });

  it('maps session.closed to the terminal close', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({ kind: 'session.closed' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('session.closed');
  });

  it('rejects coordination.note (no AI-collaboration semantic — the adapter vocabulary is closed)', () => {
    const result = fromCollaborationEventRecord(
      collaborationEvent({ kind: 'coordination.note', data: { note: 'hello' } }),
    );
    expectFailure(result, 'validation');
  });

  it('rejects a tampered collaboration record (digest-mismatch)', () => {
    const record = collaborationEvent();
    const tampered = {
      event: { ...(record.event as object), participant: INSPECTOR },
      contentDigest: record.contentDigest as string,
    };
    expectFailure(fromCollaborationEventRecord(tampered), 'digest-mismatch');
  });

  it('rejects malformed collaboration records (validation)', () => {
    expectFailure(fromCollaborationEventRecord({ event: 'nope' }), 'validation');
  });
});

describe('adapter shape parity (devDependency pins)', () => {
  function collaborationEvent(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const base = {
      schemaVersion: 1,
      sessionId: SESSION,
      sequence: 1,
      tenantId: TENANT,
      actor: LEAD,
      kind: 'participant.joined',
      participant: AGENT_PEER,
      occurredAt: T1,
      ...overrides,
    };
    return base;
  }

  it('mirrored and upstream collaboration schemas accept the same records', () => {
    const samples = [
      collaborationEvent(),
      collaborationEvent({ kind: 'participant.presence', presence: 'present' }),
      collaborationEvent({
        kind: 'subject.focused',
        subject: { kind: 'world-entity', entityId: 'element:column-c4' },
      }),
      collaborationEvent({
        kind: 'subject.focused',
        subject: {
          kind: 'action-proposal',
          proposal: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
        },
      }),
      collaborationEvent({ kind: 'coordination.note', data: { note: 'hello' } }),
      collaborationEvent({ kind: 'session.closed' }),
    ];
    for (const sample of samples) {
      const upstream = CollaborationEventSchema.safeParse(sample);
      const digest = canonicalDigest(sample as never);
      const mirrored = CollaborationEventRecordSchema.safeParse({
        event: sample,
        contentDigest: digest,
      });
      expect(upstream.success, `upstream should accept ${JSON.stringify(sample.kind)}`).toBe(
        mirrored.success === true,
      );
    }
  });

  it('mirrored and upstream collaboration schemas reject the same corruptions', () => {
    const corruptions = [
      collaborationEvent({ schemaVersion: 2 }),
      collaborationEvent({ tenantId: 'acme' }),
      collaborationEvent({ kind: 'participant.presence', presence: 'invisible' }),
      collaborationEvent({ participant: 'not-a-principal' }),
      collaborationEvent({ extraVendorField: 'openai' }),
    ];
    for (const sample of corruptions) {
      const upstream = CollaborationEventSchema.safeParse(sample);
      const digest = canonicalDigest(sample as never);
      const mirrored = CollaborationEventRecordSchema.safeParse({
        event: sample,
        contentDigest: digest,
      });
      expect(upstream.success === false).toBe(mirrored.success === false);
    }
  });

  it('record-level parity: upstream CollaborationEventRecordSchema accepts mirrored-adapted envelopes', () => {
    const sample = collaborationEvent();
    const digest = canonicalDigest(sample as never);
    const upstream = CollaborationEventRecordSchema.safeParse({
      event: sample,
      contentDigest: digest,
    });
    expect(upstream.success).toBe(true);
  });
});
