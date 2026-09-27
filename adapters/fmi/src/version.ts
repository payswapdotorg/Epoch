/**
 * @epoch/adapter-fmi — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized): every vocabulary below names typed, provider-neutral
 * concepts of the co-simulation domain — participants, ports, steps,
 * step exchanges. The co-simulation standard's own vocabulary (standard
 * names, model-description field names, capability flags) lives ONLY in
 * `src/provider/` and never crosses this seam; the per-adapter
 * neutrality blocklist test pins that boundary.
 */

/** Version of the published adapter contract surface (types + vocabularies). */
export const FMI_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter record. */
export const FMI_ADAPTER_RECORD_VERSION = 1 as const;

/** The contract id this package issues for W007 contract references. */
export const FMI_SIMULATION_CONTRACT_ID = 'epoch.adapter.participant-simulation' as const;

/** The W007 adapter category this package implements (simulation). */
export const FMI_ADAPTER_CATEGORIES = ['simulation'] as const;

/** The port directions of a typed simulation participant. */
export const PORT_DIRECTIONS = ['input', 'output', 'parameter'] as const;

/** One port direction. */
export type PortDirection = (typeof PORT_DIRECTIONS)[number];

/** The declared value kinds of a typed port (the neutral grammar). */
export const PORT_VALUE_KINDS = ['number'] as const;

/** One port value kind. */
export type PortValueKind = (typeof PORT_VALUE_KINDS)[number];

/**
 * Dispositions of a step admission (idempotent, content-addressed):
 * `stepped` — the exchange was computed and sealed;
 * `duplicate` — identical content under the same step key; the SEALED
 * PRIOR step returns (no re-execution).
 */
export const STEP_DISPOSITIONS = ['stepped', 'duplicate'] as const;

/** One step disposition. */
export type StepDisposition = (typeof STEP_DISPOSITIONS)[number];
