/**
 * The renderer CAPABILITY SET (W056) — what a renderer adapter can DO at
 * the fabric boundary, as typed data.
 *
 * The W013 RendererDescriptor (unchanged) declares what a renderer HOSTS
 * (graph kinds, interaction modalities, output, budgets); the capability
 * set declares the FABRIC operations the adapter supports: hit-testing,
 * measurement/annotation translation, snapshot capture, switching, frame
 * capture, the typed degradations it can apply, the portable view-state
 * fields it can restore, and the content-addressed asset kinds it can
 * bind. Anything not declared is denied (the W008 permission pattern);
 * capability gaps are typed, never silent.
 *
 * Provider neutrality (lock rule 13): a capability set names ROLES and
 * OPERATIONS only — never a vendor, engine, or API. Strict objects reject
 * unknown fields, so vendor/engine smuggle attempts fail as typed
 * `invalid-fabric-record` failures with precise paths.
 */
import { z } from 'zod';
import {
  PORTABLE_VIEW_STATE_FIELDS,
  RENDERER_ASSET_KINDS,
  RENDERER_CAPABILITY_VERSION,
  RENDERER_DEGRADATION_KINDS,
} from './version';
import { PortableViewStateFieldSchema, RendererAssetKindSchema, RendererDegradationKindSchema } from './version';
import { RendererIdSchema } from './primitives';

/**
 * The renderer capability set: the fabric operations a renderer adapter
 * declares. Deterministic set semantics throughout (sorted, duplicate-free)
 * so semantically equal sets serialize to identical bytes.
 *
 * Consistency rules (enforced at admission):
 * - `degradation` always contains `none` (the neutral marker);
 * - an adapter that supports switching (`sessionSwitching: true`) must
 *   declare at least one portable view-state field (a switch target with
 *   no portable restore surface could not honor the switching invariant);
 * - `snapshotCapture` (switch SOURCE support) requires `sessionSwitching`
 *   (switch TARGET support) — an adapter that can seed a switch must also
 *   be able to receive one in the fabric's model.
 */
export const RendererCapabilitySetSchema = z
  .strictObject({
    capabilityVersion: z.literal(RENDERER_CAPABILITY_VERSION),
    /** The W013 renderer descriptor identity this set belongs to. */
    rendererId: RendererIdSchema,
    /** Whether the adapter resolves pointer input to semantic entity ids. */
    hitTesting: z.boolean(),
    /** Whether the adapter translates measurement interactions. */
    measurement: z.boolean(),
    /** Whether the adapter translates annotation interactions. */
    annotation: z.boolean(),
    /** Whether the adapter can capture frame/evidence images. */
    frameCapture: z.boolean(),
    /** Whether the adapter can be a switch TARGET (mount + restore). */
    sessionSwitching: z.boolean(),
    /** Whether the adapter can be a switch SOURCE (capture snapshots). */
    snapshotCapture: z.boolean(),
    /** Typed presentation degradations the adapter can apply (sorted set, contains "none"). */
    degradation: z
      .array(RendererDegradationKindSchema)
      .min(1)
      .max(RENDERER_DEGRADATION_KINDS.length)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'degradation must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Portable view-state fields the adapter can restore (sorted set). */
    portableViewState: z
      .array(PortableViewStateFieldSchema)
      .max(PORTABLE_VIEW_STATE_FIELDS.length)
      .refine(
        (fields) => fields.every((f, i) => i === 0 || f > fields[i - 1]),
        'portableViewState must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Content-addressed asset kinds the adapter can bind (sorted set). */
    assetKinds: z
      .array(RendererAssetKindSchema)
      .max(RENDERER_ASSET_KINDS.length)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'assetKinds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
  })
  .superRefine((capabilities, ctx) => {
    if (!capabilities.degradation.includes('none')) {
      ctx.addIssue({
        code: 'custom',
        message: 'degradation must contain the neutral marker "none"',
        path: ['degradation'],
      });
    }
    if (capabilities.sessionSwitching && capabilities.portableViewState.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message:
          'an adapter that supports switching must declare at least one portable view-state field (the switch target must be able to restore the portable subset)',
        path: ['portableViewState'],
      });
    }
    if (capabilities.snapshotCapture && !capabilities.sessionSwitching) {
      ctx.addIssue({
        code: 'custom',
        message:
          'snapshotCapture (switch source) requires sessionSwitching (switch target) — adapters seed switches only if they can also receive them',
        path: ['sessionSwitching'],
      });
    }
  })
  .meta({
    id: 'RendererCapabilitySet',
    title: 'RendererCapabilitySet',
    description:
      'The fabric capability declaration of a renderer adapter: hit-testing, measurement/annotation translation, frame capture, switching/snapshot support, typed degradations, portable view-state restore fields, and bindable asset kinds.',
  });

/** One renderer capability set. */
export type RendererCapabilitySet = z.infer<typeof RendererCapabilitySetSchema>;
