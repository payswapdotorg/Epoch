/**
 * COMPILE-TIME HOST PARITY (devDependency only — the W011 kernel-parity
 * precedent applied to the W013 sibling packages).
 *
 * This file pins structural compatibility between the renderer hosting
 * surface's device-session snapshot and the host model's device-session
 * record WITHOUT adding a runtime dependency: the snapshot's members are
 * asserted identical to the corresponding members of
 * @epoch/experience-runtime's DeviceSessionRecord. The runtime half of
 * the parity pin lives in test/host-parity.test.ts (real host sessions
 * project onto snapshots that admit, and the mirrored id grammars agree).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependency into every downstream consumer's compile graph. It is
 * compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**).
 */
import type { Equals, Expect } from './type-utils';
import type { DeviceSessionSnapshot } from './snapshot';
import type { DeviceSessionRecord } from '@epoch/experience-runtime';

/** The snapshot's session identity is the host record's session identity. */
export type DeviceSessionSnapshotIdParity = Expect<
  Equals<DeviceSessionSnapshot['deviceSessionId'], DeviceSessionRecord['deviceSessionId']>
>;

/** The snapshot's tenant scope is the host record's tenant scope. */
export type DeviceSessionSnapshotTenantParity = Expect<
  Equals<DeviceSessionSnapshot['tenantScope'], DeviceSessionRecord['tenantScope']>
>;

/** The snapshot's device descriptor is the host record's device descriptor. */
export type DeviceSessionSnapshotDeviceParity = Expect<
  Equals<DeviceSessionSnapshot['device'], DeviceSessionRecord['device']>
>;

/** The snapshot is exactly the projection of the host record it mirrors. */
export type DeviceSessionSnapshotProjectionParity = Expect<
  Equals<
    DeviceSessionSnapshot,
    Pick<DeviceSessionRecord, 'deviceSessionId' | 'tenantScope' | 'device'>
  >
>;
