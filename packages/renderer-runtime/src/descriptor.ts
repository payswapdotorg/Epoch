/**
 * The abstract renderer descriptor — the HOSTING surface of the Renderer
 * Runtime (W013).
 *
 * A descriptor is pure typed data: which Experience Graph kinds it hosts,
 * which interaction modalities it services, what output it can produce,
 * and the budgets it enforces (kind + capabilities + budgets — the
 * provider-neutral pin). It is a DECLARATION, not an implementation:
 * concrete engines (any graphics stack) are future adapters behind this
 * contract, so ZERO engine vocabulary, ZERO GPU code, and ZERO
 * UI-framework dependencies appear here (lock rule 13). Strict objects
 * reject unknown fields, so vendor/engine smuggle attempts fail as typed
 * `malformed-record` errors with precise paths.
 *
 * Determinism: `graphKinds` and `interaction` are sorted, duplicate-free
 * sets (deterministic set semantics), so semantically equal descriptors
 * are byte-identical under canonical serialization.
 */
import { z } from 'zod';
import {
  ExperienceGraphKindSchema,
  InteractionModalitySchema,
} from '@epoch/experience-protocol';
import {
  MAX_RENDERER_COLOR_DEPTH_BITS,
  MAX_RENDERER_GRAPH_EDGES,
  MAX_RENDERER_GRAPH_NODES,
  MAX_RENDERER_OUTPUT_PIXELS,
  MAX_RENDERER_REFRESH_HZ,
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
  RENDERER_DESCRIPTOR_VERSION,
} from './version';
import { RendererIdSchema } from './primitives';

/** Output capabilities a renderer declares (typed, neutral, bounded). */
export const RendererOutputCapabilitiesSchema = z
  .strictObject({
    /** Whether the renderer can produce stereoscopic output. */
    stereoscopic: z.boolean(),
    /** Maximum pixels the renderer will drive per frame. */
    maxPixels: z.number().int().positive().max(MAX_RENDERER_OUTPUT_PIXELS).optional(),
    /** Nominal refresh rate the renderer will target (Hz). */
    refreshHz: z.number().int().positive().max(MAX_RENDERER_REFRESH_HZ).optional(),
    /** Output color depth in bits per channel. */
    colorDepthBits: z.number().int().positive().max(MAX_RENDERER_COLOR_DEPTH_BITS).optional(),
  })
  .meta({
    id: 'RendererOutputCapabilities',
    title: 'RendererOutputCapabilities',
    description: 'Neutral output capabilities a renderer descriptor declares (never an engine or API surface).',
  });

/** One output-capability record. */
export type RendererOutputCapabilities = z.infer<typeof RendererOutputCapabilitiesSchema>;

/** The budgets a renderer enforces at its hosting boundary (typed, bounded). */
export const RendererBudgetsSchema = z
  .strictObject({
    /** Maximum nodes per hosted graph (required: always enforced). */
    maxGraphNodes: z.number().int().min(1).max(MAX_RENDERER_GRAPH_NODES),
    /** Maximum edges per hosted graph (required: always enforced; 0 = no edges). */
    maxGraphEdges: z.number().int().min(0).max(MAX_RENDERER_GRAPH_EDGES),
    /** Maximum declared triangles per mounted 3D/animation state. */
    maxTriangles: z.number().int().positive().max(MAX_RENDERER_TRIANGLES).optional(),
    /** Maximum declared texture-memory usage per mounted state, in bytes. */
    maxTextureBytes: z.number().int().positive().max(MAX_RENDERER_TEXTURE_BYTES).optional(),
  })
  .meta({
    id: 'RendererBudgets',
    title: 'RendererBudgets',
    description: 'Neutral budgets a renderer descriptor enforces at the hosting boundary.',
  });

/** One budget record. */
export type RendererBudgets = z.infer<typeof RendererBudgetsSchema>;

/**
 * The abstract renderer descriptor. `graphKinds` is the non-empty, sorted,
 * duplicate-free set of Experience Graph kinds the renderer hosts;
 * `interaction` is the sorted, duplicate-free set of modalities it
 * services (may be empty: a passive display hosts no input).
 */
export const RendererDescriptorSchema = z
  .strictObject({
    descriptorVersion: z.literal(RENDERER_DESCRIPTOR_VERSION),
    rendererId: RendererIdSchema,
    graphKinds: z
      .array(ExperienceGraphKindSchema)
      .min(1)
      .max(7)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'graphKinds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    interaction: z
      .array(InteractionModalitySchema)
      .max(7)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'interaction modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    output: RendererOutputCapabilitiesSchema,
    budgets: RendererBudgetsSchema,
  })
  .meta({
    id: 'RendererDescriptor',
    title: 'RendererDescriptor',
    description:
      'Abstract, provider-neutral renderer descriptor: hosting kinds, serviced modalities, output capabilities, and budgets as typed data; concrete engines are future adapters.',
  });

/** One renderer descriptor. */
export type RendererDescriptor = z.infer<typeof RendererDescriptorSchema>;
