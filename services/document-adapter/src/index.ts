/**
 * @epoch/document-adapter-host — public API (service layer, W028).
 *
 * The long-running HOST MODEL of Document-to-Adapter: ingestion session
 * lifecycle (typed bytes in -> staged evidence out), the deterministic
 * advance-on-evidence stage driver with typed idempotency keys and
 * duplicate suppression, tenant-scoped reads, the trust-escalation
 * floor passthrough, and health/liveness as typed data.
 *
 * In-memory reference behavior: NO persistence, NO network, NO real
 * processes. The typed derivation model is @epoch/document-adapter
 * (kernel); evidence is stored in a REAL @epoch/evidence EvidenceStore
 * and provisional mappings register into a REAL @epoch/capability-registry
 * CapabilityRegistry (genuine runtime consumption, never authority
 * recreation).
 */

// Version + vocabularies.
export {
  DOCUMENT_ADAPTER_HOST_CONTRACT_VERSION,
  DOCUMENT_ADAPTER_SERVICE_NAME,
  HOST_ERROR_CODES,
  HOST_RECORD_VERSION,
  HOST_STATUSES,
  IDEMPOTENCY_KEY_PATTERN,
  SESSION_ID_PATTERN,
} from './version';
export type { HostErrorCode, HostStatus } from './version';

// Published contract types.
export type {
  ActingTenantId,
  AdvanceSessionInput,
  DocumentAdapterHostError,
  GetSessionInput,
  HealthReport,
  HostResult,
  HostTrustEscalationInput,
  IdempotencyKey,
  IngestDocumentInput,
  IngestionReceipt,
  ListSessionsInput,
  SessionCandidates,
  SessionId,
  SessionSnapshot,
  ServiceDescription,
  StageAdvance,
} from './types';

// The host.
export { DocumentAdapterHost, type DocumentAdapterHostOptions } from './host';

// Typed error helpers (the kernel taxonomy passes through unchanged).
export {
  HostSpecificErrorSchema,
  idempotencyConflict,
  isHostError,
  registrationConflict,
  unknownSession,
} from './errors';
