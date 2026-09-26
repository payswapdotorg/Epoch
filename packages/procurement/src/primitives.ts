/**
 * Provider-neutral zod primitives of the procurement kernel. Every schema
 * here is a JSON-representable data shape; no field encodes a vendor,
 * brand, marketplace, ERP or API surface (architecture lock rule 13).
 * Supplier identity is an OPAQUE id (`supplier:<slug>`) — never a vendor
 * name in core types.
 *
 * Composition policy (the W036 runtime-composition precedent): shared
 * grammars are REUSED from @epoch/solution-delivery — the digest grammar,
 * timestamps, principals, tenant scope, solution/work-package/solution-
 * line ids, distinction record ids, currency codes, non-negative
 * decimals, units, opaque references and positive integers (genuine
 * runtime composition over the W036 kernel, never a mirror). The
 * procurement-specific id grammars (lineage, package, quote, selection,
 * po, po-transition, substitution, supplier) are defined here. Digest
 * machinery (canonicalDigest, sha256Hex) comes from
 * @epoch/agent-protocol (the shared protocol primitives, as in W036).
 */
import { z } from 'zod';
import { canonicalDigest, sha256Hex } from '@epoch/agent-protocol';
import {
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import {
  LINEAGE_ID_PATTERN,
  PACKAGE_ID_PATTERN,
  PO_ID_PATTERN,
  PO_TRANSITION_ID_PATTERN,
  PROCUREMENT_PRINCIPAL_ID_PATTERN,
  PROCUREMENT_STREAM_ID_PATTERN,
  QUOTE_ID_PATTERN,
  SELECTION_ID_PATTERN,
  SUBSTITUTION_ID_PATTERN,
  SUPPLIER_ID_PATTERN,
} from './version';

// Digest machinery (composed from the shared protocol primitives).
export { canonicalDigest, sha256Hex };

/**
 * Acquisition request identity — MIRRORED from the W036
 * `ACQUISITION_ID_PATTERN` grammar (`acquisition:<slug>`); pinned by the
 * runtime parity test (REAL W036 acquisition-request ids validate).
 */
export const AcquisitionIdSchema = z
  .string()
  .regex(/^acquisition:[a-z0-9][a-z0-9-]{0,62}$/, 'must be an acquisition id of the form "acquisition:<slug>"')
  .meta({
    id: 'AcquisitionId',
    title: 'AcquisitionId',
    description:
      'Opaque acquisition-request identity: "acquisition:" followed by a lowercase slug (the W036 grammar).',
  });

/** One acquisition id. */
export type AcquisitionId = z.infer<typeof AcquisitionIdSchema>;

/** Requirement-lineage record identity: `lineage:<slug>`. */
export const LineageIdSchema = z
  .string()
  .regex(LINEAGE_ID_PATTERN, 'must be a lineage id of the form "lineage:<slug>"')
  .meta({
    id: 'LineageId',
    title: 'LineageId',
    description: 'Opaque requirement-lineage record identity: "lineage:" followed by a lowercase slug.',
  });

/** One lineage id. */
export type LineageId = z.infer<typeof LineageIdSchema>;

/** Acquisition-package record identity: `package:<slug>`. */
export const PackageIdSchema = z
  .string()
  .regex(PACKAGE_ID_PATTERN, 'must be a package id of the form "package:<slug>"')
  .meta({
    id: 'PackageId',
    title: 'PackageId',
    description: 'Opaque acquisition-package identity: "package:" followed by a lowercase slug.',
  });

/** One package id. */
export type PackageId = z.infer<typeof PackageIdSchema>;

/** Quote record identity: `quote:<slug>`. */
export const QuoteIdSchema = z
  .string()
  .regex(QUOTE_ID_PATTERN, 'must be a quote id of the form "quote:<slug>"')
  .meta({
    id: 'QuoteId',
    title: 'QuoteId',
    description: 'Opaque supplier-quote identity: "quote:" followed by a lowercase slug.',
  });

/** One quote id. */
export type QuoteId = z.infer<typeof QuoteIdSchema>;

/** Quote-selection record identity: `selection:<slug>`. */
export const SelectionIdSchema = z
  .string()
  .regex(SELECTION_ID_PATTERN, 'must be a selection id of the form "selection:<slug>"')
  .meta({
    id: 'SelectionId',
    title: 'SelectionId',
    description: 'Opaque quote-selection identity: "selection:" followed by a lowercase slug.',
  });

/** One selection id. */
export type SelectionId = z.infer<typeof SelectionIdSchema>;

/** Purchase-order record identity: `po:<slug>`. */
export const PoIdSchema = z
  .string()
  .regex(PO_ID_PATTERN, 'must be a purchase-order id of the form "po:<slug>"')
  .meta({
    id: 'PoId',
    title: 'PoId',
    description: 'Opaque purchase-order identity: "po:" followed by a lowercase slug.',
  });

/** One purchase-order id. */
export type PoId = z.infer<typeof PoIdSchema>;

/** Supplier-delivery transition record identity: `po-transition:<slug>`. */
export const PoTransitionIdSchema = z
  .string()
  .regex(PO_TRANSITION_ID_PATTERN, 'must be a transition id of the form "po-transition:<slug>"')
  .meta({
    id: 'PoTransitionId',
    title: 'PoTransitionId',
    description:
      'Opaque supplier-delivery transition identity: "po-transition:" followed by a lowercase slug.',
  });

/** One transition id. */
export type PoTransitionId = z.infer<typeof PoTransitionIdSchema>;

/** Substitution record identity: `substitution:<slug>`. */
export const SubstitutionIdSchema = z
  .string()
  .regex(SUBSTITUTION_ID_PATTERN, 'must be a substitution id of the form "substitution:<slug>"')
  .meta({
    id: 'SubstitutionId',
    title: 'SubstitutionId',
    description: 'Opaque substitution-request identity: "substitution:" followed by a lowercase slug.',
  });

/** One substitution id. */
export type SubstitutionId = z.infer<typeof SubstitutionIdSchema>;

/** Opaque supplier identity: `supplier:<slug>` (never a vendor name). */
export const SupplierIdSchema = z
  .string()
  .regex(SUPPLIER_ID_PATTERN, 'must be a supplier id of the form "supplier:<slug>"')
  .meta({
    id: 'SupplierId',
    title: 'SupplierId',
    description:
      'Opaque supplier identity: "supplier:" followed by a lowercase slug — provider-neutral, never a vendor name.',
  });

/** One supplier id. */
export type SupplierId = z.infer<typeof SupplierIdSchema>;

/** Procurement event stream identity (the W010 stream grammar, mirrored). */
export const ProcurementStreamIdSchema = z
  .string()
  .regex(PROCUREMENT_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"')
  .meta({
    id: 'ProcurementStreamId',
    title: 'ProcurementStreamId',
    description:
      'Opaque procurement-event stream identity: "stream:" followed by a lowercase slug (the W010 stream grammar).',
  });

/** One procurement stream id. */
export type ProcurementStreamId = z.infer<typeof ProcurementStreamIdSchema>;

/** Acting principal identity (the W009/W010 grammar, mirrored). */
export const ProcurementPrincipalIdSchema = z
  .string()
  .regex(
    PROCUREMENT_PRINCIPAL_ID_PATTERN,
    'must be a principal id of the form "principal:<slug>"',
  )
  .meta({
    id: 'ProcurementPrincipalId',
    title: 'ProcurementPrincipalId',
    description: 'Opaque acting principal: "principal:" followed by a lowercase slug (W009 identity grammar).',
  });

/** One procurement principal id. */
export type ProcurementPrincipalId = z.infer<typeof ProcurementPrincipalIdSchema>;

// Shared W036 grammars re-exported for the package surface (runtime
// composition — the W036 kernel's own public surface).
export {
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
};
export type {
  CurrencyCode,
  DeliveryId,
  DistinctionRecordId,
  NonNegativeDecimal,
  OpaqueReference,
  PositiveInteger,
  PrincipalId,
  SolutionId,
  SolutionLineId,
  Timestamp,
  UnitLabel,
  WorkPackageId,
} from '@epoch/solution-delivery';
export type { Sha256Hex } from '@epoch/agent-protocol';
export { TenantIdSchema } from '@epoch/solution-delivery';
export type { TenantId } from '@epoch/solution-delivery';
