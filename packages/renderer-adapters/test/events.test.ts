// The adaptation-event vocabulary over the mirrored W010 shapes:
// emission, sealing, causal chains, payload discipline, and tenant
// consistency.
import { describe, expect, it } from 'vitest';
import {
  adapterStreamIdOf,
  buildTechniqueSelectedEvent,
  buildMountPlannedEvent,
  sealAdapterEvent,
  computeAdapterEventDigest,
  parseAdapterEventData,
  ADAPTER_EVENT_DISCRIMINATORS,
  AdapterEventContentSchema,
  selectRendererAdapter,
} from '../src/index';
import { boundSession, desktopDevice, assess, FULL_RENDERER } from './fixtures';

const T1 = '2026-09-28T00:00:00.000Z';
const ACTOR = 'principal:host-shell';
const TENANT = 'tenant:tenant-alpha';

function selectionFixture() {
  const binding = boundSession(FULL_RENDERER);
  const assessment = assess(desktopDevice(), 'dca-events');
  const selection = selectRendererAdapter({ selectionId: 'ras-events', binding, assessment });
  if (!selection.ok) throw new Error('fixture failed');
  return selection.value;
}

function techniqueSelectedPayload() {
  const selection = selectionFixture();
  return {
    selectionId: selection.selectionId,
    rendererSessionId: selection.rendererSessionId,
    technique: selection.technique,
    reason: selection.reason,
    bindingDigest: selection.bindingDigest,
    assessmentDigest: selection.assessmentDigest,
  };
}

describe('adaptation events (emission + sealing)', () => {
  it('one renderer session maps to one deterministic stream id', () => {
    expect(adapterStreamIdOf('rs-alpha-1')).toBe('stream:renderer-adapter-alpha-1');
    expect(adapterStreamIdOf('rs-beta-2')).toBe('stream:renderer-adapter-beta-2');
  });

  it('builds and seals a technique-selected event over the mirrored W010 shape', () => {
    const payload = techniqueSelectedPayload();
    const content = buildTechniqueSelectedEvent(
      payload,
      { streamId: 'stream:renderer-adapter-alpha-1', sequence: 1, causalParent: null },
      { tenantId: TENANT, actor: ACTOR, occurredAt: T1 },
    );
    expect(content.ok).toBe(true);
    if (!content.ok) throw new Error(content.error.message);
    expect(content.value.payload.discriminator).toBe('renderer-adapter:technique-selected');
    const sealed = sealAdapterEvent(content.value);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(sealed.value.event).toEqual(content.value);
    }
  });

  it('builds and seals a mount-planned event with a causal parent', () => {
    const selection = selectionFixture();
    const first = buildTechniqueSelectedEvent(
      techniqueSelectedPayload(),
      { streamId: 'stream:renderer-adapter-alpha-1', sequence: 1, causalParent: null },
      { tenantId: TENANT, actor: ACTOR, occurredAt: T1 },
    );
    if (!first.ok) throw new Error(first.error.message);
    const second = buildMountPlannedEvent(
      {
        planId: 'rmp-event-1',
        invocationId: 'inv-event-1',
        rendererSessionId: selection.rendererSessionId,
        technique: selection.technique,
        selectionDigest: selection.digest,
        graphDigest: 'a'.repeat(64),
        graphKind: '3d',
      },
      {
        streamId: 'stream:renderer-adapter-alpha-1',
        sequence: 2,
        causalParent: { streamId: 'stream:renderer-adapter-alpha-1', sequence: 1 },
      },
      { tenantId: TENANT, actor: ACTOR, occurredAt: T1 },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.causalParent).toEqual({
      streamId: 'stream:renderer-adapter-alpha-1',
      sequence: 1,
    });
    const sealed = sealAdapterEvent(second.value);
    expect(sealed.ok).toBe(true);
  });

  it('the digest equals the canonical digest of the content', () => {
    const content = buildTechniqueSelectedEvent(
      techniqueSelectedPayload(),
      { streamId: 'stream:renderer-adapter-alpha-1', sequence: 1, causalParent: null },
      { tenantId: TENANT, actor: ACTOR, occurredAt: T1 },
    );
    if (!content.ok) throw new Error(content.error.message);
    const digest = computeAdapterEventDigest(content.value);
    expect(digest.ok).toBe(true);
    const sealed = sealAdapterEvent(content.value);
    if (!sealed.ok) throw new Error(sealed.error.message);
    if (digest.ok) {
      expect(sealed.value.digest).toBe(digest.value);
    }
  });

  it('the discriminator vocabulary is closed and namespaced', () => {
    expect(ADAPTER_EVENT_DISCRIMINATORS).toEqual([
      'renderer-adapter:mount-planned',
      'renderer-adapter:technique-selected',
    ]);
    for (const discriminator of ADAPTER_EVENT_DISCRIMINATORS) {
      expect(discriminator.startsWith('renderer-adapter:')).toBe(true);
    }
  });
});

describe('adaptation events (payload discipline)', () => {
  it('valid payload data parses against its typed schema', () => {
    const result = parseAdapterEventData('renderer-adapter:technique-selected', techniqueSelectedPayload());
    expect(result.ok).toBe(true);
  });

  it('invalid payload data is a typed malformed-record', () => {
    const result = parseAdapterEventData('renderer-adapter:technique-selected', {
      selectionId: 'not-an-id',
      rendererSessionId: 'rs-alpha-1',
      technique: 'retained-scene-3d',
      reason: 'spatial-kinds-local',
      bindingDigest: 'a'.repeat(64),
      assessmentDigest: 'b'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('malformed-record');
    }
  });

  it('an invalid discriminator in the mirrored payload shape is rejected', () => {
    const content = {
      schemaVersion: 1,
      streamId: 'stream:renderer-adapter-alpha-1',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: { discriminator: 'world:subjects', data: {} }, // reserved kernel namespace
      occurredAt: T1,
    };
    expect(AdapterEventContentSchema.safeParse(content).success).toBe(false);
  });

  it('a malformed stream id is rejected by the mirrored shape', () => {
    const content = {
      schemaVersion: 1,
      streamId: 'not-a-stream',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: { discriminator: 'renderer-adapter:technique-selected', data: {} },
      occurredAt: T1,
    };
    expect(AdapterEventContentSchema.safeParse(content).success).toBe(false);
  });

  it('a sequence of 0 is rejected (sequences are 1-based)', () => {
    const content = {
      schemaVersion: 1,
      streamId: 'stream:renderer-adapter-alpha-1',
      sequence: 0,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: { discriminator: 'renderer-adapter:technique-selected', data: {} },
      occurredAt: T1,
    };
    expect(AdapterEventContentSchema.safeParse(content).success).toBe(false);
  });

  it('a wall-clock-style instant is NOT read: occurredAt is producer-supplied data', () => {
    // The instant is validated as a UTC millisecond-precision ISO string —
    // a producer-supplied FACT, never an environment read.
    const content = {
      schemaVersion: 1,
      streamId: 'stream:renderer-adapter-alpha-1',
      sequence: 1,
      tenantId: TENANT,
      actor: ACTOR,
      causalParent: null,
      payload: { discriminator: 'renderer-adapter:technique-selected', data: {} },
      occurredAt: 'not-a-timestamp',
    };
    expect(AdapterEventContentSchema.safeParse(content).success).toBe(false);
  });

  it('sealing invalid content is a typed malformed-record (never a throw)', () => {
    const result = sealAdapterEvent({ nope: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('malformed-record');
    }
  });
});
