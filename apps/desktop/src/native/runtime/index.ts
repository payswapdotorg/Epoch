/** @epoch/desktop — the native product runtime (W048). */
export {
  DEFAULT_PRODUCT_CONFIG,
  parseDesktopProductConfig,
} from './config';
export type { DesktopProductConfig } from './config';
export {
  DesktopOfflineQueue,
  OFFLINE_QUEUE_DURABLE_KEY,
} from './offline-queue';
export {
  DesktopProjectionCache,
  PROJECTION_CACHE_DURABLE_KEY,
} from './projection-cache';
export {
  DesktopSessionStore,
  SESSION_SECURE_KEY,
} from './session-store';
export {
  admitPersistedRecord,
  assertRequestProtocol,
  checkProtocolCompatibility,
  checkUpdateCandidate,
  protocolRefusalError,
  sealPersistedRecord,
} from './protocol-gate';
export type {
  PersistedRecordEnvelope,
  PersistedRecordOutcome,
  ProtocolRefusal,
  UpdateCandidate,
  UpdateCheckOutcome,
} from './protocol-gate';
export { DesktopPersistenceSession } from './persistence';
export { DesktopProduct } from './product';
export type {
  ActionCycleInput,
  AuthenticateInput,
  DesktopProductOptions,
  DiscoveryRunInput,
  OfflineIntentRequest,
  ProductResult,
  ProgramWorkflowInput,
  RealizeDeliveryInput,
  SupervisionInput,
} from './product';
export * from './view-models';
