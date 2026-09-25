/**
 * Projection requests: how a consumer asks the Experience layer for an
 * Experience Graph.
 *
 * A request names WHICH kernel state to project (opaque, tenant-scoped,
 * exact-revision projected references — never embedded kernel objects and
 * never queries that would make the experience layer a semantic store),
 * WHICH tenant scope owns the projection, WHICH graph kind is wanted, and
 * the DEVICE the experience is requested for (R29). An optional replay
 * window bounds the world-model event sequence range for timeline/replay
 * projections (R7).
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import { DeviceDescriptorSchema } from './device';
import { TenantScopeSchema } from './primitives';
import { ProjectedReferenceSchema, projectedReferenceKey } from './reference';
import {
  EXPERIENCE_PROJECTION_REQUEST_SCHEMA_NAME,
  ExperienceGraphKindSchema,
  ExperienceProtocolVersionSchema,
} from './version';

/** Upper bound on references per request (DoS discipline). */
export const MAX_REQUEST_REFERENCES = 512;

/** A bounded world-model event-sequence window for replay projections (R7). */
export const ReplayWindowSchema = z
  .strictObject({
    fromSequence: z.number().int().nonnegative(),
    toSequence: z.number().int().positive(),
  })
  .superRefine((window, ctx) => {
    if (window.toSequence <= window.fromSequence) {
      ctx.addIssue({
        code: 'custom',
        message: 'toSequence must be greater than fromSequence',
        path: ['toSequence'],
      });
    }
  })
  .meta({
    id: 'ReplayWindow',
    title: 'ReplayWindow',
    description:
      'Bounded world-model event-sequence window for timeline/replay projections (from inclusive, to exclusive).',
  });

/** One replay window. */
export type ReplayWindow = z.infer<typeof ReplayWindowSchema>;

/**
 * A projection request. `references` is non-empty, sorted, and
 * duplicate-free by (kind, target id) — the deterministic wire form. Every
 * reference's tenant must equal the request's tenant scope (enforced at
 * admission with a typed cross-tenant-denied error).
 */
export const ProjectionRequestSchema = z
  .strictObject({
    schema: z.literal(EXPERIENCE_PROJECTION_REQUEST_SCHEMA_NAME),
    protocolVersion: ExperienceProtocolVersionSchema,
    requestId: MessageIdSchema,
    requestedAt: TimestampSchema,
    tenantScope: TenantScopeSchema,
    graphKind: ExperienceGraphKindSchema,
    references: z.array(ProjectedReferenceSchema).min(1).max(MAX_REQUEST_REFERENCES),
    replayWindow: ReplayWindowSchema.optional(),
    device: DeviceDescriptorSchema,
  })
  .superRefine((request, ctx) => {
    const keys = request.references.map(projectedReferenceKey);
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i] < keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'references must be sorted by (kind, target id) ascending (deterministic serialization)',
          path: ['references'],
        });
        break;
      }
      if (keys[i] === keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'references must be duplicate-free by (kind, target id)',
          path: ['references'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ProjectionRequest',
    title: 'ProjectionRequest',
    description:
      'A tenant-scoped projection request: which kernel state (opaque exact-revision references), which graph kind, which device.',
  });

/** One projection request. */
export type ProjectionRequest = z.infer<typeof ProjectionRequestSchema>;
