/**
 * @epoch/desktop — the native product surface (W048).
 *
 * The Tauri 2 adapter zone around the W017 experience surface: the typed
 * IPC/envelope bridge over the frozen 32-operation Application Gateway
 * vocabulary, the platform-safe session store, the durable offline queue
 * + projection cache (client-runtime seams), the protocol gate, the
 * embedded fixture-backed gateway binding, and the product composition
 * root (the journey-facing view-models the UI renders). The journey
 * HARNESS (runner + scenario inputs) lives under qa/desktop/ (the W048
 * pin-6 home) and drives this surface.
 *
 * The W017 typed reference library stays exported from the package root
 * (`@epoch/desktop` → src/index.ts, untouched); this subpath is the
 * native product addition.
 */
export * from './version';
export * from './ipc';
export * from './runtime';
export * from './embedded';
