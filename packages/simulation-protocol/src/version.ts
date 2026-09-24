/**
 * Simulation Protocol version constants and message-kind vocabulary.
 *
 * Versioning policy (mirrors the agent and action protocols): a message is
 * admitted only when its `protocolVersion` equals
 * {@link SIMULATION_PROTOCOL_VERSION} exactly, and version skew is reported
 * as a distinct `version-mismatch` admission error before any schema
 * validation. Tolerance for compatible minor/patch versions is a future,
 * explicit protocol decision (recorded as a limitation in the W005 PR).
 *
 * The simulation-protocol version evolves independently of the agent and
 * action protocol versions; shared primitives consumed from
 * `@epoch/agent-protocol` (canonical serialization, digests, admission
 * pipeline, parameter specs, cost/latency profiles) are re-exported but not
 * re-versioned here.
 */
import { z } from 'zod';

/** Protocol version carried by every simulation-protocol message. */
export const SIMULATION_PROTOCOL_VERSION = '1.0.0' as const;

/** The simulation-protocol version literal type. */
export type SimulationProtocolVersion = typeof SIMULATION_PROTOCOL_VERSION;

export const SimulationProtocolVersionSchema = z
  .literal(SIMULATION_PROTOCOL_VERSION)
  .meta({
    id: 'SimulationProtocolVersion',
    title: 'SimulationProtocolVersion',
    description: 'Exact simulation-protocol version admitted by this release ("1.0.0").',
  });

/** Message kind of the simulator registration message. */
export const SIMULATION_MESSAGE_KIND_REGISTRATION = 'simulation.registration' as const;

/** Message kind of the simulation invocation request message. */
export const SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST =
  'simulation.invocation-request' as const;

/** Message kind of the simulation result message. */
export const SIMULATION_MESSAGE_KIND_RESULT = 'simulation.result' as const;

/** All message kinds defined by simulation protocol v1. */
export const SIMULATION_PROTOCOL_MESSAGE_KINDS = [
  SIMULATION_MESSAGE_KIND_REGISTRATION,
  SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST,
  SIMULATION_MESSAGE_KIND_RESULT,
] as const;

/** Message-kind value type of simulation protocol v1. */
export type SimulationMessageKind = (typeof SIMULATION_PROTOCOL_MESSAGE_KINDS)[number];

export const SimulationMessageKindSchema = z
  .enum(SIMULATION_PROTOCOL_MESSAGE_KINDS)
  .meta({
    id: 'SimulationMessageKind',
    title: 'SimulationMessageKind',
    description: 'Discriminating message kind for simulation-protocol messages.',
  });

/** Version of the published contract surface at packages/simulation-protocol/contracts. */
export const SIMULATION_CONTRACT_VERSION = '1.0.0' as const;
