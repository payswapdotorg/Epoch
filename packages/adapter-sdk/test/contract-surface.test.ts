// Published-surface integrity: the exported vocabularies, error codes,
// and constants are exactly the pinned sets; the schema surface is
// complete and unique.
import { describe, expect, it } from 'vitest';
import { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import {
  ACTION_FAILURE_CODES,
  ADAPTER_DESCRIPTOR_VERSION,
  ADAPTER_ENVELOPE_VERSION,
  ADAPTER_ID_PATTERN,
  ADAPTER_SDK_CONTRACT_VERSION,
  ADAPTER_SDK_SCHEMA_SURFACE,
} from '../src/index';

describe('adapter-sdk published surface', () => {
  it('the category vocabulary is EXACTLY the architecture Capability Fabric list', () => {
    expect([...CAPABILITY_FABRIC_CATEGORIES]).toEqual([
      'source',
      'semantic',
      'reconstruction',
      'visualization',
      'simulation',
      'evaluator',
      'action',
      'verification',
    ]);
  });

  it('version constants are pinned', () => {
    expect(ADAPTER_SDK_CONTRACT_VERSION).toBe('1.0.0');
    expect(ADAPTER_DESCRIPTOR_VERSION).toBe(1);
    expect(ADAPTER_ENVELOPE_VERSION).toBe(1);
  });

  it('adapter ids follow the adapter: + kebab-slug convention', () => {
    expect(ADAPTER_ID_PATTERN.test('adapter:stress-solver')).toBe(true);
    expect(ADAPTER_ID_PATTERN.test('agent:stress-solver')).toBe(false);
    expect(ADAPTER_ID_PATTERN.test('adapter:Stress')).toBe(false);
  });

  it('the action failure vocabulary is the pinned neutral set', () => {
    expect([...ACTION_FAILURE_CODES]).toEqual([
      'precondition-not-met',
      'target-unavailable',
      'execution-rejected',
      'internal-error',
    ]);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = ADAPTER_SDK_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of ADAPTER_SDK_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });

  it('the schema surface covers every per-category payload and envelope', () => {
    const types = new Set(ADAPTER_SDK_SCHEMA_SURFACE.map((entry) => entry.type));
    for (const required of [
      'AdapterRequest',
      'AdapterResponse',
      'AdapterDescriptor',
      'BindingPin',
      'BindableCapability',
      'CapabilityBinding',
      'NeutralRequestPayload',
      'NeutralResponsePayload',
      'SimulationRequestPayload',
      'SimulationResponsePayload',
      'EvaluatorRequestPayload',
      'EvaluatorResponsePayload',
      'ActionRequestPayload',
      'ActionResponsePayload',
      'VerificationRequestPayload',
      'VerificationResponsePayload',
    ]) {
      expect(types.has(required), required).toBe(true);
    }
  });
});
