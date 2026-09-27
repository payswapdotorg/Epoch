/**
 * @epoch/adapter-github — the PROVIDER seam (provider vocabulary allowed
 * HERE and ONLY here).
 *
 * These schemas parse the fixture payloads that stand in for the hosted
 * software-workspace provider's API responses (the W020/W022 reference
 * precedent: no live network calls; fixtures carry the provider's shapes).
 * Everything the provider names — the service, the short names for
 * repositories and revisions, the work-item kinds — stays inside this
 * directory and is TRANSLATED by `../projection.ts` into the neutral
 * record vocabulary. The neutrality blocklist test
 * (test/neutrality.test.ts) enforces that no provider token escapes the
 * provider layer into the neutral seam modules.
 *
 * Strict objects throughout: unknown fields in provider payloads are
 * rejected with typed issues (`unknown-provider-payload`), never silently
 * ignored.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';

/** Total parse outcome of the provider seam (typed; never throws). */
export type ProviderSnapshotParse =
  | { readonly success: true; readonly data: ProviderSnapshot }
  | { readonly success: false; readonly error: z.ZodError };

/**
 * The provider fixture envelope version. The reference set pins exactly
 * one fixture form; a payload with any other envelope version is an
 * `unknown-provider-payload` rejection (never a partial silent load).
 */
export const PROVIDER_SNAPSHOT_VERSION = 1 as const;

/**
 * The hosted provider identity carried by fixtures (reference value —
 * stands in for the provider's own service name; it is DATA inside the
 * provider seam and is stripped during projection: the neutral records
 * never carry it).
 */
export const PROVIDER_SERVICE_NAME = 'github' as const;

/** The provider's content-hash grammar (hex, 40 chars — the fixture form). */
const PROVIDER_HASH_PATTERN = /^[0-9a-f]{40}$/;

/** One file entry of a revision's content tree, in the provider's shape. */
export const ProviderTreeEntrySchema = z
  .strictObject({
    path: z.string().min(1).max(512),
    kind: z.enum(['blob', 'tree']),
    hash: z.string().regex(PROVIDER_HASH_PATTERN),
  })
  .readonly();

export type ProviderTreeEntry = z.infer<typeof ProviderTreeEntrySchema>;

/** One revision (commit) record in the provider's shape. */
export const ProviderRevisionSchema = z
  .strictObject({
    sha: z.string().regex(PROVIDER_HASH_PATTERN),
    message: z.string().min(1).max(2000),
    authorName: z.string().min(1).max(256),
    authoredAt: TimestampSchema,
    parents: z.array(z.string().regex(PROVIDER_HASH_PATTERN)).max(16),
    tree: z.array(ProviderTreeEntrySchema).max(512),
  })
  .readonly();

export type ProviderRevision = z.infer<typeof ProviderRevisionSchema>;

/** One work item (issue or pull-request) in the provider's shape. */
export const ProviderWorkItemSchema = z
  .strictObject({
    number: z.number().int().min(1).max(1_000_000_000),
    kind: z.enum(['issue', 'pull-request']),
    title: z.string().min(1).max(512),
    state: z.enum(['open', 'closed']),
    headSha: z.string().regex(PROVIDER_HASH_PATTERN).optional(),
  })
  .readonly();

export type ProviderWorkItem = z.infer<typeof ProviderWorkItemSchema>;

/**
 * One hosted software-workspace snapshot: the fixture form of the
 * provider's repository-state response. At least one revision must be
 * present; the default branch names the head revision.
 */
export const ProviderSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(PROVIDER_SNAPSHOT_VERSION),
    service: z.literal(PROVIDER_SERVICE_NAME),
    repository: z
      .strictObject({
        name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/),
        defaultBranch: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/),
      })
      .readonly(),
    revisions: z.array(ProviderRevisionSchema).min(1).max(4096),
    workItems: z.array(ProviderWorkItemSchema).max(4096),
  })
  .readonly()
  .superRefine((snapshot, ctx) => {
    const shas = new Set(snapshot.revisions.map((revision) => revision.sha));
    if (shas.size !== snapshot.revisions.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'revision identifiers must be unique within a snapshot',
        path: ['revisions'],
      });
    }
    for (const revision of snapshot.revisions) {
      for (const parent of revision.parents) {
        if (!shas.has(parent)) {
          ctx.addIssue({
            code: 'custom',
            message: `revision ${revision.sha} references parent ${parent} which is not present in the snapshot`,
            path: ['revisions'],
          });
        }
      }
    }
    const numbers = new Set(snapshot.workItems.map((item) => `${item.kind}#${item.number}`));
    if (numbers.size !== snapshot.workItems.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'work items must be unique by (kind, number) within a snapshot',
        path: ['workItems'],
      });
    }
    for (const item of snapshot.workItems) {
      if (item.headSha !== undefined && !shas.has(item.headSha)) {
        ctx.addIssue({
          code: 'custom',
          message: `work item ${item.kind}#${item.number} references head revision ${item.headSha} which is not present in the snapshot`,
          path: ['workItems'],
        });
      }
    }
  });

export type ProviderSnapshot = z.infer<typeof ProviderSnapshotSchema>;

/**
 * The provider's own work-item kinds, mapped to neutral classes HERE (the
 * provider vocabulary is translated at the provider seam; the neutral
 * projection layer never spells the provider's kind vocabulary).
 */
export function neutralWorkItemCategory(providerKind: 'issue' | 'pull-request'): 'task' | 'change-review' {
  return providerKind === 'issue' ? 'task' : 'change-review';
}

/**
 * Total parse of a provider payload (the provider seam's ONLY entrance
 * for untrusted bytes). Unknown shapes, unknown fields, and envelope
 * skew are typed issues — the caller surfaces them as
 * `unknown-provider-payload` (never a partial silent load).
 */
export function parseProviderSnapshot(input: unknown): ProviderSnapshotParse {
  return ProviderSnapshotSchema.safeParse(input);
}
