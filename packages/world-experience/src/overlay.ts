/**
 * Visual overlays of the interactive world view — typed presentation
 * records attached to scene entities. An overlay NEVER mutates world
 * state: it is a highlight, annotation, measurement, or state recipe that
 * the compiled graph projects alongside the entities it marks.
 *
 * A scene declares its overlay LIBRARY (the overlays that exist) and its
 * APPLIED list (which overlays are active, in deterministic application
 * order). Applying an unknown overlay id is a typed
 * `unknown-overlay-reference` rejection; application order is a sorted,
 * duplicate-free (orderIndex, overlayId) sequence so serialization is
 * deterministic.
 */
import { z } from 'zod';
import {
  ColorHexSchema,
  Sha256HexSchema,
  type ColorHex,
  type Sha256Hex,
} from '@epoch/experience-protocol';
import {
  MAX_APPLIED_OVERLAYS,
  MAX_SCENE_OVERLAYS,
  WORLD_OVERLAY_KINDS,
} from './version';
import {
  WorldEntityIdSchema,
  WorldOverlayIdSchema,
  type WorldOverlayId,
} from './primitives';
import {
  malformedRecord,
  malformedRecordError,
  unknownOverlayReferenceError,
} from './issues';
import type { WorldExperienceResult } from './errors';

/** A highlight overlay: a color emphasis on one entity. */
const HighlightOverlaySchema = z
  .strictObject({
    overlayId: WorldOverlayIdSchema,
    overlayKind: z.literal('highlight'),
    entityId: WorldEntityIdSchema,
    color: ColorHexSchema,
  })
  .meta({ id: 'HighlightOverlay', title: 'HighlightOverlay' });

/** An annotation overlay: a bounded note attached to one entity. */
const AnnotationOverlaySchema = z
  .strictObject({
    overlayId: WorldOverlayIdSchema,
    overlayKind: z.literal('annotation'),
    entityId: WorldEntityIdSchema,
    text: z.string().min(1).max(2048),
    evidenceDigests: z
      .array(Sha256HexSchema)
      .max(32)
      .refine(
        (digests) => digests.every((d, i) => i === 0 || d > digests[i - 1]),
        'evidence digests must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
  })
  .meta({ id: 'AnnotationOverlay', title: 'AnnotationOverlay' });

/** A measurement overlay: a measured span between two entities. */
const MeasurementOverlaySchema = z
  .strictObject({
    overlayId: WorldOverlayIdSchema,
    overlayKind: z.literal('measurement'),
    fromEntityId: WorldEntityIdSchema,
    toEntityId: WorldEntityIdSchema,
    label: z.string().max(256).optional(),
    evidenceDigests: z
      .array(Sha256HexSchema)
      .max(32)
      .refine(
        (digests) => digests.every((d, i) => i === 0 || d > digests[i - 1]),
        'evidence digests must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
  })
  .meta({ id: 'MeasurementOverlay', title: 'MeasurementOverlay' });

/** A state overlay: a named state presented as a tint/badge recipe. */
const StateOverlaySchema = z
  .strictObject({
    overlayId: WorldOverlayIdSchema,
    overlayKind: z.literal('state'),
    entityId: WorldEntityIdSchema,
    stateKey: z.string().min(1).max(128),
    tint: ColorHexSchema.optional(),
    badgeLabel: z.string().max(64).optional(),
  })
  .meta({ id: 'StateOverlay', title: 'StateOverlay' });

/** The visual-overlay union (discriminated on `overlayKind`). */
export const VisualOverlaySchema = z
  .discriminatedUnion('overlayKind', [
    HighlightOverlaySchema,
    AnnotationOverlaySchema,
    MeasurementOverlaySchema,
    StateOverlaySchema,
  ])
  .meta({
    id: 'VisualOverlay',
    title: 'VisualOverlay',
    description:
      'One visual overlay of a world scene: highlight, annotation, measurement, or state — presentation data only.',
  });

/** One visual overlay. */
export type VisualOverlay = z.infer<typeof VisualOverlaySchema>;

/** One highlight overlay. */
export type HighlightOverlay = z.infer<typeof HighlightOverlaySchema>;

/** One annotation overlay. */
export type AnnotationOverlay = z.infer<typeof AnnotationOverlaySchema>;

/** One measurement overlay. */
export type MeasurementOverlay = z.infer<typeof MeasurementOverlaySchema>;

/** One state overlay. */
export type StateOverlay = z.infer<typeof StateOverlaySchema>;

/** The overlay-kind list (re-exported closed vocabulary). */
export const WORLD_OVERLAY_KIND_LIST = WORLD_OVERLAY_KINDS;

/**
 * One applied-overlay entry: the overlay id plus its deterministic
 * application order index (stable paint order; lower indices paint first).
 */
export const OverlayApplicationSchema = z
  .strictObject({
    overlayId: WorldOverlayIdSchema,
    orderIndex: z.number().int().nonnegative(),
  })
  .meta({
    id: 'OverlayApplication',
    title: 'OverlayApplication',
    description: 'One applied overlay: id plus deterministic application order index.',
  });

/** One applied-overlay entry. */
export type OverlayApplication = z.infer<typeof OverlayApplicationSchema>;

/**
 * Validate a full overlay library + application list pair: the library is
 * sorted/duplicate-free by overlayId and bounded; the applied list is
 * sorted by (orderIndex, overlayId), duplicate-free by overlayId, bounded,
 * and every applied overlay id resolves in the library. Deterministic
 * ordering keeps serialization byte-stable.
 */
export function validateOverlayState(
  overlays: readonly VisualOverlay[],
  applied: readonly OverlayApplication[],
): WorldExperienceResult<void> {
  const library = z.array(VisualOverlaySchema).max(MAX_SCENE_OVERLAYS).safeParse(overlays);
  if (!library.success) {
    return { ok: false, error: malformedRecordError(library.error) };
  }
  const appliedList = z.array(OverlayApplicationSchema).max(MAX_APPLIED_OVERLAYS).safeParse(applied);
  if (!appliedList.success) {
    return { ok: false, error: malformedRecordError(appliedList.error) };
  }
  for (let i = 1; i < library.data.length; i += 1) {
    if (library.data[i].overlayId <= library.data[i - 1].overlayId) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'overlays',
            message:
              'the overlay library must be sorted by overlayId ascending and duplicate-free (deterministic serialization)',
          },
        ]),
      };
    }
  }
  const keys = appliedList.data.map((a) => `${a.orderIndex}\u0000${a.overlayId}`);
  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i] <= keys[i - 1]) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'appliedOverlays',
            message:
              'applied overlays must be sorted by (orderIndex, overlayId) ascending and duplicate-free (deterministic application order)',
          },
        ]),
      };
    }
  }
  const appliedIds = new Set<string>();
  for (const application of appliedList.data) {
    if (appliedIds.has(application.overlayId)) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'appliedOverlays',
            message: `the overlay "${application.overlayId}" is applied more than once (application is idempotent per overlay)`,
          },
        ]),
      };
    }
    appliedIds.add(application.overlayId);
  }
  const known = new Set(library.data.map((o) => o.overlayId));
  for (const application of appliedList.data) {
    if (!known.has(application.overlayId)) {
      return { ok: false, error: unknownOverlayReferenceError(application.overlayId) };
    }
  }
  return { ok: true, value: undefined };
}

/**
 * Pure overlay application: returns the next applied list with the overlay
 * appended at the next order index (deterministic: max index + 1, or 0).
 * Unknown overlay ids are typed `unknown-overlay-reference` rejections.
 */
export function applyOverlayTo(
  overlays: readonly VisualOverlay[],
  applied: readonly OverlayApplication[],
  overlayId: WorldOverlayId,
): WorldExperienceResult<readonly OverlayApplication[]> {
  const exists = overlays.some((o) => o.overlayId === overlayId);
  if (!exists) {
    return { ok: false, error: unknownOverlayReferenceError(overlayId) };
  }
  const already = applied.some((a) => a.overlayId === overlayId);
  if (already) {
    return { ok: true, value: applied };
  }
  const nextIndex = applied.reduce((max, a) => Math.max(max, a.orderIndex), -1) + 1;
  if (nextIndex >= MAX_APPLIED_OVERLAYS) {
    return {
      ok: false,
      error: malformedRecord([
        {
          path: 'appliedOverlays',
          message: `applied overlays are limited to ${MAX_APPLIED_OVERLAYS}`,
        },
      ]),
    };
  }
  return { ok: true, value: [...applied, { overlayId, orderIndex: nextIndex }] };
}

/**
 * Pure overlay removal: returns the next applied list without the overlay
 * (order indices of the remaining entries are preserved — removal is not a
 * reordering event). Unknown ids are typed `unknown-overlay-reference`
 * rejections (removing something undeclared is a contract violation).
 */
export function removeOverlayFrom(
  overlays: readonly VisualOverlay[],
  applied: readonly OverlayApplication[],
  overlayId: WorldOverlayId,
): WorldExperienceResult<readonly OverlayApplication[]> {
  const exists = overlays.some((o) => o.overlayId === overlayId);
  if (!exists) {
    return { ok: false, error: unknownOverlayReferenceError(overlayId) };
  }
  return { ok: true, value: applied.filter((a) => a.overlayId !== overlayId) };
}

/** Overlay usage accounting (pure): the color/tint surfaces a scene uses. */
export interface OverlayUsage {
  readonly appliedCount: number;
  readonly highlightCount: number;
  readonly annotationCount: number;
  readonly measurementCount: number;
  readonly stateCount: number;
}

/** Compute the overlay usage record of an overlay library + applied list. */
export function computeOverlayUsage(
  overlays: readonly VisualOverlay[],
  applied: readonly OverlayApplication[],
): OverlayUsage {
  const appliedIds = new Set(applied.map((a) => a.overlayId));
  let highlightCount = 0;
  let annotationCount = 0;
  let measurementCount = 0;
  let stateCount = 0;
  for (const overlay of overlays) {
    if (!appliedIds.has(overlay.overlayId)) {
      continue;
    }
    switch (overlay.overlayKind) {
      case 'highlight':
        highlightCount += 1;
        break;
      case 'annotation':
        annotationCount += 1;
        break;
      case 'measurement':
        measurementCount += 1;
        break;
      case 'state':
        stateCount += 1;
        break;
    }
  }
  return {
    appliedCount: applied.length,
    highlightCount,
    annotationCount,
    measurementCount,
    stateCount,
  };
}

/** Exported for the schema surface registry (type-level only). */
export type OverlayColor = ColorHex;
export type OverlayEvidenceDigest = Sha256Hex;
