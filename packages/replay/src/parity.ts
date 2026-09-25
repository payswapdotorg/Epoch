/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W010 replay
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { EventStreamId } from '@epoch/event-log';
import type {
  FoldedEventEntry,
  ReconstructionSnapshot,
  ReplayCheckpoint,
  ReplayCursor,
  ReplayError,
  ReplaySpec,
  TracedReconstruction,
} from './types';
import type {
  FoldedEventEntrySchema,
  ReconstructionSnapshotSchema,
  ReplayCheckpointSchema,
  ReplayCursorSchema,
  ReplayErrorSchema,
  ReplayIssueSchema,
  ReplayRecordVersionSchema,
} from './schema';

export type ReplaySchemaSync = [
  Expect<Equals<z.infer<typeof ReplayRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof ReplayCursorSchema>, ReplayCursor>>,
  Expect<Equals<z.output<typeof ReplayCheckpointSchema>, ReplayCheckpoint>>,
  Expect<Equals<z.infer<typeof ReconstructionSnapshotSchema>, ReconstructionSnapshot>>,
  Expect<Equals<z.infer<typeof FoldedEventEntrySchema>, FoldedEventEntry>>,
  Expect<Equals<z.infer<typeof ReplayIssueSchema>, { readonly path: string; readonly message: string }>>,
  Expect<Equals<z.output<typeof ReplayErrorSchema>, ReplayError>>,
];

/** Result/error surface shape sanity. */
export type ReplayResultSync = [
  Expect<Equals<ReplayCheckpoint['stateDigest'], Sha256Hex>>,
  Expect<Equals<ReconstructionSnapshot['state'], JsonValue>>,
  Expect<Equals<ReconstructionSnapshot['streamIds'], readonly EventStreamId[]>>,
  Expect<Equals<ReconstructionSnapshot['cursors'], readonly ReplayCursor[]>>,
  Expect<Equals<ReplayCheckpoint['schemaVersion'], 1>>,
];

/** Generic runtime surfaces stay structurally pinned (TypeScript-only). */
export type ReplayGenericSync = [
  Expect<Equals<ReplaySpec<JsonValue>['initialState'], JsonValue>>,
  Expect<
    Equals<
      TracedReconstruction<JsonValue>['appliedOrder'],
      readonly FoldedEventEntry[]
    >
  >,
];
