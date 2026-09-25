// Capability-scoped agent binding (positives): agents bind to REGISTERED
// capabilities through the REAL W007 registry (deprecated binds, advisory);
// bindings are content-addressed and deterministic.
import { describe, expect, it } from 'vitest';
import { bindOrchestratedAgent, computeAgentBindingDigest } from '../src/index';
import { agentFixture, fixtureRegistry } from './helpers';

describe('agent binding (positive)', () => {
  it('binds an agent to registered capabilities, pinning category and lifecycle', () => {
    const bound = bindOrchestratedAgent({
      agent: agentFixture(),
      registry: fixtureRegistry(),
    });
    if (!bound.ok) throw new Error(bound.error.message);
    expect(bound.value.agent.agentId).toBe('agent:field-surveyor');
    expect(bound.value.capabilities).toEqual([
      {
        capabilityId: 'engineering.stress-analysis',
        version: '1.2.3',
        category: 'simulation',
        lifecycleAtBinding: 'registered',
      },
    ]);
  });

  it('binds a DEPRECATED capability (advisory withdrawal still resolves, mirroring the registry)', () => {
    const bound = bindOrchestratedAgent({
      agent: agentFixture({
        agentId: 'agent:semantic-worker',
        capabilities: [{ capabilityId: 'engineering.deprecated-analyzer', version: '0.9.0' }],
      }),
      registry: fixtureRegistry(),
    });
    if (!bound.ok) throw new Error(bound.error.message);
    expect(bound.value.capabilities[0]!.lifecycleAtBinding).toBe('deprecated');
  });

  it('sorts resolved pins deterministically and is content-addressed', () => {
    const agent = agentFixture({
      agentId: 'agent:multi-skill',
      capabilities: [
        { capabilityId: 'engineering.drafting', version: '2.0.0' },
        { capabilityId: 'engineering.stress-analysis', version: '1.2.3' },
      ],
    });
    const first = bindOrchestratedAgent({ agent, registry: fixtureRegistry() });
    const second = bindOrchestratedAgent({ agent, registry: fixtureRegistry() });
    if (!first.ok) throw new Error(first.error.message);
    if (!second.ok) throw new Error(second.error.message);
    expect(first.value.capabilities.map((pin) => pin.capabilityId)).toEqual([
      'engineering.drafting',
      'engineering.stress-analysis',
    ]);
    expect(first.value).toEqual(second.value);
    expect(first.value.bindingDigest).toBe(
      computeAgentBindingDigest({
        schemaVersion: first.value.schemaVersion,
        agent: first.value.agent,
        capabilities: first.value.capabilities,
      }),
    );
  });
});
