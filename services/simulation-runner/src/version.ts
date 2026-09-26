/**
 * Simulation-runner service contract versions and closed vocabularies.
 *
 * The service is the thin, typed HOST FACADE over the
 * @epoch/simulation-fabric kernel (the W021 division of ownership,
 * mirroring services/agent-runtime over @epoch/agent-orchestration): it
 * owns job intake with REAL W007 registry resolution, run supervision,
 * the one-shot driver, result publication, and health/liveness — never
 * new contract authorities (the typed fabric contract is the kernel's;
 * the runner reuses its error taxonomy and documents, never forks, it).
 *
 * Neutrality (architecture lock rule 13): no field, id or vocabulary
 * names a simulation vendor, grid, cloud, or engine. The host is
 * provider-neutral by construction; concrete compute backends and
 * durable persistence are future adapters behind the fabric's
 * SimulationExecutionPort seam.
 */

/** Version of the simulation-runner host surface. */
export const SIMULATION_RUNNER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by runner snapshots. */
export const SIMULATION_RUNNER_RECORD_VERSION = 1 as const;

/** Health statuses of the runner host (typed liveness data). */
export const SIMULATION_RUNNER_HEALTH_STATUSES = ['healthy', 'degraded'] as const;

/** One runner health status. */
export type SimulationRunnerHealthStatus = (typeof SIMULATION_RUNNER_HEALTH_STATUSES)[number];
