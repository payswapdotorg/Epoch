/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-parity
 * precedent of W013/W015/W016/W036).
 *
 * This file pins structural compatibility between the device-capabilities
 * shapes and the sibling experience-layer vocabularies WITHOUT adding
 * runtime dependencies beyond the declared runtime set
 * (@epoch/agent-protocol, @epoch/experience-protocol, zod):
 *
 * - the assessed device slot is TYPE-EQUAL to the W013 device-session
 *   snapshot's device slot (@epoch/renderer-runtime — the snapshot the
 *   renderer hosting surface binds; the assessment assesses exactly the
 *   descriptor that travels in a session);
 * - the assessed device slot is TYPE-EQUAL to the W013 device-session
 *   record's device slot (@epoch/experience-runtime — the host model);
 * - the guided fidelity-level vocabulary is TYPE-EQUAL to the W016
 *   `WorldFidelityLevel` (the mirrored guidance vocabulary cannot drift;
 *   the correspondence stays guidance — the host chooses the level).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests
 * (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { DeviceCapabilityAssessment } from './assessment';
import type { GuidedFidelityLevel } from './version';
import type { DeviceSessionSnapshot } from '@epoch/renderer-runtime';
import type { DeviceSessionRecord } from '@epoch/experience-runtime';
import type { WorldFidelityLevel } from '@epoch/world-experience';

/** The assessed device slot is exactly the W013 snapshot's device slot. */
export type SnapshotDeviceParity = Expect<
  Equals<DeviceCapabilityAssessment['device'], DeviceSessionSnapshot['device']>
>;

/** The assessed device slot is exactly the host session record's device slot. */
export type SessionRecordDeviceParity = Expect<
  Equals<DeviceCapabilityAssessment['device'], DeviceSessionRecord['device']>
>;

/** The guided fidelity vocabulary is exactly the W016 fidelity vocabulary. */
export type GuidedFidelityParity = Expect<Equals<GuidedFidelityLevel, WorldFidelityLevel>>;
