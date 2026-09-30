/**
 * @epoch/desktop — the native host command port (W048).
 *
 * The platform-adapter seam for the NON-semantic host facilities: app
 * metadata, platform-safe credential/session storage (the OS secure
 * store), durable local projection storage, native file dialogs and
 * import/export, and local-state wipe. It is deliberately NOT a gateway:
 * nothing here can mutate semantic state (the named negative (a) set is
 * `IPC_HOST_COMMANDS` — metadata/storage/dialogs only).
 *
 * Three implementations of the SAME port:
 *  - `MemoryHostCommands` — deterministic in-memory (tests + headless
 *    journey runs; full durable round-trip semantics);
 *  - `BrowserHostCommands` — dev-server mode (browser without the Tauri
 *    shell): durable projections in localStorage, secure store in MEMORY
 *    ONLY (the documented safe fallback — a session token is NEVER
 *    written to a plaintext web store; reload forces re-authentication,
 *    exactly the J11 recovery path), dialogs unsupported (typed refusal);
 *  - `TauriHostCommands` — the packaged app: `invoke()` over the Rust
 *    command surface (OS keychain via the Rust `keyring` crate, app-data
 *    files for durable projections, native file dialogs).
 */
import { DESKTOP_PRODUCT_VERSION, DESKTOP_HOST_PROTOCOL_VERSION, type DesktopPlatform } from '../version';

/** One file-dialog filter (name + accepted extensions). */
export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

/** The app/host metadata the native shell reports (handshake + update checks). */
export interface HostAppMeta {
  readonly schemaVersion: 1;
  readonly productVersion: string;
  readonly hostProtocolVersion: string;
  readonly gatewayContractVersion: string;
  readonly platform: DesktopPlatform | 'unknown';
  readonly locale: string;
}

/**
 * The platform-safe secure store: session tokens and credential-shaped
 * values go HERE (OS keychain behind the Tauri command; memory-only safe
 * fallback in browser/dev mode) — never the durable store, never a
 * plaintext config file (W048 pin 5).
 */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/**
 * The durable local-projection store (client-runtime records only:
 * sessions mirror, offline queue, projection cache). Values are JSON
 * strings; the persistence seam (runtime/persistence.ts) layers the
 * typed record-store primitives on top.
 */
export interface DurableStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<readonly string[]>;
}

/** The native host command port (the complete non-semantic surface). */
export interface HostCommandPort {
  readonly kind: 'memory' | 'browser' | 'tauri';
  appMeta(): Promise<HostAppMeta>;
  readonly secure: SecureStore;
  readonly durable: DurableStore;
  pickOpenFile(filters?: readonly FileFilter[]): Promise<string | null>;
  pickSaveFile(defaultName?: string, filters?: readonly FileFilter[]): Promise<string | null>;
  readFileUtf8(path: string): Promise<string>;
  writeFileUtf8(path: string, content: string): Promise<void>;
  wipeLocalState(): Promise<void>;
}

/** One typed host-command failure (never a bare throw when avoidable). */
export class HostCommandError extends Error {
  constructor(
    readonly code:
      | 'host-unavailable'
      | 'secure-store-unavailable'
      | 'dialog-unavailable'
      | 'file-io-rejected'
      | 'host-protocol-mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'HostCommandError';
  }
}

/** The canonical app metadata (constant across host implementations). */
export const HOST_APP_META: HostAppMeta = {
  schemaVersion: 1,
  productVersion: DESKTOP_PRODUCT_VERSION,
  hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION,
  gatewayContractVersion: '1.0.0',
  platform: 'unknown',
  locale: 'en',
} as const;

// ---------------------------------------------------------------------------
// Memory host (tests + headless journeys).
// ---------------------------------------------------------------------------

/** The deterministic in-memory host (durable semantics, zero real I/O). */
export class MemoryHostCommands implements HostCommandPort {
  readonly kind = 'memory' as const;
  private readonly secureMap = new Map<string, string>();
  private readonly durableMap = new Map<string, string>();
  private readonly files = new Map<string, string>();
  private readonly pickedPaths: string[] = [];
  readonly platform: DesktopPlatform | 'unknown';
  /** Every write, in order (the no-second-store audit reads this). */
  readonly durableWriteLog: { key: string; value: string }[] = [];

  constructor(options: { readonly platform?: DesktopPlatform | 'unknown' } = {}) {
    this.platform = options.platform ?? 'unknown';
  }

  async appMeta(): Promise<HostAppMeta> {
    return { ...HOST_APP_META, platform: this.platform };
  }

  readonly secure: SecureStore = {
    get: async (key) => this.secureMap.get(key) ?? null,
    set: async (key, value) => {
      this.secureMap.set(key, value);
    },
    delete: async (key) => this.secureMap.delete(key),
  };

  readonly durable: DurableStore = {
    get: async (key) => this.durableMap.get(key) ?? null,
    set: async (key, value) => {
      this.durableMap.set(key, value);
      this.durableWriteLog.push({ key, value });
    },
    delete: async (key) => this.durableMap.delete(key),
    keys: async () => [...this.durableMap.keys()].sort(),
  };

  async pickOpenFile(): Promise<string | null> {
    return this.nextPickedPath();
  }

  async pickSaveFile(defaultName?: string): Promise<string | null> {
    return this.nextPickedPath() ?? (defaultName !== undefined ? `/tmp/${defaultName}` : null);
  }

  async readFileUtf8(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new HostCommandError('file-io-rejected', `no in-memory file at "${path}"`);
    }
    return content;
  }

  async writeFileUtf8(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  /** Seed an in-memory file (the dialog/picker simulation surface). */
  seedFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /** Queue the paths subsequent picks return (the dialog simulation). */
  queuePickedPaths(paths: readonly string[]): void {
    this.pickedPaths.push(...paths);
  }

  async wipeLocalState(): Promise<void> {
    this.secureMap.clear();
    this.durableMap.clear();
    this.durableWriteLog.length = 0;
  }

  private nextPickedPath(): string | null {
    return this.pickedPaths.shift() ?? null;
  }
}

// ---------------------------------------------------------------------------
// Browser host (dev-server mode: real UI, no native shell).
// ---------------------------------------------------------------------------

const BROWSER_DURABLE_PREFIX = 'epoch.durable.';

/** The dev-server browser host: localStorage projections, memory-only secure store. */
export class BrowserHostCommands implements HostCommandPort {
  readonly kind = 'browser' as const;

  async appMeta(): Promise<HostAppMeta> {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    return { ...HOST_APP_META, platform: isTauri ? 'unknown' : 'unknown', locale: navigatorLanguage() };
  }

  /**
   * MEMORY-ONLY secure store (the documented safe fallback): a browser
   * localStorage/sessionStorage value would be PLAINTEXT, which W048 pin 5
   * forbids for session tokens — so dev-server sessions are memory-only and
   * a reload forces re-authentication (the J11 path). `test/native-session-store.test.ts`
   * asserts no `session:` value ever lands in localStorage.
   */
  private readonly secureMap = new Map<string, string>();

  readonly secure: SecureStore = {
    get: async (key) => this.secureMap.get(key) ?? null,
    set: async (key, value) => {
      this.secureMap.set(key, value);
    },
    delete: async (key) => this.secureMap.delete(key),
  };

  readonly durable: DurableStore = {
    get: async (key) => window.localStorage.getItem(BROWSER_DURABLE_PREFIX + key),
    set: async (key, value) => {
      window.localStorage.setItem(BROWSER_DURABLE_PREFIX + key, value);
    },
    delete: async (key) => {
      const existed = window.localStorage.getItem(BROWSER_DURABLE_PREFIX + key) !== null;
      window.localStorage.removeItem(BROWSER_DURABLE_PREFIX + key);
      return existed;
    },
    keys: async () =>
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(BROWSER_DURABLE_PREFIX))
        .map((key) => key.slice(BROWSER_DURABLE_PREFIX.length))
        .sort(),
  };

  async pickOpenFile(): Promise<string | null> {
    // Dev-server mode: the visible UI offers the paste/import affordance
    // instead (the native picker is a packaged-app facility).
    throw new HostCommandError('dialog-unavailable', 'native file dialogs require the packaged Tauri host');
  }

  async pickSaveFile(): Promise<string | null> {
    throw new HostCommandError('dialog-unavailable', 'native file dialogs require the packaged Tauri host');
  }

  async readFileUtf8(): Promise<string> {
    throw new HostCommandError('file-io-rejected', 'host file reads require the packaged Tauri host');
  }

  async writeFileUtf8(): Promise<void> {
    throw new HostCommandError('file-io-rejected', 'host file writes require the packaged Tauri host');
  }

  async wipeLocalState(): Promise<void> {
    this.secureMap.clear();
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(BROWSER_DURABLE_PREFIX)) window.localStorage.removeItem(key);
    }
  }
}

function navigatorLanguage(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language;
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Tauri host (the packaged application).
// ---------------------------------------------------------------------------

/** The `invoke` shape from @tauri-apps/api/core (dynamically imported). */
type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

async function loadTauriInvoke(): Promise<TauriInvoke> {
  const core = (await import('@tauri-apps/api/core')) as { invoke: TauriInvoke };
  return core.invoke;
}

/**
 * The packaged-app host: every command is one `invoke()` over the Rust
 * surface (`IPC_HOST_COMMANDS`), so this module is the ONLY place the
 * native vendor toolkit appears in the product runtime (the adapter
 * boundary; the W017 reference library stays engine-free).
 */
export class TauriHostCommands implements HostCommandPort {
  readonly kind = 'tauri' as const;
  private readonly invoke: TauriInvoke;

  constructor(options: { readonly invoke?: TauriInvoke } = {}) {
    this.invoke =
      options.invoke ??
      ((cmd: string, args?: Record<string, unknown>) =>
        loadTauriInvoke().then((loaded) => loaded(cmd, args)));
  }

  async appMeta(): Promise<HostAppMeta> {
    const meta = (await this.invoke('epoch_app_meta')) as HostAppMeta;
    if (
      meta.schemaVersion !== 1 ||
      meta.hostProtocolVersion !== DESKTOP_HOST_PROTOCOL_VERSION
    ) {
      throw new HostCommandError(
        'host-protocol-mismatch',
        `the native host speaks protocol ${String(meta.hostProtocolVersion)} (expected ${DESKTOP_HOST_PROTOCOL_VERSION})`,
      );
    }
    return meta;
  }

  readonly secure: SecureStore = {
    get: async (key) => (await this.invoke('epoch_secure_store_get', { key })) as string | null,
    set: async (key, value) => {
      await this.invoke('epoch_secure_store_set', { key, value });
    },
    delete: async (key) => (await this.invoke('epoch_secure_store_delete', { key })) as boolean,
  };

  readonly durable: DurableStore = {
    get: async (key) => (await this.invoke('epoch_durable_get', { key })) as string | null,
    set: async (key, value) => {
      await this.invoke('epoch_durable_set', { key, value });
    },
    delete: async (key) => (await this.invoke('epoch_durable_delete', { key })) as boolean,
    keys: async () => (await this.invoke('epoch_durable_keys')) as string[],
  };

  async pickOpenFile(filters?: readonly FileFilter[]): Promise<string | null> {
    return (await this.invoke('epoch_pick_open_file', { filters: filters ?? [] })) as string | null;
  }

  async pickSaveFile(defaultName?: string, filters?: readonly FileFilter[]): Promise<string | null> {
    return (await this.invoke('epoch_pick_save_file', { defaultName: defaultName ?? null, filters: filters ?? [] })) as
      | string
      | null;
  }

  async readFileUtf8(path: string): Promise<string> {
    return (await this.invoke('epoch_read_file_utf8', { path })) as string;
  }

  async writeFileUtf8(path: string, content: string): Promise<void> {
    await this.invoke('epoch_write_file_utf8', { path, content });
  }

  async wipeLocalState(): Promise<void> {
    await this.invoke('epoch_wipe_local_state');
  }
}

/** Detect whether the running context is inside the Tauri webview. */
export function isTauriContext(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
