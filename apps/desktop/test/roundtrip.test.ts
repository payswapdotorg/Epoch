// W017 acceptance: round-trip serialization + digest verification for
// every public sealed type — host envelopes, session snapshots, device
// descriptor, window records, authoring proposals, cache entries. Each
// type round-trips through JSON with an identical record and a verified
// digest; each digest is a pure function of the content.
import { describe, expect, it } from 'vitest';
import {
  appendEnvelope,
  openChannel,
  parseAuthoringProposal,
  parseHostShellEnvelope,
  parseSessionSnapshot,
  parseWindowRecord,
  proposeAuthoring,
  sealCacheEntry,
  verifyCacheEntry,
  verifyHostShellEnvelope,
  verifySessionSnapshot,
  verifyWindowRecord,
  verifyAuthoringProposal,
  admitDeviceDescriptor,
  createExperienceCache,
  contentAddressOf,
} from '../src/index';
import { canonicalDigest } from '@epoch/agent-protocol';
import { DESKTOP_DEVICE } from '../src/index';
import {
  PRINCIPAL,
  TENANT_A,
  compiledExperience,
  goldenScenario,
} from './fixtures';

function roundTrip<T>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T;
}

describe('round-trip + digest verification (every public sealed type)', () => {
  it('the desktop DeviceDescriptor round-trips through JSON and re-admits', () => {
    const round = roundTrip(DESKTOP_DEVICE);
    const admitted = admitDeviceDescriptor(round);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value).toEqual(DESKTOP_DEVICE);
    }
  });

  it('host↔shell envelopes round-trip with verified digests', () => {
    const channel = openChannel('dss-alpha-1', 'host-to-shell');
    const appended = appendEnvelope(channel, {
      schema: 'epoch.desktop.host-shell-envelope',
      protocolVersion: '1.0.0',
      envelopeId: 'env-host-0001',
      sessionId: 'dss-alpha-1',
      direction: 'host-to-shell',
      issuedAtMs: 0,
      body: {
        kind: 'session-open',
        payload: { scope: { tenantId: TENANT_A }, principal: PRINCIPAL },
      },
      provenance: { origin: 'host-envelope' },
    });
    if (!appended.ok) {
      throw new Error(appended.error.message);
    }
    const round = roundTrip(appended.value.envelope);
    const parsed = parseHostShellEnvelope(round);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(appended.value.envelope);
      expect(verifyHostShellEnvelope(round)).toBe(true);
      // The digest is a pure function of the content.
      const { digest: _d, ...content } = round;
      void _d;
      expect(canonicalDigest(content as unknown as Parameters<typeof canonicalDigest>[0])).toBe(round.digest);
    }
  });

  it('window records round-trip with verified digests (via the golden scenario)', () => {
    const scenario = goldenScenario({ withMount: false });
    const window = scenario.shell.session?.windows.get('win-alpha');
    expect(window).toBeDefined();
    if (window) {
      const round = roundTrip(window);
      const parsed = parseWindowRecord(round);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value).toEqual(window);
        expect(verifyWindowRecord(round)).toBe(true);
      }
    }
  });

  it('session snapshots round-trip with verified digests', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    const round = roundTrip(snapshot.value);
    const parsed = parseSessionSnapshot(round);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(snapshot.value);
      expect(verifySessionSnapshot(round)).toBe(true);
    }
  });

  it('authoring proposals round-trip with verified digests', () => {
    const proposal = proposeAuthoring({
      proposalId: 'ap-0001',
      sessionId: 'dss-alpha-1',
      windowId: 'win-alpha',
      actor: PRINCIPAL,
      actionType: { id: 'world.view.annotate', version: '1.0.0' },
      parameters: { note: 'round trip' },
      rationale: 'round-trip evidence',
      tenantScope: { tenantId: TENANT_A },
      proposedAtMs: 60,
    });
    if (!proposal.ok) {
      throw new Error(proposal.error.message);
    }
    const round = roundTrip(proposal.value);
    const parsed = parseAuthoringProposal(round);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(proposal.value);
      expect(verifyAuthoringProposal(round)).toBe(true);
    }
  });

  it('cache entries round-trip with verified digests and content-addressed records', () => {
    const experience = compiledExperience('2d');
    const cache = createExperienceCache();
    const stored = cache.put({
      address: experience.graph.digest,
      kind: 'experience-graph',
      record: experience.graph as unknown as Record<string, unknown>,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    if (!stored.ok) {
      throw new Error(stored.error.message);
    }
    const round = roundTrip(stored.value);
    expect(verifyCacheEntry(round)).toBe(true);
    // The entry metadata digest and the record content address are
    // independent, pure functions of their contents.
    const { digest: _d, ...content } = round;
    void _d;
    expect(canonicalDigest(content)).toBe(round.digest);
    expect(contentAddressOf(roundTrip(experience.graph))).toBe(experience.graph.digest);
    // A hand-sealed copy reproduces the identical entry digest.
    const resealed = sealCacheEntry(content as never);
    expect(resealed.digest).toBe(stored.value.digest);
  });

  it('compiled plan documents round-trip with their content addresses preserved', () => {
    const experience = compiledExperience('3d');
    const round = roundTrip(experience.plan);
    expect(contentAddressOf(round)).toBe(experience.plan.digest);
  });
});
