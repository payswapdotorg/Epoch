/**
 * @epoch/adapter-ifc — runtime zod validators for the published
 * contract types (the NEUTRAL seam; the exchange standard's vocabulary
 * is absent by construction — pinned by test/neutrality.test.ts).
 *
 * Strict objects throughout: unknown fields are rejected, so
 * standard-specific semantics cannot enter the neutral records through
 * any door. The assertion inputs inside a projection are validated by
 * the REAL W002 world-model validators (a runtime dependency).
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { AssertionInputSchema } from '@epoch/world-model';
import { IFC_ADAPTER_RECORD_VERSION } from './version';
import { INGESTION_DISPOSITIONS } from './version';

const recordVersion = z.literal(IFC_ADAPTER_RECORD_VERSION);
const digest = z.string().regex(/^[0-9a-f]{64}$/, 'lowercase hex SHA-256 (64 characters)');

/** Neutral building-model identity: `bim:` + slug. */
export const BuildingModelIdSchema = z
  .string()
  .regex(/^bim:[a-z0-9][a-z0-9._-]{0,127}$/, "model ids are 'bim:' + slug (standard-neutral)");

export const BuildingModelSourceRefSchema = z
  .strictObject({
    artifactId: z.string().min(1).max(512),
    revision: z.string().min(1).max(128),
    digest,
  })
  .readonly();

export const ModelIngestionRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    modelId: BuildingModelIdSchema,
    modelDigest: digest,
    elementCount: z.number().int().nonnegative(),
    relationCount: z.number().int().nonnegative(),
    ingestedAt: TimestampSchema,
    disposition: z.enum(INGESTION_DISPOSITIONS),
    contentDigest: digest,
  })
  .readonly();

export const BuildingModelObservationSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    modelId: BuildingModelIdSchema,
    source: BuildingModelSourceRefSchema,
    elementCount: z.number().int().nonnegative(),
    relationCount: z.number().int().nonnegative(),
    observedAt: TimestampSchema,
    provenance: z
      .strictObject({
        actor: z
          .strictObject({
            id: z.string().min(1).max(256),
            role: z.literal('external-provider'),
            displayName: z.string().max(256).optional(),
          })
          .readonly(),
        method: z.string().min(1).max(256),
        evidence: z
          .array(
            z
              .strictObject({
                id: z.string().min(1).max(512),
                kind: z.enum([
                  'document',
                  'measurement',
                  'observation',
                  'computation',
                  'assertion',
                  'external',
                  'other',
                ]),
                digest: z.string().regex(/^[0-9a-f]{16,128}$/, 'evidence digests are lowercase hex').optional(),
                locator: z.string().max(2048).optional(),
                description: z.string().max(2048).optional(),
              })
              .readonly(),
          )
          .readonly(),
      })
      .readonly(),
    confidence: z
      .strictObject({
        distribution: z
          .strictObject({
            kind: z.literal('point'),
            value: z.number().min(0).max(1),
          })
          .readonly(),
        method: z.literal('imported'),
        rationale: z.string().min(1).max(2048),
      })
      .readonly(),
    contentDigest: digest,
  })
  .readonly();

export const BuildingModelProjectionSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    modelId: BuildingModelIdSchema,
    source: BuildingModelSourceRefSchema,
    observedAt: TimestampSchema,
    assertionInputs: z.array(AssertionInputSchema).readonly(),
    projectionDigest: digest,
  })
  .readonly()
  .superRefine((projection, ctx) => {
    const entityIds = projection.assertionInputs
      .filter((input) => input.statement.kind === 'entity')
      .map((input) => (input.statement as { entityId: string }).entityId);
    const sorted = [...entityIds].sort();
    if (entityIds.some((id, index) => id !== sorted[index])) {
      ctx.addIssue({
        code: 'custom',
        message: 'entity assertion inputs must be sorted by entityId ascending (entities before relations)',
        path: ['assertionInputs'],
      });
    }
    if (new Set(entityIds).size !== entityIds.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'entity assertion inputs must be unique by entityId within a projection',
        path: ['assertionInputs'],
      });
    }
  });

/** The neutral projection request (the W007 source/semantic envelope's inputs — parameter-name keys are lowercase kebab). */
export const ProjectionRequestSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    model: BuildingModelIdSchema,
    /**
     * The projection mode. `projected` (the default) maps the model INTO
     * world-model INPUT records; any `authoritative`/`direct` value is the
     * typed external-semantics-not-authority rejection.
     */
    mode: z.string().max(32).optional(),
  })
  .readonly();

/** The neutral ingestion input (the adapter's provider-seam-facing API input). */
export const IngestModelInputSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    claimedDigest: digest.optional(),
    ingestedAt: TimestampSchema,
  })
  .readonly();
