/** @epoch/desktop — the native IPC seam (W048). */
export {
  IPC_GATEWAY_OPERATIONS,
  IPC_HOST_COMMANDS,
  isIpcGatewayOperation,
} from './surface';
export type { IpcHostCommand } from './surface';
export {
  BrowserHostCommands,
  HOST_APP_META,
  HostCommandError,
  MemoryHostCommands,
  TauriHostCommands,
  isTauriContext,
} from './host';
export type { DurableStore, FileFilter, HostAppMeta, HostCommandPort, SecureStore } from './host';
export {
  EmbeddedGatewayTransport,
  TauriGatewayTransport,
  connectorUnavailableError,
  createTransport,
} from './transport';
export type { GatewayTransport, GatewayTransportKind } from './transport';
export {
  BRIDGE_OPERATION_SURFACE,
  DesktopIpcBridge,
} from './bridge';
export type {
  BridgeCallOutcome,
  BridgeCallRequest,
  BridgeContext,
  BridgeNetworkDecision,
  DesktopIpcBridgeOptions,
  OfflineRouted,
} from './bridge';
