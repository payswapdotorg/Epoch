/**
 * The device-session snapshot — the HOST-side input of a renderer session
 * binding.
 *
 * The device session itself (lifecycle, virtual clock, event history) is
 * the W013 host model owned by @epoch/experience-runtime; the hosting
 * surface binds against its VALUE PROJECTION: the session identity, the
 * owning tenant scope, and the W011 device descriptor (typed
 * capabilities/limits — the abstract slot W019 fills; adaptation is W019's
 * surface, NOT this package's). This keeps @epoch/renderer-runtime and
 * @epoch/experience-runtime siblings over the shared W011 vocabulary
 * (runtime dependency policy pin), with the projection pinned
 * member-for-member by compile-time and runtime parity tests
 * (src/host-parity.ts, test/host-parity.test.ts).
 */
import { z } from 'zod';
import { DeviceDescriptorSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import { DeviceSessionIdSchema } from './primitives';

/**
 * The typed value projection of a device session that a renderer binding
 * consumes. Liveness/freshness of the projected session is the composer's
 * responsibility (W016/W019); the snapshot is structural typed data.
 */
export const DeviceSessionSnapshotSchema = z
  .strictObject({
    deviceSessionId: DeviceSessionIdSchema,
    tenantScope: TenantScopeSchema,
    device: DeviceDescriptorSchema,
  })
  .meta({
    id: 'DeviceSessionSnapshot',
    title: 'DeviceSessionSnapshot',
    description:
      'The device-session value projection a renderer binding consumes: session identity, owning tenant scope, and the W011 device descriptor (capabilities/limits as typed data).',
  });

/** One device-session snapshot. */
export type DeviceSessionSnapshot = z.infer<typeof DeviceSessionSnapshotSchema>;

/**
 * Project an arbitrary record onto a device-session snapshot (total:
 * invalid projections yield a typed `malformed-record` error at the
 * binding admission, never a bare throw). Pure structural selection.
 */
export function deviceSessionSnapshotOf(value: {
  readonly deviceSessionId: unknown;
  readonly tenantScope: unknown;
  readonly device: unknown;
}): DeviceSessionSnapshot {
  return DeviceSessionSnapshotSchema.parse({
    deviceSessionId: value.deviceSessionId,
    tenantScope: value.tenantScope,
    device: value.device,
  });
}
