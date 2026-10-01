/**
 * @epoch/desktop — the platform-safe session store (W048 pin 5).
 *
 * Session tokens (the session reference the bridge binds) go to the
 * OS-appropriate secure store — the Rust `keyring` crate behind the
 * `epoch_secure_store_*` commands in the packaged app (Secret Service on
 * Linux, Credential Manager on Windows, Keychain on macOS). The
 * documented SAFE FALLBACK outside the native shell (dev-server browser
 * mode) is MEMORY-ONLY: reload forces re-authentication. Session material
 * is NEVER written to the durable store, localStorage, or a plaintext
 * config file — `test/native-session-store.test.ts` scans every durable
 * write and asserts the invariant.
 */
import type { ClientSession, SessionRef, TenantScope } from '@epoch/client-runtime';
import { admitPersistedRecord, sealPersistedRecord, type PersistedRecordOutcome } from './protocol-gate';
import type { HostCommandPort } from '../ipc/host';

/** The durable key under which the session record is secured. */
export const SESSION_SECURE_KEY = 'epoch.session.v1';

/** The session store: persist/restore/clear through the secure seam. */
export class DesktopSessionStore {
  constructor(private readonly host: HostCommandPort) {}

  /**
   * Persist the active session reference through the SECURE store only.
   * The payload is the protocol-sealed session record (J12: a compatible
   * relaunch restores it; an incompatible one refuses + re-authenticates).
   */
  async persist(session: ClientSession): Promise<void> {
    await this.host.secure.set(SESSION_SECURE_KEY, JSON.stringify(sealPersistedRecord(session)));
  }

  /**
   * Restore the persisted session (relaunch). Returns null when absent,
   * REFUSED-and-discarded when the persisted protocol envelope is
   * incompatible with this build (the caller re-authenticates), or the
   * restored session when compatible.
   */
  async restore(): Promise<PersistedRecordOutcome<ClientSession> | { readonly absent: true }> {
    const raw = await this.host.secure.get(SESSION_SECURE_KEY);
    if (raw === null || raw === '') return { absent: true };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { absent: true };
    }
    return admitPersistedRecord<ClientSession>(parsed);
  }

  /** Clear the persisted session (sign-out / wipe / re-auth). */
  async clear(): Promise<void> {
    await this.host.secure.delete(SESSION_SECURE_KEY);
  }

  /** The bridge context projection of a client session. */
  static bridgeContextOf(session: ClientSession): { session: SessionRef; tenant: TenantScope } {
    return {
      session: { schemaVersion: 1, sessionId: session.sessionId },
      tenant: {
        tenantId: session.tenantId,
        ...(session.workspaceId !== undefined ? { workspaceId: session.workspaceId } : {}),
        ...(session.projectId !== undefined ? { projectId: session.projectId } : {}),
      },
    };
  }
}
