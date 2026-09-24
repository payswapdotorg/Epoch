// Positive tests: envelope parsing per category, and the typed adapter
// contract exercised end-to-end through a reference fake adapter.
import { describe, expect, it } from 'vitest';
import { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import type { AdapterRequestEnvelope, CapabilityCategory } from '../src/index';
import {
  negotiateBinding,
  parseAdapterRequest,
  parseAdapterResponse,
} from '../src/index';
import {
  ReferenceSimulationAdapter,
  REQUEST_PAYLOADS,
  RESPONSE_PAYLOADS,
  capability,
  descriptor,
  expectedPin,
  typedDescriptor,
} from './helpers';

const PIN = {
  capabilityId: 'engineering.stress-analysis',
  capabilityVersion: '1.2.3',
  manifestDigest: 'a'.repeat(64),
  adapterId: 'adapter:stress-solver',
  adapterDescriptorDigest: 'b'.repeat(64),
};

describe('envelope parsing per category (positive)', () => {
  it.each([...CAPABILITY_FABRIC_CATEGORIES])('parses a valid %s request envelope', (category) => {
    const result = parseAdapterRequest({
      schemaVersion: 1,
      category,
      binding: PIN,
      payload: REQUEST_PAYLOADS[category],
    });
    expect(result.ok, category).toBe(true);
    if (!result.ok) return;
    expect(result.value.category).toBe(category);
    expect(result.value.schemaVersion).toBe(1);
  });

  it.each([...CAPABILITY_FABRIC_CATEGORIES])('parses a valid %s response envelope', (category) => {
    const result = parseAdapterResponse({
      schemaVersion: 1,
      category,
      binding: PIN,
      payload: RESPONSE_PAYLOADS[category],
    });
    expect(result.ok, category).toBe(true);
    if (!result.ok) return;
    expect(result.value.category).toBe(category);
  });

  it('envelopes round-trip through JSON serialization', () => {
    const request = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        category: 'simulation',
        binding: PIN,
        payload: REQUEST_PAYLOADS.simulation,
      }),
    ) as unknown;
    const parsed = parseAdapterRequest(request);
    expect(parsed.ok).toBe(true);
  });
});

describe('typed adapter contract end-to-end (positive)', () => {
  it('a concrete adapter implementing CapabilityAdapter<"simulation"> serves negotiated invocations', async () => {
    const desc = typedDescriptor();
    const adapter = new ReferenceSimulationAdapter(desc);
    const negotiated = negotiateBinding(desc, capability());
    expect(negotiated.ok).toBe(true);
    if (!negotiated.ok) return;

    const request: AdapterRequestEnvelope<'simulation'> = {
      schemaVersion: 1,
      category: 'simulation',
      binding: negotiated.value,
      payload: { inputs: { 'load-kn': 12.5 }, seed: 7 },
    };
    const response = await adapter.invoke(request);
    expect(response.category).toBe('simulation');
    expect(response.binding).toEqual(negotiated.value);
    expect(response.payload.status).toBe('completed');
    if (response.payload.status !== 'completed') return;
    expect(response.payload.outputs['max-stress-mpa']).toBe(42.5);

    const reparsed = parseAdapterResponse(JSON.parse(JSON.stringify(response)) as unknown);
    expect(reparsed.ok).toBe(true);
  });

  it('the negotiated pin flows into envelopes unchanged (exact-revision binding)', async () => {
    const desc = typedDescriptor();
    const adapter = new ReferenceSimulationAdapter(desc);
    const negotiated = negotiateBinding(desc, capability());
    if (!negotiated.ok) throw new Error('fixture negotiation failed');
    const response = await adapter.invoke({
      schemaVersion: 1,
      category: 'simulation',
      binding: negotiated.value,
      payload: { inputs: { 'load-kn': 1 } },
    });
    expect(response.binding).toEqual(expectedPin(desc));
    expect(response.binding.manifestDigest).toBe(capability().manifestDigest);
  });

  it('category-generic hosts can dispatch envelopes by category', async () => {
    const desc = typedDescriptor();
    const adapter = new ReferenceSimulationAdapter(desc);
    const negotiated = negotiateBinding(desc, capability());
    if (!negotiated.ok) throw new Error('fixture negotiation failed');
    const envelope = {
      schemaVersion: 1 as const,
      category: 'simulation' as CapabilityCategory,
      binding: negotiated.value,
      payload: REQUEST_PAYLOADS.simulation,
    };
    // A host holding the union form dispatches on the discriminator.
    const parsed = parseAdapterRequest(envelope);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    if (parsed.value.category === 'simulation') {
      const response = await adapter.invoke(parsed.value);
      expect(response.payload.status).toBe('completed');
    } else {
      throw new Error('dispatch missed the simulation branch');
    }
  });
});

describe('descriptor fixture sanity', () => {
  it('the fixture descriptor parses', () => {
    expect(parseAdapterRequest({ ...descriptor() }).ok).toBe(false); // a descriptor is not an envelope
  });
});
