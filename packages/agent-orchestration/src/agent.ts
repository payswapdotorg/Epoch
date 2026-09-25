/**
 * Capability-scoped agent binding (the W020 pin): an orchestrated agent
 * binds to REGISTERED capabilities — the W007 registry vocabulary,
 * resolved through the REAL @epoch/capability-registry (never re-declared
 * here). Binding to an unknown capability is rejected
 * (`unknown-capability`); binding to a RETIRED one is rejected
 * (`lifecycle-conflict`, mirroring the registry's own resolution
 * semantics — retirement is terminal, deprecation is advisory and still
 * binds).
 *
 * Provider neutrality (lock rule 13): the descriptor is a typed,
 * provider-neutral shape; strict objects reject unknown fields, so vendor/
 * model/provider vocabulary (model names, endpoints, keys) is structurally
 * unrepresentable.
 */
import type { CapabilityRegistry } from '@epoch/capability-registry';
import { computeAgentBindingDigest } from './digest';
import type { AgentBinding, CapabilityPin, OrchestrationResult } from './types';
import { parseOrchestratedAgent } from './parse';

/** Options of {@link bindOrchestratedAgent}. */
export interface BindAgentOptions {
  /** The orchestrated agent descriptor (validated, strict object). */
  readonly agent: unknown;
  /** The reference capability registry (W007) the pins resolve against. */
  readonly registry: CapabilityRegistry;
}

/**
 * Bind an orchestrated agent against the capability registry. Total, never
 * throws; fixed precedence:
 *
 * 1. version gate — `schemaVersion` skew is `version-unsupported`;
 * 2. schema gate — strict-object validation with precise dotted paths
 *    (`validation`); capability pins must be unique;
 * 3. resolution gate — every pin resolves against the registry
 *    (`unknown-capability`), and no resolved record is retired
 *    (`lifecycle-conflict`);
 * 4. the binding is sealed with its content digest (pins sorted by
 *    capabilityId, then version — deterministic, no insertion-order leaks).
 */
export function bindOrchestratedAgent(options: BindAgentOptions): OrchestrationResult<AgentBinding> {
  const parsed = parseOrchestratedAgent(options.agent);
  if (!parsed.ok) {
    return parsed;
  }
  const agent = parsed.value;

  const pins: CapabilityPin[] = [];
  for (const pin of agent.capabilities) {
    const resolved = options.registry.get({ capabilityId: pin.capabilityId, version: pin.version });
    if (!resolved.ok) {
      return {
        ok: false,
        error: {
          code: 'unknown-capability',
          message: `no capability registered with id "${pin.capabilityId}" at version "${pin.version}" — orchestrated agents bind to registered capabilities only`,
          capabilityId: pin.capabilityId,
          version: pin.version,
        },
      };
    }
    if (resolved.value.lifecycle === 'retired') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `capability "${pin.capabilityId}" at version "${pin.version}" is retired — retired capabilities do not bind (lifecycle is terminal; a returning capability registers as a NEW version)`,
          from: 'retired',
          to: 'registered',
        },
      };
    }
    pins.push({
      capabilityId: resolved.value.manifest.capabilityId,
      version: resolved.value.manifest.version,
      category: resolved.value.manifest.category,
      lifecycleAtBinding: resolved.value.lifecycle,
    });
  }
  pins.sort((a, b) => comparePins(a, b));

  const binding: Omit<AgentBinding, 'bindingDigest'> = {
    schemaVersion: agent.schemaVersion,
    agent,
    capabilities: pins,
  };
  return { ok: true, value: { ...binding, bindingDigest: computeAgentBindingDigest(binding) } };
}

/** Deterministic capability-pin ordering: capabilityId, then version. */
function comparePins(a: AgentBinding['capabilities'][number], b: AgentBinding['capabilities'][number]): number {
  if (a.capabilityId !== b.capabilityId) return a.capabilityId < b.capabilityId ? -1 : 1;
  return a.version === b.version ? 0 : a.version < b.version ? -1 : 1;
}
