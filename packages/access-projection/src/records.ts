/**
 * The canonical record surface: the FOUR sealed W036 record families a
 * projection can be computed over, as one typed discriminated union on
 * `objectClass`, plus the identity accessors (the SAME record id and
 * content digest the projection carries — projections never mint
 * identities) and the total verification bridge onto the REAL W036
 * verify pipelines (this kernel never re-implements W036 validation).
 */
import { z } from 'zod';
import {
  SealedDeliveryRecordSchema,
  SealedDistinctionRecordSchema,
  SealedProgramOfWorkSchema,
  SealedSolutionVersionSchema,
  verifySealedDeliveryRecord,
  verifySealedDistinctionRecord,
  verifySealedProgramOfWork,
  verifySealedSolutionVersion,
} from '@epoch/solution-delivery';
import type {
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  SealedProgramOfWork,
  SealedSolutionVersion,
} from '@epoch/solution-delivery';
import { OBJECT_CLASSES, type ObjectClass } from './version';
import { adaptDeliveryResult } from './w036-adapter';
import type { AccessProjectionResult } from './errors';
import type { ZodType } from 'zod';

/** One canonical program-of-work record (W036, sealed). */
export type CanonicalProgramRecord = Readonly<{
  objectClass: 'program-of-work';
  record: SealedProgramOfWork;
}>;

/** One canonical delivery record (W036, sealed). */
export type CanonicalDeliveryRecord = Readonly<{
  objectClass: 'delivery-record';
  record: SealedDeliveryRecord;
}>;

/** One canonical solution version (W036, sealed, hash-chained). */
export type CanonicalSolutionVersionRecord = Readonly<{
  objectClass: 'solution-version';
  record: SealedSolutionVersion;
}>;

/** One canonical semantic-distinction record (W036, sealed). */
export type CanonicalDistinctionRecord = Readonly<{
  objectClass: 'distinction-record';
  record: SealedDistinctionRecord;
}>;

/** One canonical record reference: the W011 projected-reference convention. */
export type CanonicalRecord =
  | CanonicalProgramRecord
  | CanonicalDeliveryRecord
  | CanonicalSolutionVersionRecord
  | CanonicalDistinctionRecord;

/** The zod union of canonical records (class-tagged, strict). */
export const CanonicalRecordSchema = z
  .discriminatedUnion('objectClass', [
    z
      .strictObject({
        objectClass: z.literal('program-of-work'),
        record: SealedProgramOfWorkSchema,
      })
      .readonly(),
    z
      .strictObject({
        objectClass: z.literal('delivery-record'),
        record: SealedDeliveryRecordSchema,
      })
      .readonly(),
    z
      .strictObject({
        objectClass: z.literal('solution-version'),
        record: SealedSolutionVersionSchema,
      })
      .readonly(),
    z
      .strictObject({
        objectClass: z.literal('distinction-record'),
        record: SealedDistinctionRecordSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'CanonicalRecord',
    title: 'CanonicalRecord',
    description:
      'One canonical sealed W036 record tagged by object class — the object a projection is computed over.',
  });

/** The exact-revision identity of one canonical record. */
export interface CanonicalObjectIdentity {
  readonly objectClass: ObjectClass;
  readonly objectId: string;
  readonly objectDigest: string;
}

/** The stable semantic identity of one canonical record (id + digest). */
export function canonicalObjectIdentity(canonical: CanonicalRecord): CanonicalObjectIdentity {
  switch (canonical.objectClass) {
    case 'program-of-work':
      return {
        objectClass: canonical.objectClass,
        objectId: canonical.record.programId,
        objectDigest: canonical.record.contentDigest,
      };
    case 'delivery-record':
      return {
        objectClass: canonical.objectClass,
        objectId: canonical.record.deliveryId,
        objectDigest: canonical.record.contentDigest,
      };
    case 'solution-version':
      return {
        objectClass: canonical.objectClass,
        objectId: canonical.record.solutionId,
        objectDigest: canonical.record.contentDigest,
      };
    case 'distinction-record':
      return {
        objectClass: canonical.objectClass,
        objectId: canonical.record.recordId,
        objectDigest: canonical.record.contentDigest,
      };
  }
}

/** The tenant scope of one canonical record. */
export function canonicalTenantId(canonical: CanonicalRecord): string {
  return canonical.record.tenantId;
}

/** The sealed W036 record schema of one object class (drives the field walk). */
export function canonicalRecordSchemaOf(objectClass: ObjectClass): ZodType {
  switch (objectClass) {
    case 'program-of-work':
      return SealedProgramOfWorkSchema;
    case 'delivery-record':
      return SealedDeliveryRecordSchema;
    case 'solution-version':
      return SealedSolutionVersionSchema;
    case 'distinction-record':
      return SealedDistinctionRecordSchema;
  }
}

/** Parse + verify one canonical record through the REAL W036 pipelines. */
export function verifyCanonicalRecord(
  canonical: CanonicalRecord,
): AccessProjectionResult<CanonicalRecord> {
  switch (canonical.objectClass) {
    case 'program-of-work': {
      const verified = verifySealedProgramOfWork(canonical.record);
      if (!verified.ok) return adaptDeliveryResult(verified, canonical.record.programId);
      return { ok: true, value: canonical };
    }
    case 'delivery-record': {
      const verified = verifySealedDeliveryRecord(canonical.record);
      if (!verified.ok) return adaptDeliveryResult(verified, canonical.record.deliveryId);
      return { ok: true, value: canonical };
    }
    case 'solution-version': {
      const verified = verifySealedSolutionVersion(canonical.record);
      if (!verified.ok) return adaptDeliveryResult(verified, canonical.record.solutionId);
      return { ok: true, value: canonical };
    }
    case 'distinction-record': {
      const verified = verifySealedDistinctionRecord(canonical.record);
      if (!verified.ok) return adaptDeliveryResult(verified, canonical.record.recordId);
      return { ok: true, value: canonical };
    }
  }
}

/** Whether one object class is a member of the closed canonical set. */
export function isObjectClass(value: string): value is ObjectClass {
  return (OBJECT_CLASSES as readonly string[]).includes(value);
}

/** The canonical store key of one exact record revision. */
export function canonicalRecordKey(identity: CanonicalObjectIdentity): string {
  return `${identity.objectClass}#${identity.objectId}#${identity.objectDigest}`;
}
