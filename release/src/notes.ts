/**
 * @epoch/release-kit — release notes as typed records (Work Order W035).
 *
 * Release notes are DATA: typed sections with typed CITATIONS — work
 * orders, pull requests, budget records (W034), named tests, documents
 * and shipped surfaces. A notes record is sealed and content-addressed
 * like every other release record; the readiness checklist's
 * `notes-published` item cites its digest. The human-readable rendering
 * (docs/release/release-notes-e1.md) is a PROJECTION of the record, never
 * a second source of truth.
 */
import { z } from 'zod';
import { type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { RELEASE_KIT_RECORD_VERSION } from './version';
import {
  NotesIdSchema,
  ReleaseIdSchema,
  digestOfJson,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { ReleaseProvenanceSchema } from './provenance';

// --------------------------------------------------------------------------------
// Citations.
// --------------------------------------------------------------------------------

/** The closed citation-kind vocabulary. */
export const CITATION_KINDS = [
  'work-order',
  'pull-request',
  'budget',
  'test',
  'document',
  'surface',
] as const;
export type CitationKind = (typeof CITATION_KINDS)[number];

/** The ref grammar per citation kind (checked at admission). */
const CITATION_REF_PATTERNS: Readonly<Record<CitationKind, RegExp>> = {
  'work-order': /^W[0-9]{3}$/,
  'pull-request': /^PR #[0-9]{1,5}$/,
  budget: /^budget:[a-z0-9][a-z0-9-]{0,62}$/,
  test: /^[a-z0-9/._-]+\.test\.ts$/,
  document: /^docs\/[a-z0-9/._-]+\.md$/,
  surface: /^(packages|services|apps|adapters|packs|contracts|examples|tests|deploy|ops|release|runtimes|docs)\/[a-z0-9/._-]*$/,
};

/** One typed citation (kind + exact ref). */
export const CitationSchema = z
  .strictObject({
    kind: z.enum(CITATION_KINDS),
    ref: z.string().min(1).max(256),
  })
  .readonly()
  .superRefine((citation, ctx) => {
    const pattern = CITATION_REF_PATTERNS[citation.kind];
    if (!pattern.test(citation.ref)) {
      ctx.addIssue({
        code: 'custom',
        message: `citation ref "${citation.ref}" does not match the "${citation.kind}" grammar`,
      });
    }
  });
export type Citation = z.infer<typeof CitationSchema>;

// --------------------------------------------------------------------------------
// Sections + the notes record.
// --------------------------------------------------------------------------------

/** One notes section: heading, body, typed citations. */
export const NotesSectionSchema = z
  .strictObject({
    heading: z.string().min(1).max(128),
    body: z.string().min(1).max(4000),
    citations: z.array(CitationSchema).readonly(),
  })
  .readonly();
export type NotesSection = z.infer<typeof NotesSectionSchema>;

const notesShape = z
  .strictObject({
    recordVersion: z.literal(RELEASE_KIT_RECORD_VERSION),
    notesId: NotesIdSchema,
    releaseId: ReleaseIdSchema,
    title: z.string().min(1).max(200),
    /** Deterministically ordered highlights (the release's one-liners). */
    highlights: z.array(z.string().min(1).max(256)).min(1),
    sections: z.array(NotesSectionSchema).min(1),
    provenance: ReleaseProvenanceSchema,
  });

/** A release-notes record (content half). */
export const ReleaseNotesSchema = notesShape.readonly();
export type ReleaseNotes = z.infer<typeof ReleaseNotesSchema>;

/** A sealed release-notes record (content-addressed). */
export const SealedReleaseNotesSchema = notesShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type SealedReleaseNotes = z.infer<typeof SealedReleaseNotesSchema>;

/** The content half of sealed notes (digest excluded). */
export function notesContent(notes: SealedReleaseNotes): Omit<SealedReleaseNotes, 'digest'> {
  const { digest: _digest, ...rest } = notes;
  void _digest;
  return rest;
}

/** Compute the canonical digest of notes content. */
export function computeNotesDigest(content: ReleaseNotes): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

/** Parse + validate notes-shaped input (the total admission path). */
export function parseReleaseNotes(input: unknown): ReleaseResult<ReleaseNotes> {
  const parsed = ReleaseNotesSchema.safeParse(input);
  if (!parsed.success) {
    return releaseFail('validation', `release notes failed validation: ${firstIssueText(parsed.error)}`, {
      subject: 'notes',
    });
  }
  return { ok: true, value: parsed.data };
}

/** Seal valid notes content (adds the content address). */
export function sealReleaseNotes(input: unknown): ReleaseResult<SealedReleaseNotes> {
  const admitted = parseReleaseNotes(input);
  if (!admitted.ok) return admitted;
  return { ok: true, value: { ...admitted.value, digest: computeNotesDigest(admitted.value) } };
}

/** Verify a sealed notes record's digest (tamper detection). */
export function verifyNotesDigest(notes: SealedReleaseNotes): ReleaseResult<SealedReleaseNotes> {
  const revalidated = ReleaseNotesSchema.safeParse(notesContent(notes));
  if (!revalidated.success) {
    return releaseFail(
      'validation',
      `notes "${notes.notesId}" failed validation: ${firstIssueText(revalidated.error)}`,
      { subject: notes.notesId },
    );
  }
  const expected = computeNotesDigest(revalidated.data);
  return expected === notes.digest
    ? { ok: true, value: notes }
    : releaseFail('digest-mismatch', `notes "${notes.notesId}": digest does not match content (tampered notes)`, {
        subject: notes.notesId,
      });
}
