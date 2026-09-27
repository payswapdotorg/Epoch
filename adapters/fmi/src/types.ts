/**
 * @epoch/adapter-fmi — published contract types (v1), the NEUTRAL seam
 * (architecture lock rule 13).
 *
 * The record surfaces below are the standard-AGNOSTIC shapes everything
 * outside `src/provider/` speaks: typed participants (declared,
 * value-kinded, unit-carrying ports), deterministic content-addressed
 * step exchanges, and the W005 simulator-registration derivation that
 * turns a participant into a registered simulation capability. No
 * co-simulation-standard vocabulary appears in any shape, key, or enum
 * (pinned by test/neutrality.test.ts).
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { SimulatorRegistration } from '@epoch/simulation-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { FMI_ADAPTER_RECORD_VERSION } from './version';
import type { PortDirection, StepDisposition } from './version';

// ---------------------------------------------------------------------------
// Typed participants: ports and participants.
// ---------------------------------------------------------------------------

/** One typed port of a simulation participant. */
export interface ParticipantPort {
  readonly schemaVersion: typeof FMI_ADAPTER_RECORD_VERSION;
  readonly name: string;
  readonly direction: PortDirection;
  readonly valueKind: 'number';
  readonly unit?: string | undefined;
  /** The declared initial value (start value). */
  readonly startValue: number;
  readonly contentDigest: Sha256Hex;
}

/**
 * A typed simulation participant: the neutral projection of a
 * participant-model descriptor. Ports sort by name; the participant is
 * content-addressed over its full declaration.
 */
export interface TypedParticipant {
  readonly schemaVersion: typeof FMI_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** Neutral participant identity (`participant:<slug>`). */
  readonly participantId: string;
  readonly displayName: string;
  /** The provider model identity (opaque DATA — never shape vocabulary). */
  readonly modelIdentity: string;
  /** Ports sorted by name (input, output, and parameter ports). */
  readonly ports: readonly ParticipantPort[];
  /** Digest of the provider descriptor this participant was derived from. */
  readonly descriptorDigest: Sha256Hex;
  readonly contentDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// Deterministic step exchanges.
// ---------------------------------------------------------------------------

/** The participant state: one value per output port (the state vector). */
export interface ParticipantState {
  readonly schemaVersion: typeof FMI_ADAPTER_RECORD_VERSION;
  readonly participantId: string;
  readonly values: Readonly<Record<string, number>>;
  readonly stateDigest: Sha256Hex;
}

/**
 * One typed, deterministic step exchange: the inputs at step k, the
 * computed outputs, the participant state AFTER the step, and the
 * content-addressed step identity. Identical (participant, step number,
 * inputs, prior state) always produce identical step digests; a
 * replayed step key with identical content returns the sealed prior
 * step (`duplicate`); different content under the same key is the typed
 * `replay-conflict`.
 */
export interface StepExchange {
  readonly schemaVersion: typeof FMI_ADAPTER_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly participantId: string;
  readonly stepNumber: number;
  readonly inputs: Readonly<Record<string, number>>;
  readonly outputs: Readonly<Record<string, number>>;
  readonly parameters: Readonly<Record<string, number>>;
  readonly state: ParticipantState;
  readonly disposition: StepDisposition;
  readonly steppedAt: Timestamp;
  readonly stepDigest: Sha256Hex;
}

// ---------------------------------------------------------------------------
// The W005 simulator-registration derivation (the fabric-facing seam).
// ---------------------------------------------------------------------------

/**
 * The participant's W005 simulator registration: the typed declaration
 * a simulation fabric binds to (inputs/outputs as declared ports;
 * deterministic reproducibility; exact-revision registration digest).
 * The REAL simulation-protocol admission pipeline validates it (pinned
 * by the registration + fabric parity tests).
 */
export interface ParticipantSimulatorRegistration {
  readonly registration: SimulatorRegistration;
  readonly registrationDigest: Sha256Hex;
  /** The neutral participant the registration was derived from. */
  readonly participantId: string;
}
