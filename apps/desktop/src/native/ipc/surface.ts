/**
 * @epoch/desktop — the declared IPC surface of the native product (W048).
 *
 * THE NAMED NEGATIVE (a) ARTIFACT: the desktop app cannot bypass the
 * Action Gateway. This module declares the COMPLETE IPC surface of the
 * product as two closed lists:
 *
 *  1. `IPC_GATEWAY_OPERATIONS` — the semantic surface. EXACTLY the frozen
 *     32-operation Application Gateway vocabulary
 *     (`APPLICATION_GATEWAY_OPERATION_NAMES` from @epoch/client-runtime),
 *     never a superset: no kernel operation, no action-authority shortcut,
 *     no event append, no raw store access. Pinned by
 *     `test/native-ipc-surface.test.ts` (set equality BOTH directions +
 *     bridge refusal of unlisted operations + a static import scan: no
 *     semantic authority is imported outside the embedded-gateway
 *     transport module).
 *
 *  2. `IPC_HOST_COMMANDS` — the NON-semantic native host commands (window
 *     shell facilities: metadata, secure store, durable local projection
 *     storage, native file dialogs, file import/export, local-state wipe
 *     for recovery). These carry ZERO semantic state — they are the
 *     platform adapter surface (lock rule 13), and every payload that
 *     touches durable state is a client-runtime projection record
 *     (sessions/offline queue/projection cache), never semantic truth.
 */
import { APPLICATION_GATEWAY_OPERATION_NAMES } from '@epoch/client-runtime';
import type { GatewayOperationName } from '@epoch/client-runtime';

/**
 * The semantic IPC surface: EXACTLY the frozen Application Gateway
 * vocabulary (no additions, no removals — pinned by test in both
 * directions against @epoch/client-runtime).
 */
export const IPC_GATEWAY_OPERATIONS: readonly GatewayOperationName[] = [
  ...APPLICATION_GATEWAY_OPERATION_NAMES,
] as const;

/** True when an operation is on the declared IPC surface. */
export function isIpcGatewayOperation(name: string): name is GatewayOperationName {
  return (IPC_GATEWAY_OPERATIONS as readonly string[]).includes(name);
}

/**
 * The native host commands (non-semantic platform facilities). The Rust
 * host (src-tauri/src/commands.rs) registers EXACTLY this set; the test
 * battery pins the tauri.conf.json/commands.rs surface to this list so the
 * committed configs and the TypeScript bridge cannot drift apart.
 */
export const IPC_HOST_COMMANDS = [
  'epoch_app_meta',
  'epoch_secure_store_get',
  'epoch_secure_store_set',
  'epoch_secure_store_delete',
  'epoch_durable_get',
  'epoch_durable_set',
  'epoch_durable_delete',
  'epoch_durable_keys',
  'epoch_pick_open_file',
  'epoch_pick_save_file',
  'epoch_read_file_utf8',
  'epoch_write_file_utf8',
  'epoch_wipe_local_state',
] as const;

/** One native host command name. */
export type IpcHostCommand = (typeof IPC_HOST_COMMANDS)[number];
