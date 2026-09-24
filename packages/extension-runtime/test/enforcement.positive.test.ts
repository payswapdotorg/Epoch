// Positive enforcement tests: permitted host-call flows for every host
// function through the session pipeline (identity, grants, scopes,
// payload contract, dispatch, response contract, audit).
import { describe, expect, it } from 'vitest';
import {
  ExtensionSandboxHost,
  fixedClock,
  mapWorldView,
  cannedCapabilityInvoker,
} from '../src/index';
import { manifest, sealed, envelope, stressRegistry } from './helpers';

function buildHostAndSession() {
  const host = new ExtensionSandboxHost({
    registry: stressRegistry(),
    clock: fixedClock('2026-07-01T12:00:00.000Z'),
    worldView: mapWorldView({ 'world:beam-42': { kind: 'beam', loadKn: 42 } }),
    capabilityInvoker: cannedCapabilityInvoker(() => ({
      status: 'completed' as const,
      response: { outputs: { 'max-stress-mpa': 88.5 } },
    })),
  });
  const admitted = host.admitExtension(
    sealed(
      manifest({
        trustClass: 't4',
        grants: [
          {
            capabilityId: 'engineering.stress-analysis',
            hostFunctions: [
              'capability.invoke',
              'clock.read',
              'evidence.append',
              'log.write',
              'storage.read',
              'storage.write',
              'world.read',
            ],
            resourceScopes: [
              { resource: 'capability', access: 'invoke' },
              { resource: 'evidence', access: 'append' },
              { resource: 'storage', access: 'read' },
              { resource: 'storage', access: 'write' },
              { resource: 'world', access: 'read' },
            ],
          },
        ],
      }),
    ),
  );
  if (!admitted.ok) {
    throw new Error(`fixture session failed to admit: ${admitted.error.message}`);
  }
  return { host, session: admitted.value };
}

describe('permitted host-call flows (positive)', () => {
  it('log.write: appends a session log record and acknowledges', () => {
    const { session } = buildHostAndSession();
    const result = session.invoke(envelope());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({ logged: true });
    expect(session.sessionLog()).toEqual([
      { sequence: 1, level: 'info', message: 'computed load case', instant: '2026-07-01T12:00:00.000Z' },
    ]);
  });

  it('clock.read: returns the injected deterministic instant', () => {
    const { session } = buildHostAndSession();
    const result = session.invoke(envelope({ hostFunction: 'clock.read', payload: { instant: true } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({ instant: '2026-07-01T12:00:00.000Z' });
  });

  it('world.read: projects the referenced entities through the injected view', () => {
    const { session } = buildHostAndSession();
    const result = session.invoke(
      envelope({ hostFunction: 'world.read', payload: { entityRefs: ['world:beam-42', 'world:unknown'] } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({
      snapshots: [{ kind: 'beam', loadKn: 42 }, null],
    });
  });

  it('evidence.append: records an attributed evidence statement with a deterministic id', () => {
    const { host, session } = buildHostAndSession();
    const result = session.invoke(
      envelope({
        hostFunction: 'evidence.append',
        payload: { statement: 'load case solved at rated load' },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({ evidenceId: 'evidence-000001' });
    expect(host.evidenceSnapshot()).toEqual([
      {
        evidenceId: 'evidence-000001',
        statement: 'load case solved at rated load',
        attributedExtensionId: 'extension:stress-toolkit',
      },
    ]);
  });

  it('capability.invoke: dispatches through the injected invoker and validates the response', () => {
    const { session } = buildHostAndSession();
    const result = session.invoke(
      envelope({
        hostFunction: 'capability.invoke',
        payload: { capabilityId: 'engineering.stress-analysis', inputs: { 'load-kn': 42 } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({ outputs: { 'max-stress-mpa': 88.5 } });
  });

  it('storage.read/write: round-trips values in the extension-scoped namespace', () => {
    const { session } = buildHostAndSession();
    const write = session.invoke(
      envelope({ hostFunction: 'storage.write', payload: { key: 'cache.last-run', value: { ok: true } } }),
    );
    expect(write.ok).toBe(true);
    const read = session.invoke(
      envelope({ hostFunction: 'storage.read', payload: { key: 'cache.last-run' } }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.outcome.status).toBe('completed');
    if (read.outcome.status !== 'completed') return;
    expect(read.outcome.response).toEqual({ value: { ok: true } });
    expect(session.storageSnapshot()).toEqual({ 'cache.last-run': { ok: true } });
  });

  it('storage.read of an absent key yields null (not an error)', () => {
    const { session } = buildHostAndSession();
    const result = session.invoke(
      envelope({ hostFunction: 'storage.read', payload: { key: 'cache.missing' } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('completed');
    if (result.outcome.status !== 'completed') return;
    expect(result.outcome.response).toEqual({ value: null });
  });
});

describe('audit trail (positive)', () => {
  it('records every permitted call with a deterministic sequence', () => {
    const { session } = buildHostAndSession();
    session.invoke(envelope({ envelopeId: 'inv-a' }));
    session.invoke(envelope({ envelopeId: 'inv-b', hostFunction: 'clock.read', payload: { instant: true } }));
    expect(session.auditTrail()).toEqual([
      { sequence: 1, envelopeId: 'inv-a', capabilityId: 'engineering.stress-analysis', hostFunction: 'log.write', decision: 'permitted' },
      { sequence: 2, envelopeId: 'inv-b', capabilityId: 'engineering.stress-analysis', hostFunction: 'clock.read', decision: 'permitted' },
    ]);
  });

  it('the default capability invoker yields a typed handler-unavailable outcome when none is injected', () => {
    const host = new ExtensionSandboxHost({ registry: stressRegistry() });
    const admitted = host.admitExtension(
      sealed(
        manifest({
          trustClass: 't2',
          grants: [
            {
              capabilityId: 'engineering.stress-analysis',
              hostFunctions: ['capability.invoke', 'log.write'],
              resourceScopes: [{ resource: 'capability', access: 'invoke' }],
            },
          ],
        }),
      ),
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const result = admitted.value.invoke(
      envelope({
        hostFunction: 'capability.invoke',
        payload: { capabilityId: 'engineering.stress-analysis', inputs: {} },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.status).toBe('failed');
    if (result.outcome.status !== 'failed') return;
    expect(result.outcome.code).toBe('handler-unavailable');
  });
});
