/**
 * @epoch/mobile — the W049 product runtime public API.
 *
 * The native field product is composed of:
 *  - the W018 typed field-shell contracts (the package's original surface,
 *    unchanged — see src/index.ts);
 *  - THIS module: the W049 product runtime — the typed Application Gateway
 *    client bridge, the platform seams (secure store, camera, network),
 *    the digest-addressed evidence pipeline, the offline
 *    queue/reconnect/idempotent-sync controller, the capture pipeline
 *    (W018 envelopes -> W038 authority intake), the fixture gateway
 *    bootstrap, and the field host engine.
 *
 * Everything here is platform-neutral typed TypeScript (node-testable,
 * bundleable by the native toolchain); the native application (native/)
 * binds the platform adapters through the structural seams
 * (native/platform-bindings.ts) and carries the stable product identity
 * (native/identifiers.ts) — provider vocabulary lives ONLY there (lock
 * rule 13: provider-specific behavior is adapterized).
 */
export {
  sha256Bytes,
  sha256Hex,
  sha256Text,
} from './sha256';

export {
  SECURE_STORE_KEYS,
  MemorySecureStore,
} from './secure-store';
export type { SecureStoreKey, SecureStorePort } from './secure-store';

export {
  MemoryCameraPort,
  decodeBase64ToBytes,
} from './camera';
export type { CapturePhotoOptions, FieldCameraPort, FieldPhotoCapture } from './camera';

export {
  CorrelationSequence,
  bindInProcessGateway,
  stableJsonStringify,
} from './gateway-client';
export type { GatewayClient, GatewayClientOptions, MobileCallResult, MobileClock, MobileGatewayTransport } from './gateway-client';

export {
  buildFixtureGateway,
  defaultFieldDeviceDescriptor,
  deviceDescriptorDigestOf,
  fixtureAuthenticationResult,
  fixtureDeliveryId,
  fixtureProgram,
  fixtureSolutionId,
  fixtureWorldDigest,
  fixtureAuthorizationFacts,
  restoreTenancyHierarchy,
} from './fixture-gateway';
export type {
  BuildFixtureGatewayOptions,
  FieldFixtureRecords,
  FixturePrincipal,
  SeededGateway,
} from './fixture-gateway';

export {
  captureEvidence,
  encodeBase64,
} from './evidence-capture';
export type { CapturedEvidence, EvidenceCaptureResult } from './evidence-capture';

export {
  OfflineAwareReplayPort,
  OfflineController,
  ScriptedNetworkState,
  gatewayReplayPort,
} from './offline';
export type {
  FieldIntentInput,
  IdempotentSyncReport,
  IntentAdmission,
  NetworkStatePort,
  ReplayProof,
  SyncNowOptions,
} from './offline';

export {
  evidenceRefsOf,
  projectProgram,
  resolveCaptureAnchor,
  toDeliveryObservePayload,
  w038EvidenceKindOf,
} from './capture-pipeline';
export type {
  ActivityProjection,
  CaptureAnchor,
  FieldEvidenceLinkPayload,
  MilestoneProjection,
  ProgramProjections,
  ResolvedAnchor,
  WorkPackageProjection,
} from './capture-pipeline';

export {
  buildFieldDeviceIdentity,
} from './host-identity';
export type { FieldDeviceIdentity } from './host-identity';

export { MobileFieldHost } from './field-host';
export type {
  CaptureObservationInput,
  CaptureObservationResult,
  CrossDeviceState,
  MobileFieldHostOptions,
  MobileProductError,
  PersistedSessionRecord,
  ProductEffect,
  ProductRead,
} from './field-host';
