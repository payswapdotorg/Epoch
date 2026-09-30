/**
 * The application-gateway schema surface registry: every data type
 * published at the `@epoch/client-runtime` ownership boundary, paired
 * with its zod schema. This is THE declared public contract surface —
 * `contracts/application-gateway/manifest.json` records exactly these
 * types, and the drift + parity tests pin the committed artifacts to this
 * registry (W046 pin 1: "manifest + per-contract digests + parity self
 * check ... proving public surface == declared manifest").
 */
import { z } from 'zod';
import {
  APPLICATION_GATEWAY_CONTRACT_VERSION,
  APPLICATION_GATEWAY_OPERATION_NAMES,
  CLIENT_RUNTIME_CONTRACT_VERSION,
  CLIENT_RUNTIME_RECORD_VERSION,
  GATEWAY_OPERATION_KINDS,
  OFFLINE_ADMISSION_CODES,
  OFFLINE_INTENT_STATES,
} from './version';
import {
  CLIENT_RECOVERY_ACTIONS,
  GatewayErrorClassSchema,
  GatewayErrorCodeSchema,
  GatewayErrorSchema,
  GatewayValidationIssueSchema,
} from './errors';
import { CausationIdSchema, CorrelationIdSchema, GatewayOriginSchema, RequestCorrelationSchema } from './correlation';
import { ClientSessionSchema, ClientSessionStateSchema, SessionIdSchema, SessionRefSchema } from './session';
import {
  IdempotencyAddressSchema,
  IdempotencyKeySchema,
  IdempotencyRecordSchema,
  IdempotentReplaySchema,
  RequestFingerprintSchema,
} from './idempotency';
import { OfflineQueueScopeSchema, QueuedIntentSchema } from './offline';
import {
  GatewayOperationNameSchema,
  GatewayOutcomeSchema,
  GatewayRequestEnvelopeSchema,
  TenantScopeSchema,
} from './transport';
import { ProjectionCacheEntrySchema } from './projection';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: z.ZodType;
}

// Version/vocabulary schemas (declared here; single source in ./version).

const ApplicationGatewayContractVersionSchema = z
  .literal(APPLICATION_GATEWAY_CONTRACT_VERSION)
  .meta({
    id: 'ApplicationGatewayContractVersion',
    title: 'ApplicationGatewayContractVersion',
    description: 'Version of the published application-gateway contract surface.',
  });

const ClientRuntimeRecordVersionSchema = z.literal(CLIENT_RUNTIME_RECORD_VERSION).meta({
  id: 'ClientRuntimeRecordVersion',
  title: 'ClientRuntimeRecordVersion',
  description: 'Version discriminator carried by every serialized client-runtime record (currently 1).',
});

const ClientRuntimeContractVersionSchema = z.literal(CLIENT_RUNTIME_CONTRACT_VERSION).meta({
  id: 'ClientRuntimeContractVersion',
  title: 'ClientRuntimeContractVersion',
  description: 'Version of the client-runtime machinery (queues, replay, projection cache).',
});

const GatewayOperationKindSchema = z
  .enum(GATEWAY_OPERATION_KINDS)
  .meta({ id: 'GatewayOperationKind', title: 'GatewayOperationKind' });

const GatewayOperationSchema = z
  .strictObject({
    name: GatewayOperationNameSchema,
    kind: GatewayOperationKindSchema,
    queueable: z.boolean(),
    description: z.string().min(1).max(512),
  })
  .readonly()
  .meta({ id: 'GatewayOperation', title: 'GatewayOperation' });

const OfflineAdmissionCodeSchema = z
  .enum(OFFLINE_ADMISSION_CODES)
  .meta({ id: 'OfflineAdmissionCode', title: 'OfflineAdmissionCode' });

const OfflineIntentStateSchema = z
  .enum(OFFLINE_INTENT_STATES)
  .meta({ id: 'OfflineIntentState', title: 'OfflineIntentState' });

const ClientRecoveryActionSchema = z
  .enum(CLIENT_RECOVERY_ACTIONS)
  .meta({ id: 'ClientRecoveryAction', title: 'ClientRecoveryAction' });

const GatewayOperationVocabularySchema = z
  .array(GatewayOperationNameSchema)
  .readonly()
  .meta({ id: 'GatewayOperationVocabulary', title: 'GatewayOperationVocabulary' });

/** The complete, ordered data-type surface of the application-gateway contract v1. */
export const APPLICATION_GATEWAY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Versions + vocabularies.
  { type: 'ApplicationGatewayContractVersion', schema: ApplicationGatewayContractVersionSchema },
  { type: 'ClientRuntimeRecordVersion', schema: ClientRuntimeRecordVersionSchema },
  { type: 'ClientRuntimeContractVersion', schema: ClientRuntimeContractVersionSchema },
  { type: 'GatewayOrigin', schema: GatewayOriginSchema },
  { type: 'GatewayOperationKind', schema: GatewayOperationKindSchema },
  { type: 'GatewayOperationName', schema: GatewayOperationNameSchema },
  { type: 'GatewayOperationVocabulary', schema: GatewayOperationVocabularySchema },
  { type: 'GatewayOperation', schema: GatewayOperationSchema },
  { type: 'OfflineAdmissionCode', schema: OfflineAdmissionCodeSchema },
  { type: 'OfflineIntentState', schema: OfflineIntentStateSchema },
  // Error taxonomy.
  { type: 'GatewayErrorClass', schema: GatewayErrorClassSchema },
  { type: 'GatewayErrorCode', schema: GatewayErrorCodeSchema },
  { type: 'GatewayValidationIssue', schema: GatewayValidationIssueSchema },
  { type: 'GatewayError', schema: GatewayErrorSchema },
  { type: 'ClientRecoveryAction', schema: ClientRecoveryActionSchema },
  // Correlation.
  { type: 'CorrelationId', schema: CorrelationIdSchema },
  { type: 'CausationId', schema: CausationIdSchema },
  { type: 'RequestCorrelation', schema: RequestCorrelationSchema },
  // Session.
  { type: 'ClientSessionState', schema: ClientSessionStateSchema },
  { type: 'SessionId', schema: SessionIdSchema },
  { type: 'ClientSession', schema: ClientSessionSchema },
  { type: 'SessionRef', schema: SessionRefSchema },
  // Idempotency.
  { type: 'IdempotencyKey', schema: IdempotencyKeySchema },
  { type: 'RequestFingerprint', schema: RequestFingerprintSchema },
  { type: 'IdempotencyAddress', schema: IdempotencyAddressSchema },
  { type: 'IdempotencyRecord', schema: IdempotencyRecordSchema },
  { type: 'IdempotentReplay', schema: IdempotentReplaySchema },
  // Offline admission.
  { type: 'OfflineQueueScope', schema: OfflineQueueScopeSchema },
  { type: 'QueuedIntent', schema: QueuedIntentSchema },
  // Transport.
  { type: 'TenantScope', schema: TenantScopeSchema },
  { type: 'GatewayRequestEnvelope', schema: GatewayRequestEnvelopeSchema },
  { type: 'GatewayOutcome', schema: GatewayOutcomeSchema },
  // Projection cache.
  { type: 'ProjectionCacheEntry', schema: ProjectionCacheEntrySchema },
];

/** The declared data types (ordered, exactly the manifest dataTypes). */
export const APPLICATION_GATEWAY_DATA_TYPES: readonly string[] =
  APPLICATION_GATEWAY_SCHEMA_SURFACE.map((entry) => entry.type);

/** Validate the frozen operation vocabulary against the registry (surface invariant). */
export const SURFACE_OPERATION_VOCABULARY: readonly string[] = APPLICATION_GATEWAY_OPERATION_NAMES;
