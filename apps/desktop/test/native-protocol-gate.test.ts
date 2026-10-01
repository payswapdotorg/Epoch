// W048 acceptance — THE NAMED NEGATIVE (c): the product REFUSES to open
// incompatible protocol envelope versions.
//
// Every refusal point the gate owns:
//  1. checkUpdateCandidate — an update/sidegrade/rollback candidate whose
//     protocol triple mismatches this build is REFUSED (typed
//     unrecoverable/contract-version-unsupported); the current version
//     keeps running;
//  2. admitPersistedRecord — records restored from durable local state
//     carry their protocol envelope; an incompatible record is REFUSED,
//     never opened, never partially applied (the J12/J11 recovery paths);
//  3. assertRequestProtocol — the bridge never sends envelopes of a
//     foreign gateway contract version;
//  plus the relaunch-view integration (J12): the update check rides the
//  SAME gate the product reports in the view-model.
import { describe, expect, it } from 'vitest';
import {
  admitPersistedRecord,
  assertRequestProtocol,
  checkProtocolCompatibility,
  checkUpdateCandidate,
  protocolRefusalError,
  sealPersistedRecord,
} from '../src/native/runtime/protocol-gate';
import {
  DESKTOP_GATEWAY_CONTRACT_VERSION,
  DESKTOP_HOST_PROTOCOL_VERSION,
  DESKTOP_PRODUCT_VERSION,
  DESKTOP_PROTOCOL_ENVELOPE,
  DESKTOP_RECORD_SCHEMA_VERSION,
} from '../src/native/version';

/** The exact compatible envelope of THIS build. */
function compatibleEnvelope(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    productVersion: DESKTOP_PRODUCT_VERSION,
    protocol: {
      gatewayContract: DESKTOP_GATEWAY_CONTRACT_VERSION,
      hostProtocol: DESKTOP_HOST_PROTOCOL_VERSION,
      recordSchema: DESKTOP_RECORD_SCHEMA_VERSION,
    },
  };
}

describe('the protocol gate (named negative c: incompatible versions are refused)', () => {
  it('accepts exactly THIS build\'s protocol triple', () => {
    expect(checkProtocolCompatibility(compatibleEnvelope())).toBeNull();
    expect(checkProtocolCompatibility(DESKTOP_PROTOCOL_ENVELOPE)).toBeNull();
  });

  it('refuses a foreign GATEWAY CONTRACT version (typed, named reason)', () => {
    const candidate = {
      ...compatibleEnvelope(),
      protocol: { gatewayContract: '2.0.0', hostProtocol: DESKTOP_HOST_PROTOCOL_VERSION, recordSchema: 1 },
    };
    const refusal = checkProtocolCompatibility(candidate);
    expect(refusal).not.toBeNull();
    expect(refusal?.refused).toBe(true);
    expect(refusal?.reason).toBe('gateway-contract-unsupported');
    expect(refusal?.received?.protocol?.gatewayContract).toBe('2.0.0');
    expect(refusal?.expected).toEqual(DESKTOP_PROTOCOL_ENVELOPE);
  });

  it('refuses a foreign HOST PROTOCOL version (typed, named reason)', () => {
    const candidate = {
      ...compatibleEnvelope(),
      protocol: { gatewayContract: DESKTOP_GATEWAY_CONTRACT_VERSION, hostProtocol: '0.9.0', recordSchema: 1 },
    };
    const refusal = checkProtocolCompatibility(candidate);
    expect(refusal?.reason).toBe('host-protocol-unsupported');
  });

  it('refuses a foreign RECORD SCHEMA version (typed, named reason)', () => {
    const candidate = {
      ...compatibleEnvelope(),
      schemaVersion: 2,
      protocol: { gatewayContract: DESKTOP_GATEWAY_CONTRACT_VERSION, hostProtocol: DESKTOP_HOST_PROTOCOL_VERSION, recordSchema: 7 },
    };
    const refusal = checkProtocolCompatibility(candidate);
    expect(refusal?.reason).toBe('record-schema-unsupported');
  });

  it('refuses malformed envelopes (never a coerced open)', () => {
    // Non-objects: the typed envelope-malformed refusal.
    for (const malformed of [null, undefined, 42, 'envelope', []]) {
      const refusal = checkProtocolCompatibility(malformed);
      expect(refusal?.refused).toBe(true);
      expect(refusal?.reason).toBe('envelope-malformed');
      expect(refusal?.received).toBeNull();
    }
    // Structured-but-wrong objects: still REFUSED (fail-closed — an object
    // missing every protocol field is a gateway-contract mismatch).
    for (const malformed of [{ nope: true }, {}]) {
      const refusal = checkProtocolCompatibility(malformed);
      expect(refusal?.refused).toBe(true);
      expect(refusal?.reason).toBe('gateway-contract-unsupported');
    }
  });
});

describe('the update candidate check (refusal point 1)', () => {
  it('accepts a compatible update candidate', () => {
    const outcome = checkUpdateCandidate({
      ...compatibleEnvelope(),
      productVersion: '1.1.0',
      notes: 'a compatible future release',
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.candidate.productVersion).toBe('1.1.0');
    }
  });

  it('REFUSES an incompatible update and keeps the current protocol set', () => {
    const outcome = checkUpdateCandidate({
      schemaVersion: 1,
      productVersion: '2.0.0',
      protocol: { gatewayContract: '2.0.0', hostProtocol: '2.0.0', recordSchema: 2 },
      notes: 'a protocol-breaking release',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refusal.reason).toBe('gateway-contract-unsupported');
      // The typed gateway-error projection of the refusal.
      const error = protocolRefusalError(outcome.refusal);
      expect(error.class).toBe('unrecoverable');
      expect(error.code).toBe('contract-version-unsupported');
      expect(error.message).toContain('incompatible');
    }
  });

  it('refuses a rollback to an older host protocol (sidegrades and rollbacks gate identically)', () => {
    const outcome = checkUpdateCandidate({
      schemaVersion: 1,
      productVersion: '0.9.0',
      protocol: { gatewayContract: '1.0.0', hostProtocol: '0.9.0', recordSchema: 1 },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refusal.reason).toBe('host-protocol-unsupported');
    }
  });
});

describe('the persisted-record admission (refusal point 2)', () => {
  it('seals with THIS build\'s envelope and round-trips verbatim', () => {
    const record = { sessionId: 'session:record-1', tenantId: 'tenant:nordstrand' };
    const sealed = sealPersistedRecord(record);
    expect(sealed.protocol.gatewayContract).toBe(DESKTOP_GATEWAY_CONTRACT_VERSION);
    expect(sealed.protocol.hostProtocol).toBe(DESKTOP_HOST_PROTOCOL_VERSION);
    expect(sealed.protocol.recordSchema).toBe(DESKTOP_RECORD_SCHEMA_VERSION);
    const admitted = admitPersistedRecord<typeof record>(JSON.parse(JSON.stringify(sealed)));
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.record).toEqual(record);
    }
  });

  it('REFUSES a record written by an incompatible build (never opened, never partial)', () => {
    const sealed = sealPersistedRecord({ sessionId: 'session:future' });
    const tampered = {
      ...sealed,
      protocol: { ...sealed.protocol, gatewayContract: '9.9.9' },
    };
    const admitted = admitPersistedRecord(tampered);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.refusal.reason).toBe('gateway-contract-unsupported');
    }
  });

  it('REFUSES a record with a foreign record schema', () => {
    const sealed = sealPersistedRecord({ queue: [] });
    const tampered = { ...sealed, protocol: { ...sealed.protocol, recordSchema: 3 } };
    const admitted = admitPersistedRecord(tampered);
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.refusal.reason).toBe('record-schema-unsupported');
    }
  });

  it('REFUSES garbage payloads (the caller discards and recovers — never a coerced open)', () => {
    // Non-objects: envelope-malformed.
    for (const garbage of [null, 'x', 3, []]) {
      const admitted = admitPersistedRecord(garbage);
      expect(admitted.ok).toBe(false);
      if (!admitted.ok) {
        expect(admitted.refusal.reason).toBe('envelope-malformed');
      }
    }
    // Structured-but-empty: still refused (fail-closed).
    const empty = admitPersistedRecord({});
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.refusal.reason).toBe('gateway-contract-unsupported');
    }
  });
});

describe('the request-protocol assertion (refusal point 3)', () => {
  it('passes the frozen gateway contract version', () => {
    expect(assertRequestProtocol(DESKTOP_GATEWAY_CONTRACT_VERSION)).toBeNull();
  });

  it('REFUSES every other contract version (the bridge never sends foreign envelopes)', () => {
    for (const foreign of ['0.9.0', '1.0.1', '2.0.0', '']) {
      const refusal = assertRequestProtocol(foreign);
      expect(refusal?.refused).toBe(true);
      expect(refusal?.reason).toBe('gateway-contract-unsupported');
    }
  });
});
