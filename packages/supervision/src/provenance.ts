/**
 * Finding provenance (the W006 convention): every supervision finding
 * carries the exact-revision source references it was computed from.
 * Sources are (referenceKind, referenceId, contentDigest) triples —
 * content-addressed pointers into the W036/W037/W038 sealed records the
 * check family folded, never embedded payloads.
 */
import { z } from 'zod';
import { Sha256HexSchema } from '@epoch/solution-delivery';
import { TimestampSchema, PrincipalIdSchema } from '@epoch/solution-delivery';
import { SUPERVISION_CONTRACT_VERSION } from './version';
import { PROVENANCE_REFERENCE_KINDS } from './version';

/** The W006-convention provenance kind (what kind of record the source is). */
export const ProvenanceReferenceKindSchema = z.enum(PROVENANCE_REFERENCE_KINDS).meta({
  id: 'ProvenanceReferenceKind',
  title: 'ProvenanceReferenceKind',
  description: 'The kind of sealed record a finding source points at (the W006 exact-revision convention).',
});

/** One provenance kind. */
export type ProvenanceReferenceKind = z.infer<typeof ProvenanceReferenceKindSchema>;

/** One exact-revision provenance source of a finding. */
export const ProvenanceSourceSchema = z
  .strictObject({
    referenceKind: ProvenanceReferenceKindSchema,
    referenceId: z.string().min(1).max(256),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((source, ctx) => {
    if (source.referenceId < source.referenceId.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'referenceId must not carry surrounding whitespace',
        path: ['referenceId'],
      });
    }
  })
  .meta({
    id: 'ProvenanceSource',
    title: 'ProvenanceSource',
    description:
      'One exact-revision provenance source of a supervision finding: the record kind, its opaque id, and its SHA-256 content digest.',
  });

/** One provenance source. */
export type ProvenanceSource = z.infer<typeof ProvenanceSourceSchema>;

/**
 * The provenance block of one supervision finding: the evaluation
 * instant, the evaluating principal, the check-surface contract version,
 * and the sorted duplicate-free exact-revision source list.
 */
export const FindingProvenanceSchema = z
  .strictObject({
    evaluatedAt: TimestampSchema,
    evaluatedBy: PrincipalIdSchema,
    checkVersion: z.literal(SUPERVISION_CONTRACT_VERSION),
    sources: z.array(ProvenanceSourceSchema).min(1).max(64),
  })
  .readonly()
  .superRefine((provenance, ctx) => {
    const keys = provenance.sources.map(
      (source) => `${source.referenceKind}\u0000${source.referenceId}`,
    );
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i]! < keys[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'sources must be sorted by (referenceKind, referenceId) ascending (deterministic serialization)',
          path: ['sources'],
        });
        break;
      }
      if (keys[i]! === keys[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'sources must be duplicate-free by (referenceKind, referenceId)',
          path: ['sources'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'FindingProvenance',
    title: 'FindingProvenance',
    description:
      'The provenance block of one supervision finding: evaluation instant and principal, the check-surface contract version, and the sorted exact-revision source list (the W006 convention).',
  });

/** One finding provenance block. */
export type FindingProvenance = z.infer<typeof FindingProvenanceSchema>;
