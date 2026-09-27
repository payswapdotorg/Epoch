// Negative evidence (acceptance: typed rejections for every failure class).
import { describe, expect, it } from 'vitest';
import {
  FmiAdapterHost,
  conflictingParticipant,
  malformedParticipant,
  outputlessParticipant,
  referenceParticipant,
  verifyStep,
} from '../src/index';
import { REFERENCE_PARTICIPANT_ID, REFERENCE_INPUTS, TENANT_A, TENANT_B, adapterSetup, pinFor, registryWithAdapter } from './helpers';

describe('negative: tenant isolation (R12)', () => {
  it('participant admission naming another tenant is the typed tenant-isolation-rejected', () => {
    const host = new FmiAdapterHost({ expectedTenantId: TENANT_A });
    const result = host.admitParticipant({ tenantId: TENANT_B, payload: referenceParticipant() });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant step is the typed tenant-isolation-rejected', () => {
    const { host } = adapterSetup();
    const result = host.step({
      tenantId: TENANT_B,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant participant read is the typed tenant-isolation-rejected', () => {
    const host = new FmiAdapterHost({ expectedTenantId: TENANT_A });
    host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    const cross = host.participant(TENANT_B, REFERENCE_PARTICIPANT_ID);
    expect(cross.ok).toBe(false);
    if (cross.ok || cross.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant invocation through the W007 envelope is the typed tenant-isolation-rejected', () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const result = adapter.invokeTotal({
      schemaVersion: 1,
      category: 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_B,
          participant: REFERENCE_PARTICIPANT_ID,
          values: { ...REFERENCE_INPUTS },
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });
});

describe('negative: unknown provider payloads', () => {
  it('a malformed descriptor is the typed unknown-provider-payload (never a partial load)', () => {
    const host = new FmiAdapterHost();
    const result = host.admitParticipant({ tenantId: TENANT_A, payload: malformedParticipant() });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('a descriptor without outputs is the typed unknown-provider-payload', () => {
    const host = new FmiAdapterHost();
    const result = host.admitParticipant({ tenantId: TENANT_A, payload: outputlessParticipant() });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
  });
});

describe('negative: tamper detection', () => {
  it('a claimed descriptor digest that does not match the content is the typed digest-mismatch', () => {
    const host = new FmiAdapterHost();
    const result = host.admitParticipant({
      tenantId: TENANT_A,
      payload: referenceParticipant(),
      claimedDigest: '0'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
  });

  it('a tampered step exchange is detected by digest verification', () => {
    const { host } = adapterSetup();
    const step = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    if (!step.ok) throw new Error(step.error.message);
    const tampered = { ...step.value, outputs: { ...step.value.outputs, position: 99 } };
    expect(verifyStep(tampered)).toBe(false);
  });
});

describe('negative: replay conflicts', () => {
  it('different content under the same participant key is the typed replay-conflict', () => {
    const host = new FmiAdapterHost();
    const first = host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
    expect(first.ok).toBe(true);
    const conflict = host.admitParticipant({ tenantId: TENANT_A, payload: conflictingParticipant() });
    expect(conflict.ok).toBe(false);
    if (conflict.ok || conflict.error.code !== 'replay-conflict') throw new Error('unexpected outcome');
  });

  it('different inputs under the same step key is the typed replay-conflict', () => {
    const { host } = adapterSetup();
    const first = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS },
    });
    expect(first.ok).toBe(true);
    const conflict = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      stepNumber: 0,
      values: { 'drive-input': 5 },
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok || conflict.error.code !== 'replay-conflict') throw new Error('unexpected outcome');
  });
});

describe('negative: port conformance', () => {
  it('missing input-port values are the typed port-conformance-rejected', () => {
    const { host } = adapterSetup();
    const result = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'port-conformance-rejected') throw new Error('unexpected outcome');
    expect(result.error.issues[0]?.path).toBe('$.values.drive-input');
  });

  it('values naming no declared port are the typed port-conformance-rejected', () => {
    const { host } = adapterSetup();
    const result = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { ...REFERENCE_INPUTS, 'not-a-port': 1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'port-conformance-rejected') throw new Error('unexpected outcome');
  });

  it('non-numeric port values are the typed port-conformance-rejected', () => {
    const { host } = adapterSetup();
    const result = host.step({
      tenantId: TENANT_A,
      participantId: REFERENCE_PARTICIPANT_ID,
      values: { 'drive-input': 'not-a-number' },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'port-conformance-rejected') throw new Error('unexpected outcome');
  });

  it('through the W007 envelope, nonconformance maps onto the W005 input-out-of-domain failure', async () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const response = await adapter.invoke({
      schemaVersion: 1,
      category: 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: REFERENCE_PARTICIPANT_ID,
          values: {},
        },
      },
    });
    expect(response.payload.status).toBe('failed');
    if (response.payload.status !== 'failed') throw new Error('unreachable');
    expect(response.payload.failure.code).toBe('input-out-of-domain');
  });
});

describe('negative: binding conflicts', () => {
  it('an envelope bound to another adapter revision is the typed binding-conflict', () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const result = adapter.invokeTotal({
      schemaVersion: 1,
      category: 'simulation',
      binding: { ...pin, adapterDescriptorDigest: 'f'.repeat(64) },
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: REFERENCE_PARTICIPANT_ID,
          values: { ...REFERENCE_INPUTS },
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });

  it('an envelope targeting the wrong category is the typed binding-conflict', () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const result = adapter.invokeTotal({
      schemaVersion: 1,
      category: 'source' as 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: REFERENCE_PARTICIPANT_ID,
          values: { ...REFERENCE_INPUTS },
        },
      },
    } as unknown as Parameters<typeof adapter.invokeTotal>[0]);
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });
});

describe('negative: envelope validation', () => {
  it('malformed neutral inputs are the typed validation error with precise paths', () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const result = adapter.invokeTotal({
      schemaVersion: 1,
      category: 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: 'not-a-participant-id',
          values: { ...REFERENCE_INPUTS },
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
  });

  it('an unknown participant is the typed validation error (no silent empty step)', () => {
    const { adapter } = adapterSetup();
    const pin = pinFor(adapter, registryWithAdapter());
    const result = adapter.invokeTotal({
      schemaVersion: 1,
      category: 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: 'participant:never-admitted',
          values: { 'drive-input': 1 },
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
  });
});
