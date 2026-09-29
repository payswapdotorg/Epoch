/**
 * The Developer Portal schema-surface registry: every portal-OWNED data
 * type published at the `@epoch/developer-portal-host` ownership boundary,
 * paired with its zod schema.
 *
 * W025 owns no top-level `contracts/` *package*; the versioned contract
 * surface is the declaration-only tree under `contracts/` (the W012
 * convention — index.d.ts + manifest.json + parity.ts + schemas/, NO
 * package.json), and this ordered surface is its deterministic emission
 * source: `src/contract-emission.ts` renders the JSON Schema projection,
 * `contracts/parity.ts` pins the declaration types, and
 * `test/contract-drift.test.ts` proves the committed artifacts under
 * `contracts/schemas/` are byte-identical to the emission.
 *
 * Upstream record types (W007 capability records, W023 sealed listing
 * versions / grants / revenue, W024 billing accounts) are the owning
 * packages' contracts and are deliberately NOT re-schema'd here.
 */
import type { ZodType } from 'zod';
import {
  ListingCreatedDataSchema,
  ListingRetiredDataSchema,
  ListingSubmittedDataSchema,
  DraftUpdatedDataSchema,
  GrantAdoptedDataSchema,
  GrantRevokedDataSchema,
  RevenueAdoptedDataSchema,
  BillingAccountAdoptedDataSchema,
  VersionPublishedDataSchema,
  PortalCausalParentSchema,
  PortalEventPayloadSchema,
  PortalEventContentSchema,
  PortalEventSequenceSchema,
  SealedPortalEventSchema,
} from './events';
import {
  AdoptionReceiptSchema,
  ChainSummarySchema,
  DeveloperDashboardSchema,
  HealthReportSchema,
  ListingCreationReceiptSchema,
  ListingSnapshotSchema,
  PayoutAccountSummarySchema,
  PublicationReceiptSchema,
  ServiceDescriptionSchema,
} from './projections';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The ordered portal-owned schema surface. */
export const DEVELOPER_PORTAL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Events (W010-shaped).
  { type: 'PortalEventSequence', schema: PortalEventSequenceSchema },
  { type: 'PortalCausalParent', schema: PortalCausalParentSchema },
  { type: 'PortalEventPayload', schema: PortalEventPayloadSchema },
  { type: 'PortalEventContent', schema: PortalEventContentSchema },
  { type: 'SealedPortalEvent', schema: SealedPortalEventSchema },
  { type: 'ListingCreatedData', schema: ListingCreatedDataSchema },
  { type: 'DraftUpdatedData', schema: DraftUpdatedDataSchema },
  { type: 'ListingSubmittedData', schema: ListingSubmittedDataSchema },
  { type: 'VersionPublishedData', schema: VersionPublishedDataSchema },
  { type: 'ListingRetiredData', schema: ListingRetiredDataSchema },
  { type: 'GrantAdoptedData', schema: GrantAdoptedDataSchema },
  { type: 'GrantRevokedData', schema: GrantRevokedDataSchema },
  { type: 'RevenueAdoptedData', schema: RevenueAdoptedDataSchema },
  { type: 'BillingAccountAdoptedData', schema: BillingAccountAdoptedDataSchema },
  // Host records.
  { type: 'ListingCreationReceipt', schema: ListingCreationReceiptSchema },
  { type: 'PublicationReceipt', schema: PublicationReceiptSchema },
  { type: 'AdoptionReceipt', schema: AdoptionReceiptSchema },
  { type: 'ListingSnapshot', schema: ListingSnapshotSchema },
  { type: 'ChainSummary', schema: ChainSummarySchema },
  { type: 'PayoutAccountSummary', schema: PayoutAccountSummarySchema },
  { type: 'DeveloperDashboard', schema: DeveloperDashboardSchema },
  { type: 'HealthReport', schema: HealthReportSchema },
  { type: 'ServiceDescription', schema: ServiceDescriptionSchema },
];
