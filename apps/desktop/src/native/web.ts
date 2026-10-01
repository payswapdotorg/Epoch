/**
 * @epoch/desktop — the WEBVIEW-safe product surface (W048).
 *
 * Everything the static-export frontend (app/) imports, WITHOUT the
 * Node-only fixture source (node:fs/node:crypto would break the browser
 * bundle). The packaged app composes the same product root as the journey
 * harness — one code path — through:
 *
 *   WebFixtureSource      (public/fixtures, sha256 re-verified at load)
 *   buildEmbeddedGateway  (the W046 single-process composition)
 *   EmbeddedGatewayTransport / TauriGatewayTransport
 *   BrowserHostCommands / TauriHostCommands / MemoryHostCommands
 *   DesktopProduct        (the view-model composition root)
 *
 * Node tooling (journeys, tests, scripts) imports '@epoch/desktop/native'
 * instead; this barrel exists purely for the client bundle boundary.
 */
export {
  FIXTURE_FILES,
  loadFixtureBundle,
  refuseFixtureDigestMismatch,
} from './embedded/fixture-source';
export type { FixtureBundle, FixtureDomain, FixtureRegistry, FixtureSource } from './embedded/fixture-source';
export { WebFixtureSource } from './embedded/web-fixture-source';
export { buildEmbeddedGateway } from './embedded/embedded-gateway';
export type { EmbeddedGatewayBinding, EmbeddedGatewayOptions } from './embedded/embedded-gateway';

export {
  BrowserHostCommands,
  HOST_APP_META,
  HostCommandError,
  MemoryHostCommands,
  TauriHostCommands,
  isTauriContext,
} from './ipc/host';
export type { DurableStore, FileFilter, HostAppMeta, HostCommandPort, SecureStore } from './ipc/host';
export {
  EmbeddedGatewayTransport,
  TauriGatewayTransport,
  connectorUnavailableError,
  createTransport,
} from './ipc/transport';
export type { GatewayTransport, GatewayTransportKind } from './ipc/transport';

export {
  DesktopPersistenceSession,
  DesktopProduct,
  parseDesktopProductConfig,
  DEFAULT_PRODUCT_CONFIG,
} from './runtime';
export type {
  AuthenticateInput,
  DesktopProductOptions,
  ProductResult,
  DesktopProductConfig,
} from './runtime';
export * from './runtime/view-models';
export {
  DESKTOP_GATEWAY_MODES,
  DESKTOP_PLATFORMS,
  DESKTOP_PRODUCT_VERSION,
  DESKTOP_HOST_PROTOCOL_VERSION,
  DESKTOP_GATEWAY_CONTRACT_VERSION,
  DESKTOP_PROTOCOL_ENVELOPE,
} from './version';
export type {
  DesktopGatewayMode,
  DesktopPlatform,
  DesktopProtocolEnvelope,
} from './version';
