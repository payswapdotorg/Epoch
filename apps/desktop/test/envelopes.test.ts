// W017 acceptance: the host↔shell envelope seam — versioned,
// content-addressed, replay-safe. Round-trip serialization + digest
// verification, tampered digests, malformed envelopes, unknown-field
// rejection, direction-kind legality, and the replay-safety chain gates
// (gaps, forks, out-of-order, cross-channel roots).
import { describe, expect, it } from 'vitest';
import {
  GENESIS_DIGEST,
  admitEnvelope,
  appendEnvelope,
  openChannel,
  parseHostShellEnvelope,
  sealHostShellEnvelope,
  verifyEnvelopeChain,
  verifyHostShellEnvelope,
  type HostShellEnvelope,
  type SeamChannel,
} from '../src/index';
import { PRINCIPAL, TENANT_A, expectFailure } from './fixtures';

function content(overrides: Partial<Parameters<typeof appendEnvelope>[1]> = {}) {
  return {
    schema: 'epoch.desktop.host-shell-envelope' as const,
    protocolVersion: '1.0.0' as const,
    envelopeId: 'env-host-0001',
    sessionId: 'dss-alpha-1',
    direction: 'host-to-shell' as const,
    issuedAtMs: 0,
    body: {
      kind: 'session-open' as const,
      payload: { scope: { tenantId: TENANT_A }, principal: PRINCIPAL },
    },
    provenance: { origin: 'host-envelope' as const },
    ...overrides,
  };
}

describe('envelope sealing and verification', () => {
  it('chains from genesis and seals content-addressed', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const appended = appendEnvelope(channel, content());
    expect(appended.ok).toBe(true);
    if (appended.ok) {
      expect(appended.value.envelope.sequence).toBe(1);
      expect(appended.value.envelope.prevEnvelopeDigest).toBe(GENESIS_DIGEST);
      expect(appended.value.envelope.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyHostShellEnvelope(appended.value.envelope)).toBe(true);
      expect(appended.value.channel.lastSequence).toBe(1);
      expect(appended.value.channel.lastDigest).toBe(appended.value.envelope.digest);
    }
  });

  it('identical content produces the identical digest (determinism)', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const a = appendEnvelope(channel, content());
    const b = appendEnvelope(channel, content());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.envelope.digest).toBe(b.value.envelope.digest);
    }
  });

  it('round-trip: seal -> JSON -> parse -> identical envelope', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const appended = appendEnvelope(channel, content());
    if (!appended.ok) {
      throw new Error(appended.error.message);
    }
    const parsed = parseHostShellEnvelope(JSON.parse(JSON.stringify(appended.value.envelope)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(appended.value.envelope);
    }
  });

  it('tampered envelopes fail the digest gate (tamper detection)', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const appended = appendEnvelope(channel, content());
    if (!appended.ok) {
      throw new Error(appended.error.message);
    }
    const tampered = { ...appended.value.envelope, issuedAtMs: 999 };
    expectFailure(parseHostShellEnvelope(tampered), 'digest-mismatch');
    expect(verifyHostShellEnvelope(tampered)).toBe(false);
  });

  it('version skew fails fast with the typed version-unsupported', () => {
    expectFailure(
      parseHostShellEnvelope({ ...content(), protocolVersion: '2.0.0' }),
      'version-unsupported',
    );
    expectFailure(
      parseHostShellEnvelope({ ...content(), schema: 'other.schema' }),
      'version-unsupported',
    );
  });

  it('malformed envelopes fail the schema gate with flattened issues', () => {
    expectFailure(parseHostShellEnvelope('not-an-object'), 'malformed-record');
    expectFailure(parseHostShellEnvelope({ ...content(), sequence: 'one' }), 'malformed-record');
    expectFailure(
      parseHostShellEnvelope({ ...content(), body: { kind: 'session-open', payload: {} } }),
      'malformed-record',
    );
  });

  it('unknown (vendor) fields are rejected on every envelope-controlled record', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const appended = appendEnvelope(channel, content());
    if (!appended.ok) {
      throw new Error(appended.error.message);
    }
    // Unknown field at the envelope level: the strict object rejects it
    // (the schema gate fires before the digest gate).
    expectFailure(
      parseHostShellEnvelope({ ...appended.value.envelope, nativeHandle: 'anything' }),
      'malformed-record',
    );
    // Unknown field inside a payload: same strict rejection. Reseat the
    // envelope so the digest is VALID, proving the strict object (not the
    // digest) is what rejects the smuggled field.
    const smuggled = JSON.parse(JSON.stringify(appended.value.envelope)) as HostShellEnvelope;
    (smuggled.body as unknown as Record<string, unknown>).payload = {
      scope: { tenantId: TENANT_A },
      principal: PRINCIPAL,
      vendorField: 'smuggled',
    };
    const { digest: _stale, ...smuggledContent } = smuggled;
    void _stale;
    const resealed = sealHostShellEnvelope(smuggledContent as never);
    expectFailure(parseHostShellEnvelope(resealed), 'malformed-record');
  });

  it('enforces the closed direction-kind dispatch table', () => {
    const hostChannel = openChannel('dss-alpha-1', 'host-to-shell');
    // A shell→host kind on the host channel is foreign.
    const foreign = appendEnvelope(hostChannel, {
      ...content(),
      body: { kind: 'session-opened', payload: { scope: { tenantId: TENANT_A }, principal: PRINCIPAL } },
    });
    expectFailure(foreign, 'malformed-record');
    // A host→shell kind on the shell channel is foreign.
    const shellChannel = openChannel('dss-alpha-1', 'shell-to-host');
    const reverse = appendEnvelope(shellChannel, {
      ...content(),
      direction: 'shell-to-host',
      provenance: { origin: 'shell-surface' },
    });
    expectFailure(reverse, 'malformed-record');
  });

  it('enforces provenance-origin/direction coherence', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const incoherent = appendEnvelope(channel, {
      ...content(),
      provenance: { origin: 'shell-surface' }, // a host envelope claiming shell origin
    });
    expectFailure(incoherent, 'malformed-record');
  });

  it('requires present embedded documents (experience offers)', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const missing = appendEnvelope(channel, {
      ...content(),
      body: { kind: 'experience-offer', payload: { graph: { some: 'graph' } } } as HostShellEnvelope['body'],
    });
    expectFailure(missing, 'malformed-record');
  });
});

describe('replay safety (the chain gates)', () => {
  function chainOf(count: number): { envelopes: HostShellEnvelope[]; channel: SeamChannel } {
    let channel = openChannel('dss-alpha-1', 'host-to-shell');
    const envelopes: HostShellEnvelope[] = [];
    for (let i = 0; i < count; i += 1) {
      const appended = appendEnvelope(channel, {
        ...content(),
        envelopeId: `env-host-${String(i + 1).padStart(4, '0')}`,
        body:
          i === 0
            ? { kind: 'session-open' as const, payload: { scope: { tenantId: TENANT_A }, principal: PRINCIPAL } }
            : { kind: 'snapshot-request' as const, payload: {} },
      });
      if (!appended.ok) {
        throw new Error(appended.error.message);
      }
      envelopes.push(appended.value.envelope);
      channel = appended.value.channel;
    }
    return { envelopes, channel };
  }

  it('verifies a well-formed chain end-to-end', () => {
    const { envelopes, channel } = chainOf(3);
    const verified = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', envelopes);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.lastSequence).toBe(channel.lastSequence);
      expect(verified.value.lastDigest).toBe(channel.lastDigest);
    }
  });

  it('rejects a gap in the sequence (replay-violation)', () => {
    const { envelopes } = chainOf(4);
    const gapped = [envelopes[0], envelopes[2], envelopes[3]];
    const rejected = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', gapped);
    expectFailure(rejected, 'replay-violation');
  });

  it('rejects a replayed (repeated) envelope (out-of-order)', () => {
    const { envelopes } = chainOf(3);
    const replayed = [...envelopes, envelopes[2]];
    const rejected = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', replayed);
    expectFailure(rejected, 'replay-violation');
  });

  it('rejects a fork (envelope chained from a different head)', () => {
    const { envelopes } = chainOf(2);
    // Forge a third envelope chained from the FIRST envelope's digest.
    const forged = appendEnvelope(
      { sessionId: 'dss-alpha-1', direction: 'host-to-shell', lastSequence: 1, lastDigest: envelopes[0].digest },
      {
        ...content(),
        envelopeId: 'env-host-0003',
        body: { kind: 'snapshot-request', payload: {} },
      },
    );
    if (!forged.ok) {
      throw new Error(forged.error.message);
    }
    const rejected = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', [
      ...envelopes,
      forged.value.envelope,
    ]);
    expectFailure(rejected, 'replay-violation');
  });

  it('rejects an envelope from a different channel root (session/direction mismatch)', () => {
    const { envelopes } = chainOf(1);
    const wrongSession = admitEnvelope(
      openChannel('dss-other-9', 'host-to-shell'),
      envelopes[0],
    );
    expectFailure(wrongSession, 'replay-violation');
    const wrongDirection = admitEnvelope(openChannel('dss-alpha-1', 'shell-to-host'), envelopes[0]);
    expectFailure(wrongDirection, 'replay-violation');
  });

  it('rejects a tampered envelope inside an otherwise valid chain', () => {
    const { envelopes } = chainOf(2);
    const tampered = { ...envelopes[1], issuedAtMs: 12345 };
    const rejected = verifyEnvelopeChain('dss-alpha-1', 'host-to-shell', [envelopes[0], tampered]);
    expectFailure(rejected, 'digest-mismatch');
  });
});
