/**
 * Provider-neutral zod primitives of the W056 fabric contract (Renderer
 * Fabric & Multi-Renderer Switching). Every schema here is a
 * JSON-representable data shape; no field encodes a vendor, engine,
 * renderer, or framework (architecture lock rule 13).
 *
 * Two id families live here:
 * - FABRIC-OWNED grammars: fabric session ids (`fx-`), switch ids (`sw-`),
 *   input ids (`rin-`), asset-binding ids (`rab-`), and semantic layer ids
 *   (`lyr-`) — neutral, fabric-scoped identities.
 * - MIRRORED W016 grammars (canonical home: @epoch/world-experience):
 *   world scene ids (`wsc-`) and world entity ids (bounded opaque strings).
 *   The mirrors are pinned member-for-member by compile-time and runtime
 *   parity tests in @epoch/renderer-fabric (the consumer that genuinely
 *   depends on both packages — the W011/W012 kernel-parity devDependency
 *   pattern, inverted: the fabric pins the contract's mirrors against the
 *   canonical home).
 */
import { z } from 'zod';
import {
  MAX_INPUT_KEY_LENGTH,
  MAX_INPUT_MODIFIERS,
} from './version';

/**
 * Fabric-session identifier: `fx-` + lowercase kebab slug. The identity of
 * one EPHEMERAL renderer fabric session (W056). The W013 renderer-session
 * id of the session's binding is DERIVED deterministically as `rs-` + the
 * same slug (see @epoch/renderer-fabric), so both ids stay caller-scoped
 * and replay-stable.
 */
export const FABRIC_SESSION_ID_PATTERN = /^fx-[a-z0-9][a-z0-9-]{0,62}$/;

export const FabricSessionIdSchema = z.string().regex(FABRIC_SESSION_ID_PATTERN).meta({
  id: 'FabricSessionId',
  title: 'FabricSessionId',
  description:
    'Renderer fabric-session identifier: "fx-" followed by a lowercase slug (ephemeral, non-authoritative).',
});

/** One fabric-session identifier. */
export type FabricSessionId = z.infer<typeof FabricSessionIdSchema>;

/** Switch identifier: `sw-` + lowercase kebab slug. */
export const SWITCH_ID_PATTERN = /^sw-[a-z0-9][a-z0-9-]{0,62}$/;

export const SwitchIdSchema = z.string().regex(SWITCH_ID_PATTERN).meta({
  id: 'SwitchId',
  title: 'SwitchId',
  description: 'Renderer switch identifier: "sw-" followed by a lowercase slug.',
});

/** One switch identifier. */
export type SwitchId = z.infer<typeof SwitchIdSchema>;

/** Input identifier: `rin-` + lowercase kebab slug. */
export const INPUT_ID_PATTERN = /^rin-[a-z0-9][a-z0-9-]{0,62}$/;

export const InputIdSchema = z.string().regex(INPUT_ID_PATTERN).meta({
  id: 'InputId',
  title: 'InputId',
  description: 'Renderer input identifier: "rin-" followed by a lowercase slug.',
});

/** One input identifier. */
export type InputId = z.infer<typeof InputIdSchema>;

/** Asset-binding identifier: `rab-` + lowercase kebab slug. */
export const ASSET_BINDING_ID_PATTERN = /^rab-[a-z0-9][a-z0-9-]{0,62}$/;

export const AssetBindingIdSchema = z.string().regex(ASSET_BINDING_ID_PATTERN).meta({
  id: 'AssetBindingId',
  title: 'AssetBindingId',
  description: 'Renderer asset-binding identifier: "rab-" followed by a lowercase slug.',
});

/** One asset-binding identifier. */
export type AssetBindingId = z.infer<typeof AssetBindingIdSchema>;

/**
 * Semantic-layer identifier: `lyr-` + lowercase kebab slug. Names an opaque
 * SEMANTIC layer of the world experience projection (a grouping of semantic
 * entities the host can show/hide as one unit); the layer vocabulary is
 * owned by the world experience projection — the fabric only carries its
 * visibility state.
 */
export const SEMANTIC_LAYER_ID_PATTERN = /^lyr-[a-z0-9][a-z0-9-]{0,62}$/;

export const SemanticLayerIdSchema = z.string().regex(SEMANTIC_LAYER_ID_PATTERN).meta({
  id: 'SemanticLayerId',
  title: 'SemanticLayerId',
  description:
    'Semantic-layer identifier: "lyr-" followed by a lowercase slug (vocabulary owned by the world experience projection).',
});

/** One semantic-layer identifier. */
export type SemanticLayerId = z.infer<typeof SemanticLayerIdSchema>;

/**
 * World scene identifier — MIRRORED W016 grammar (canonical home:
 * @epoch/world-experience, `WorldSceneId`): `wsc-` + lowercase kebab slug.
 * Parity-pinned by @epoch/renderer-fabric.
 */
export const WORLD_SCENE_ID_MIRROR_PATTERN = /^wsc-[a-z0-9][a-z0-9-]{0,62}$/;

export const WorldSceneIdMirrorSchema = z.string().regex(WORLD_SCENE_ID_MIRROR_PATTERN).meta({
  id: 'WorldSceneIdMirror',
  title: 'WorldSceneIdMirror',
  description:
    'World scene identifier (mirrored W016 grammar; canonical home @epoch/world-experience): "wsc-" + lowercase slug.',
});

/** One world-scene identifier (mirrored W016 grammar). */
export type WorldSceneIdMirror = z.infer<typeof WorldSceneIdMirrorSchema>;

/**
 * World entity identifier — MIRRORED W016 grammar (canonical home:
 * @epoch/world-experience, `WorldEntityId`): an opaque bounded string
 * (1..256). Scene entities are referenced opaquely, never embedded (the
 * W002 discipline). Parity-pinned by @epoch/renderer-fabric.
 */
export const WorldEntityIdMirrorSchema = z.string().min(1).max(256).meta({
  id: 'WorldEntityIdMirror',
  title: 'WorldEntityIdMirror',
  description:
    'World entity identifier (mirrored W016 grammar; canonical home @epoch/world-experience): opaque bounded string.',
});

/** One world-entity identifier (mirrored W016 grammar). */
export type WorldEntityIdMirror = z.infer<typeof WorldEntityIdMirrorSchema>;

/** Sorted, duplicate-free entity-id set (deterministic set semantics). */
export const EntityIdSetSchema = z
  .array(WorldEntityIdMirrorSchema)
  .min(1)
  .refine(
    (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
    'entity id sets must be sorted ascending and duplicate-free (deterministic set semantics)',
  );

/** One sorted entity-id set. */
export type EntityIdSet = z.infer<typeof EntityIdSetSchema>;

/** One normalized pointer position in the renderer viewport (0..1 both axes). */
export const PointerPositionSchema = z
  .strictObject({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .meta({
    id: 'PointerPosition',
    title: 'PointerPosition',
    description: 'Normalized pointer position in the renderer viewport: x/y in [0, 1].',
  });

/** One normalized pointer position. */
export type PointerPosition = z.infer<typeof PointerPositionSchema>;

/** One key descriptor of a key-down/key-up input. */
export const InputKeySchema = z
  .strictObject({
    key: z.string().min(1).max(MAX_INPUT_KEY_LENGTH),
    modifiers: z
      .array(z.string().min(1).max(MAX_INPUT_KEY_LENGTH))
      .max(MAX_INPUT_MODIFIERS)
      .refine(
        (mods) => mods.every((m, i) => i === 0 || m > mods[i - 1]),
        'modifiers must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
  })
  .meta({
    id: 'InputKey',
    title: 'InputKey',
    description: 'One key input: a bounded key token plus its sorted modifier set.',
  });

/** One key descriptor. */
export type InputKey = z.infer<typeof InputKeySchema>;
