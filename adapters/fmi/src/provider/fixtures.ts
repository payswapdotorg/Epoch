/**
 * @epoch/adapter-fmi — reference provider fixtures (the co-simulation
 * standard's vocabulary allowed HERE only; the W020/W022 reference
 * precedent: no live runtimes, fixtures stand in for provider payloads).
 *
 * Fixtures are DETERMINISTIC constructors: identical calls produce
 * byte-identical payloads, so descriptor digests and step records
 * replay identically (pinned by the determinism tests).
 */
import { PROVIDER_DESCRIPTOR_VERSION, PROVIDER_STANDARD_NAME } from './payload';

/** The canonical reference participant: a first-order linear plant. */
export function referenceParticipant(): unknown {
  return {
    schemaVersion: PROVIDER_DESCRIPTOR_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    standardVersion: '2.0',
    modelName: 'LinearPlant',
    modelIdentity: '0123456789abcdef0123456789abcdef',
    variables: [
      { name: 'drive_input', causality: 'input', unit: 'm/s2', start: 0 },
      { name: 'position', causality: 'output', unit: 'm', start: 0 },
      { name: 'velocity', causality: 'output', unit: 'm/s', start: 0 },
      { name: 'damping', causality: 'parameter', unit: '1/s', start: 0.1 },
      { name: 'stiffness', causality: 'parameter', unit: '1/s2', start: 1 },
    ],
  };
}

/** A SECOND, distinct reference participant (different model) for replay-conflict evidence. */
export function conflictingParticipant(): unknown {
  return {
    schemaVersion: PROVIDER_DESCRIPTOR_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    standardVersion: '2.0',
    modelName: 'LinearPlant',
    modelIdentity: 'fedcba9876543210fedcba9876543210',
    variables: [
      { name: 'drive_input', causality: 'input', unit: 'm/s2', start: 0 },
      { name: 'position', causality: 'output', unit: 'm', start: 1 },
    ],
  };
}

/** A malformed provider payload (unknown envelope version). */
export function malformedParticipant(): unknown {
  return { schemaVersion: 99, standard: PROVIDER_STANDARD_NAME, variables: [] };
}

/** A structurally invalid payload (no output variables). */
export function outputlessParticipant(): unknown {
  return {
    schemaVersion: PROVIDER_DESCRIPTOR_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    standardVersion: '2.0',
    modelName: 'SensorOnly',
    modelIdentity: 'ffffffffffffffffffffffffffffffff',
    variables: [{ name: 'reading', causality: 'input', start: 0 }],
  };
}
