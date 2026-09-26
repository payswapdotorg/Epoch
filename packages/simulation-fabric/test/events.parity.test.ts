// W010 event-log parity (runtime): the mirrored simulation event shapes
// are admitted by the REAL @epoch/event-log seal path, digest identically
// to the REAL computeEventDigest, append into a REAL EventLog end-to-end,
// and the mirrored grammars/versions are pattern-identical. devDependency
// only — no runtime coupling (the W036 delivery-event mirror precedent).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  sealEvent,
  EventLog,
} from '@epoch/event-log';
import type { EventContent } from '@epoch/event-log';
import {
  ReferenceSimulationExecutionPort,
  SIMULATION_EVENT_RECORD_VERSION,
  SIMULATION_PRINCIPAL_ID_PATTERN,
  SIMULATION_STREAM_ID_PATTERN,
  SimulationFabric,
  computeSimulationEventDigest,
  sealSimulationEvent,
  simulationStreamIdOf,
} from '../src/index';
import {
  ACTOR,
  TENANT,
  T1,
  T2,
  T3,
  eventContentOf,
  referenceSubmission,
  unwrap,
} from './fixtures';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored simulation stream pattern is exactly the W010 stream pattern', () => {
    expect(SIMULATION_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(SIMULATION_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(SIMULATION_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(SIMULATION_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(SIMULATION_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('a fabric event is admitted by the REAL W010 seal path and digests identically', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const [sealed] = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    // The sealed record re-seals through the REAL W010 pipeline with the
    // same digest (the content is the envelope minus the digest).
    const content = eventContentOf(sealed as unknown as Record<string, unknown>);
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(sealed.contentDigest).toBe(theirs.value.digest);
    expect(computeSimulationEventDigest(content as never)).toBe(
      computeEventDigest(content as unknown as EventContent),
    );
  });

  it('sealSimulationEvent and the REAL sealEvent agree on freshly built content', () => {
    const content = {
      schemaVersion: SIMULATION_EVENT_RECORD_VERSION,
      streamId: 'stream:simulation-abcdef0123456789',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: {
        discriminator: 'simulation:run-submitted',
        data: {
          runId: 'simrun:abcdef0123456789',
          runDigest: 'a'.repeat(64),
          requestId: 'simreq-0001',
          requestDigest: 'b'.repeat(64),
          simulatorId: 'simulator:reference-affine-scalar',
          registrationDigest: 'c'.repeat(64),
          idempotencyKey: 'd'.repeat(64),
          submittedAt: T1,
        },
      },
      occurredAt: T1,
    };
    const ours = sealSimulationEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
  });

  it('the full fabric event stream of one run appends into a REAL EventLog end-to-end', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    const events = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events).toHaveLength(5);

    const log = new EventLog({ expectedTenantId: TENANT });
    for (const sealed of events) {
      const appended = log.appendEvent({
        event: eventContentOf(sealed as unknown as Record<string, unknown>) as unknown as EventContent,
        digest: sealed.contentDigest,
      });
      if (!appended.ok) {
        throw new Error(`fabric event must append into the real log: ${appended.error.message}`);
      }
    }
    const readBack = log.readStream(simulationStreamIdOf(run.runId));
    expect(readBack.ok).toBe(true);
    if (!readBack.ok) return;
    expect(readBack.value).toHaveLength(5);
    expect(readBack.value.map((record) => record.contentDigest)).toEqual(
      events.map((event) => event.contentDigest),
    );
    expect(log.streamCount).toBe(1);
  });

  it('the W010 log rejects a tampered fabric event (tamper detection parity)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const [sealed] = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    const content = eventContentOf(sealed as unknown as Record<string, unknown>);
    const log = new EventLog();
    const appended = log.appendEvent({
      event: content as unknown as EventContent,
      digest: '0'.repeat(64),
    });
    expect(appended.ok).toBe(false);
    if (!appended.ok) {
      expect(appended.error.code).toBe('digest-mismatch');
    }
  });
});
