/**
 * The neutral renderer-technique catalog — pure typed data (the seam the
 * W013 pin reserved: "concrete engines are future adapters behind the
 * descriptor contract").
 *
 * Each technique declares which Experience Graph kinds it hosts (sorted
 * set), whether it presents stereoscopically, and where it executes
 * (local / remote). The catalog names TECHNIQUES, never engines or
 * vendors; a concrete engine binds to a technique at the client surface
 * (future adapters), so ZERO engine imports, ZERO GPU code, and ZERO
 * UI-framework dependencies appear here (lock rule 13).
 */
import { z } from 'zod';
import { ExperienceGraphKindSchema } from '@epoch/experience-protocol';
import {
  RENDERER_TECHNIQUES,
  TECHNIQUE_EXECUTION_CLASSES,
  RendererTechniqueSchema,
  TechniqueExecutionClassSchema,
  type RendererTechnique,
} from './version';

/** One catalog entry: a neutral rendering technique as typed data. */
export interface RendererTechniqueRecord {
  /** The technique this record declares. */
  readonly technique: RendererTechnique;
  /** Which Experience Graph kinds the technique hosts (sorted set). */
  readonly graphKinds: readonly string[];
  /** Whether the technique presents stereoscopically. */
  readonly stereoscopic: boolean;
  /** Where the technique executes. */
  readonly executionClass: 'local' | 'remote';
}

/** The flat (non-spatial) graph kinds a 2D technique hosts. */
const FLAT_GRAPH_KINDS = ['2d', 'controls', 'narrative', 'timeline-replay'] as const;

/** Every graph kind (the technique-agnostic full set). */
const ALL_GRAPH_KINDS = [
  '2d',
  '3d',
  'animation',
  'controls',
  'narrative',
  'presence',
  'timeline-replay',
] as const;

/**
 * The canonical technique catalog (frozen data). Hosted kinds are sorted
 * duplicate-free sets (deterministic set semantics).
 */
export const RENDERER_TECHNIQUE_CATALOG: Readonly<
  Record<RendererTechnique, RendererTechniqueRecord>
> = {
  'immediate-2d': {
    technique: 'immediate-2d',
    graphKinds: [...FLAT_GRAPH_KINDS],
    stereoscopic: false,
    executionClass: 'local',
  },
  'retained-scene-3d': {
    technique: 'retained-scene-3d',
    graphKinds: [...ALL_GRAPH_KINDS],
    stereoscopic: false,
    executionClass: 'local',
  },
  'remote-stream': {
    technique: 'remote-stream',
    graphKinds: [...ALL_GRAPH_KINDS],
    stereoscopic: false,
    executionClass: 'remote',
  },
  'stereoscopic-compositor': {
    technique: 'stereoscopic-compositor',
    graphKinds: [...ALL_GRAPH_KINDS],
    stereoscopic: true,
    executionClass: 'local',
  },
};

/** The canonical record of one technique (pure lookup). */
export function techniqueRecordOf(technique: RendererTechnique): RendererTechniqueRecord {
  return RENDERER_TECHNIQUE_CATALOG[technique];
}

/**
 * Whether a technique hosts EVERY kind of a required set (pure
 * comparison over the catalog).
 */
export function techniqueHostsKinds(
  technique: RendererTechnique,
  requiredKinds: readonly string[],
): boolean {
  const hosted = new Set<string>(RENDERER_TECHNIQUE_CATALOG[technique].graphKinds);
  return requiredKinds.every((kind) => hosted.has(kind));
}

/** The sorted set of spatial graph kinds ('3d' and 'animation'). */
export const SPATIAL_GRAPH_KINDS = ['3d', 'animation'] as const;

/** Whether a kind set contains any spatial kind (pure). */
export function hasSpatialKinds(kinds: readonly string[]): boolean {
  return kinds.some((kind) => SPATIAL_GRAPH_KINDS.includes(kind as '3d' | 'animation'));
}

/** The zod validator of one catalog entry (published contract surface). */
export const RendererTechniqueRecordSchema = z
  .strictObject({
    technique: RendererTechniqueSchema,
    graphKinds: z
      .array(ExperienceGraphKindSchema)
      .min(1)
      .max(7)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'graphKinds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    stereoscopic: z.boolean(),
    executionClass: TechniqueExecutionClassSchema,
  })
  .superRefine((record, ctx) => {
    // Catalog consistency: the record must equal the canonical catalog
    // entry (the catalog is frozen data; hand-edited entries are typed
    // rejections).
    const canonical = RENDERER_TECHNIQUE_CATALOG[record.technique];
    if (
      JSON.stringify({ ...record }) !==
      JSON.stringify({
        technique: canonical.technique,
        graphKinds: [...canonical.graphKinds],
        stereoscopic: canonical.stereoscopic,
        executionClass: canonical.executionClass,
      })
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'the technique record must equal the canonical catalog entry',
        path: ['technique'],
      });
    }
  })
  .meta({
    id: 'RendererTechniqueRecord',
    title: 'RendererTechniqueRecord',
    description:
      'One neutral renderer technique as typed data: hosted graph kinds (sorted set), stereoscopic output, and execution class (pure catalog data — never an engine).',
  });

/** One technique record (zod-validated). */
export type RendererTechniqueRecordValue = z.infer<typeof RendererTechniqueRecordSchema>;

/** The closed technique vocabulary (re-export for consumers). */
export { RENDERER_TECHNIQUES, TECHNIQUE_EXECUTION_CLASSES };
