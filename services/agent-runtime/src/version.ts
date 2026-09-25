/**
 * Agent-runtime service contract versions and closed vocabularies.
 *
 * The service is the long-running HOST MODEL over the
 * @epoch/agent-orchestration kernel (W020 division of ownership): it owns
 * session lifecycle management, event intake, the advance-on-event driver
 * and health/liveness — never new contract authorities (the typed
 * orchestration contract is the kernel's; the runtime reuses its error
 * taxonomy and documents, never forks, it).
 *
 * Neutrality (architecture lock rule 13): no field, id or vocabulary names
 * a model vendor, provider, broker or deployment surface. The host is
 * provider-neutral by construction; concrete model providers and durable
 * persistence are future adapters.
 */

/** Version of the agent-runtime host surface. */
export const AGENT_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by runtime snapshots. */
export const RUNTIME_RECORD_VERSION = 1 as const;

/** Health statuses of the runtime host (typed liveness data). */
export const RUNTIME_HEALTH_STATUSES = ['healthy', 'degraded'] as const;

/** One runtime health status. */
export type RuntimeHealthStatus = (typeof RUNTIME_HEALTH_STATUSES)[number];
