// W011/W012 downstream parity: the presence-graph emission produces W011
// Experience Graph envelopes that the @epoch/experience-compiler (W012,
// devDependency pin) admits and compiles into render plans. This pins the
// AI-collaboration presence vocabulary's downstream compatibility without
// any runtime dependency on the compiler.
import { describe, expect, it } from 'vitest';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import { compileExperienceGraph } from '@epoch/experience-compiler';
import {
  buildPresenceGraphContent,
  presenceCursorNode,
  presenceSeatNode,
  presenceSeatNodeId,
  presenceGraphNodes,
} from '../src/index';
import { AGENT_ID, AGENT_PEER, DIGEST_A, ENTITY_REF, INSPECTOR, LEAD } from './helpers';

const DEVICE = {
  descriptorVersion: 1,
  deviceClass: 'desktop',
  interaction: ['keyboard', 'pointer'],
  display: { stereoscopic: false, maxPixels: 8_294_400, refreshHz: 60, colorDepthBits: 8 },
  spatial: { poseTracking: 'none', worldAnchored: false },
  latencyBudgetMs: 100,
} as const;

const SEATS = [
  { principalId: AGENT_PEER, participantKind: 'agent' as const, agentId: AGENT_ID, presence: 'present' as const, ref: ENTITY_REF },
  { principalId: INSPECTOR, participantKind: 'human' as const, presence: 'present' as const },
  { principalId: LEAD, participantKind: 'human' as const, presence: 'present' as const },
];

describe('presence node emission (W011 vocabulary)', () => {
  it('emits deterministic, bounded node ids from principal ids', () => {
    const first = presenceSeatNodeId(AGENT_PEER);
    expect(first).toMatch(/^xn-seat-[a-z0-9-]{1,56}$/);
    expect(presenceSeatNodeId(AGENT_PEER)).toBe(first);
    expect(presenceSeatNodeId(INSPECTOR)).not.toBe(first);
  });

  it('emits a presence-seat node referencing the participant opaquely', () => {
    const node = presenceSeatNode(SEATS[0]!);
    expect(node.id).toBe(presenceSeatNodeId(AGENT_PEER));
    expect(node.kind).toBe('presence-seat');
    if (node.kind !== 'presence-seat') return;
    expect(node.descriptor.participant.participantId).toBe(AGENT_PEER);
    expect(node.descriptor.participant.participantKind).toBe('agent');
    expect(node.ref).toEqual(ENTITY_REF);
  });

  it('requires a position for a presence cursor (the W011 contract)', () => {
    const withPosition = presenceCursorNode({
      principalId: AGENT_PEER,
      participantKind: 'agent',
      position2d: [12, 30],
      atMs: 1000,
    });
    expect(withPosition.ok).toBe(true);
    const withoutPosition = presenceCursorNode({
      principalId: AGENT_PEER,
      participantKind: 'agent',
    });
    expect(withoutPosition.ok).toBe(false);
  });

  it('assembles sorted, duplicate-free node sets (deterministic emission)', () => {
    const nodes = presenceGraphNodes({ seats: SEATS });
    expect(nodes.ok).toBe(true);
    if (!nodes.ok) return;
    const ids = nodes.value.map((node) => node.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('presence graph compilation (W012 downstream parity)', () => {
  it('seals into a W011 envelope the compiler admits and compiles', () => {
    const content = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: SEATS,
      projectedFrom: [ENTITY_REF],
      device: DEVICE,
    });
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    const sealed = sealExperienceGraph(content.value);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const compiled = compileExperienceGraph({
      envelope: sealed.value,
      device: DEVICE,
      expectedTenantId: 'tenant:acme',
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    // The sealed Render Plan envelope: content digest + the source
    // envelope digest chain (envelope digest -> plan digest).
    expect(compiled.value.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(compiled.value.sourceEnvelopeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(compiled.value.sourceGraphKind).toBe('presence');
  });

  it('rejects a foreign expected tenant at compilation (R12 through the whole chain)', () => {
    const content = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: SEATS,
      device: DEVICE,
    });
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    const sealed = sealExperienceGraph(content.value);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const compiled = compileExperienceGraph({
      envelope: sealed.value,
      device: DEVICE,
      expectedTenantId: 'tenant:globex',
    });
    expect(compiled.ok).toBe(false);
  });

  it('equal inputs emit equal graphs (determinism)', () => {
    const first = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: SEATS,
      projectedFrom: [ENTITY_REF],
      device: DEVICE,
    });
    const second = buildPresenceGraphContent({
      projectedFrom: [ENTITY_REF],
      seats: [...SEATS].reverse(),
      graphId: 'xg-bridge-12-presence',
      device: DEVICE,
      tenantScope: { tenantId: 'tenant:acme' },
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
  });

  it('rejects a presence graph with no seats', () => {
    const content = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: [],
      device: DEVICE,
    });
    expect(content.ok).toBe(false);
  });

  it('rejects an invalid device descriptor', () => {
    const content = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: SEATS,
      device: { descriptorVersion: 2 },
    });
    expect(content.ok).toBe(false);
  });

  it('carries visual-state digests compatible with Engineering Moments (digest discipline)', () => {
    const content = buildPresenceGraphContent({
      graphId: 'xg-bridge-12-presence',
      tenantScope: { tenantId: 'tenant:acme' },
      seats: SEATS,
      projectedFrom: [ENTITY_REF],
      device: DEVICE,
    });
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    const sealed = sealExperienceGraph(content.value);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    // The moment's visualState.graphDigest binds this exact revision.
    expect(sealed.value.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(DIGEST_A).toMatch(/^[0-9a-f]{64}$/);
  });
});
