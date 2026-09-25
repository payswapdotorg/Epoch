/**
 * Narrative/status blocks of the interactive world view — typed
 * presentation records for narrative beats and machine-readable status
 * slots (the W011 NarrativeBeat vocabulary, reused and narrowed to the
 * world view).
 *
 * A block may cite evidence records by content digest; every cited digest
 * must resolve against the scene's DECLARED evidence set (dangling
 * citations are typed `unknown-evidence-reference` rejections — narrative
 * claims that cite evidence must cite evidence the projection actually
 * carries).
 */
import { z } from 'zod';
import { NarrativeToneSchema, Sha256HexSchema, type NarrativeTone } from '@epoch/experience-protocol';
import { MAX_NARRATIVE_BLOCKS } from './version';
import {
  WorldVirtualTimeMsSchema,
} from './primitives';
import {
  malformedRecord,
  malformedRecordError,
  unknownEvidenceReferenceError,
} from './issues';
import type { WorldExperienceResult } from './errors';

/** Bounded block-local identifier: lowercase kebab slug. */
const NarrativeBlockIdSchema = z
  .string()
  .regex(/^nrb-[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'NarrativeBlockId',
    title: 'NarrativeBlockId',
    description: 'Narrative/status-block identifier: "nrb-" followed by a lowercase slug.',
  });

/** One narrative-block identifier. */
export type NarrativeBlockId = z.infer<typeof NarrativeBlockIdSchema>;

/** The typed descriptor of one narrative/status block. */
export const NarrativeStatusBlockSchema = z
  .strictObject({
    blockId: NarrativeBlockIdSchema,
    title: z.string().min(1).max(256),
    body: z.string().max(4096).optional(),
    tone: NarrativeToneSchema.optional(),
    statusKey: z.string().min(1).max(128).optional(),
    evidenceDigests: z
      .array(Sha256HexSchema)
      .max(32)
      .refine(
        (digests) => digests.every((d, i) => i === 0 || d > digests[i - 1]),
        'evidence digests must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
    atMs: WorldVirtualTimeMsSchema.optional(),
  })
  .meta({
    id: 'NarrativeStatusBlock',
    title: 'NarrativeStatusBlock',
    description:
      'One narrative/status block: bounded title/body, presentation tone, optional machine-readable status key, sorted evidence citations, virtual time.',
  });

/** One narrative/status block. */
export type NarrativeStatusBlock = z.infer<typeof NarrativeStatusBlockSchema>;

/**
 * Validate a narrative-block list: bounded, sorted and duplicate-free by
 * blockId, and every cited evidence digest resolves in the declared
 * evidence set.
 */
export function validateNarrativeBlocks(
  blocks: readonly NarrativeStatusBlock[],
  evidenceDigests: ReadonlySet<string>,
): WorldExperienceResult<void> {
  const list = z.array(NarrativeStatusBlockSchema).max(MAX_NARRATIVE_BLOCKS).safeParse(blocks);
  if (!list.success) {
    return { ok: false, error: malformedRecordError(list.error) };
  }
  for (let i = 1; i < list.data.length; i += 1) {
    if (list.data[i].blockId <= list.data[i - 1].blockId) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'narrativeBlocks',
            message:
              'narrative blocks must be sorted by blockId ascending and duplicate-free (deterministic serialization)',
          },
        ]),
      };
    }
  }
  for (const block of list.data) {
    for (const digest of block.evidenceDigests ?? []) {
      if (!evidenceDigests.has(digest)) {
        return {
          ok: false,
          error: unknownEvidenceReferenceError(
            digest,
            ['narrativeBlocks', block.blockId, 'evidenceDigests'],
          ),
        };
      }
    }
  }
  return { ok: true, value: undefined };
}

/** Narrative usage accounting (pure). */
export interface NarrativeUsage {
  readonly blockCount: number;
  readonly evidenceCitationCount: number;
  readonly tones: readonly NarrativeTone[];
}

/** Compute the narrative usage record of a block list (tones sorted, unique). */
export function computeNarrativeUsage(blocks: readonly NarrativeStatusBlock[]): NarrativeUsage {
  let evidenceCitationCount = 0;
  const tones = new Set<NarrativeTone>();
  for (const block of blocks) {
    evidenceCitationCount += block.evidenceDigests?.length ?? 0;
    if (block.tone !== undefined) {
      tones.add(block.tone);
    }
  }
  return {
    blockCount: blocks.length,
    evidenceCitationCount,
    tones: [...tones].sort(),
  };
}
