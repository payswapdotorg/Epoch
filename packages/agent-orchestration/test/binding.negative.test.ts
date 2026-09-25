// Agent binding negatives (named, typed): unknown capabilities are
// unknown-capability; RETIRED capabilities are lifecycle-conflict
// (mirroring the registry's own resolution semantics); malformed
// descriptors and vendor/provider fields are structurally rejected.
import { describe, expect, it } from 'vitest';
import { bindOrchestratedAgent } from '../src/index';
import { agentFixture, fixtureRegistry } from './helpers';

describe('agent binding (negative)', () => {
  const registry = fixtureRegistry();

  it('rejects an unknown capability with unknown-capability', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({
        capabilities: [{ capabilityId: 'engineering.never-registered', version: '1.0.0' }],
      }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-capability');
      if (result.error.code === 'unknown-capability') {
        expect(result.error.capabilityId).toBe('engineering.never-registered');
        expect(result.error.version).toBe('1.0.0');
      }
    }
  });

  it('rejects a known capability id at an unregistered version', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({
        capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '9.9.9' }],
      }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-capability');
    }
  });

  it('rejects a RETIRED capability with lifecycle-conflict', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({
        agentId: 'agent:legacy-worker',
        capabilities: [{ capabilityId: 'engineering.legacy-solver', version: '1.0.0' }],
      }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
      if (result.error.code === 'lifecycle-conflict') {
        expect(result.error.from).toBe('retired');
      }
    }
  });

  it('rejects an agent descriptor with no capabilities', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({ capabilities: [] }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
    }
  });

  it('rejects duplicate capability pins', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({
        capabilities: [
          { capabilityId: 'engineering.stress-analysis', version: '1.2.3' },
          { capabilityId: 'engineering.stress-analysis', version: '1.2.3' },
        ],
      }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
    }
  });

  it('rejects malformed agent ids with precise paths', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({ agentId: 'Field Surveyor' }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path === 'agentId')).toBe(true);
      }
    }
  });

  it('rejects version skew with version-unsupported', () => {
    const result = bindOrchestratedAgent({
      agent: agentFixture({ schemaVersion: 3 }),
      registry,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('version-unsupported');
    }
  });

  it('rejects vendor/provider fields via strict objects (provider neutrality)', () => {
    for (const vendorField of [
      { provider: 'acme-cloud' },
      { model: 'gpt-x' },
      { apiKey: 'sk-live' },
      { baseUrl: 'https://api.example.invalid' },
      { llm: 'claude-x' },
      { vendor: 'anthropic' },
    ]) {
      const result = bindOrchestratedAgent({
        agent: agentFixture(vendorField),
        registry,
      });
      expect(result.ok, JSON.stringify(vendorField)).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
      }
    }
  });
});
