/**
 * The replay schema surface registry: every data type published at the
 * `@epoch/replay` ownership boundary, paired with its zod schema (W010
 * publishes its versioned contract surface inside the package, the
 * W007/W008/W009 convention; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 *
 * NOTE: the GENERIC runtime types (`ReplaySpec`, `Reconstruction`,
 * `TracedReconstruction`, `TypedEventHandler`) are TypeScript-only
 * surfaces — they are exported from the package index but have no JSON
 * Schema projection (their serialized counterparts, `ReplayCheckpoint`
 * and `ReconstructionSnapshot`, do).
 */
import type { ZodType } from 'zod';
import {
  FoldedEventEntrySchema,
  ReconstructionSnapshotSchema,
  ReplayCursorSchema,
  ReplayErrorSchema,
  ReplayIssueSchema,
  ReplayRecordVersionSchema,
  ReplayCheckpointSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the replay contract v1. */
export const REPLAY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'FoldedEventEntry', schema: FoldedEventEntrySchema },
  { type: 'ReconstructionSnapshot', schema: ReconstructionSnapshotSchema },
  { type: 'ReplayCheckpoint', schema: ReplayCheckpointSchema },
  { type: 'ReplayCursor', schema: ReplayCursorSchema },
  { type: 'ReplayError', schema: ReplayErrorSchema },
  { type: 'ReplayIssue', schema: ReplayIssueSchema },
  { type: 'ReplayRecordVersion', schema: ReplayRecordVersionSchema },
];
