/**
 * The domain visual ontology — pack-contributable semantic visualizations
 * as typed records with versioned discriminators
 * (spec/experience-architecture "Domain visual ontology" — binding):
 * 2D symbols, 3D representations, materials/textures, state overlays,
 * animations, and interaction affordances.
 *
 * Ontology records are DECLARATIONS contributed by packs/extensions: pure
 * typed data that tells the world view HOW to present semantic content
 * (which symbol, which representation, which material, which overlay
 * recipe, which animation, which interactions are offered). They never
 * become semantic authority (lock rule 8): an ontology record references
 * world semantics opaquely (entity-type keys are opaque strings) and
 * never embeds world state.
 *
 * Records live in an in-memory reference registry
 * ({@link WorldOntology}); scenes reference records by opaque id and the
 * renderer-envelope compiler resolves them (unresolvable ids are typed
 * `unknown-ontology-record` rejections). A record whose `recordKind` is
 * outside the closed vocabulary is likewise a typed
 * `unknown-ontology-record` rejection at admission.
 */
import { z } from 'zod';
import {
  AnimationTrackSchema,
  ColorHexSchema,
  Geometry2dSchema,
  InteractionModalitySchema,
  MeshBindingSchema,
  Sha256HexSchema,
  SpatialPrimitiveSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  TenantScopeSchema,
  type AnimationTrack,
  type ColorHex,
  type Geometry2d,
  type InteractionModality,
  type MeshBinding,
  type Sha256Hex,
  type SpatialPrimitive,
  type StrokeStyle2d,
  type FillStyle2d,
  type TenantScope,
} from '@epoch/experience-protocol';
import {
  MAX_AFFORDANCE_INTERACTIONS,
  MAX_ONTOLOGY_ANIMATION_TRACKS,
  MAX_ONTOLOGY_RECORDS,
  WORLD_ONTOLOGY_VERSION,
  WorldInteractionKindSchema,
} from './version';
import {
  OpaqueScopeIdSchema,
  WorldOntologyRecordIdSchema,
  type OpaqueScopeId,
  type WorldOntologyRecordId,
} from './primitives';
import {
  malformedRecord,
  malformedRecordError,
  unknownOntologyRecordError,
  versionUnsupportedError,
} from './issues';
import type { WorldExperienceResult } from './errors';

/** Entity-type key an ontology record applies to (opaque world vocabulary). */
const AppliesToTypes = z
  .array(z.string().min(1).max(256))
  .min(1)
  .max(64)
  .refine(
    (types) => types.every((t, i) => i === 0 || t > types[i - 1]),
    'appliesTo entity types must be sorted ascending and duplicate-free (deterministic set semantics)',
  );

/** A 2D symbol recipe: geometry plus optional stroke/fill styling. */
const Symbol2dRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('symbol-2d'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    appliesTo: AppliesToTypes,
    geometry: Geometry2dSchema,
    stroke: StrokeStyle2dSchema.optional(),
    fill: FillStyle2dSchema.optional(),
  })
  .meta({ id: 'Symbol2dRecord', title: 'Symbol2dRecord' });

/** A 3D representation recipe: spatial primitive plus optional material binding. */
const Representation3dRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('representation-3d'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    appliesTo: AppliesToTypes,
    primitive: SpatialPrimitiveSchema,
    scale: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
    mesh: MeshBindingSchema.optional(),
    materialRecordId: WorldOntologyRecordIdSchema.optional(),
  })
  .superRefine((record, ctx) => {
    if (record.primitive === 'mesh' && record.mesh === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a "mesh" representation requires its content-addressed mesh binding',
        path: ['mesh'],
      });
    }
    if (record.primitive !== 'mesh' && record.mesh !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a mesh binding is only valid on the "mesh" primitive',
        path: ['mesh'],
      });
    }
  })
  .meta({ id: 'Representation3dRecord', title: 'Representation3dRecord' });

/** A material/texture recipe: neutral surface parameters plus optional texture asset. */
const MaterialRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('material'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    color: ColorHexSchema.optional(),
    opacity: z.number().finite().min(0).max(1).optional(),
    roughness: z.number().finite().min(0).max(1).optional(),
    metalness: z.number().finite().min(0).max(1).optional(),
    texture: z
      .strictObject({
        assetDigest: Sha256HexSchema,
        byteSize: z.number().int().positive(),
        mediaType: z.string().min(1).max(128),
      })
      .optional(),
  })
  .meta({ id: 'MaterialRecord', title: 'MaterialRecord' });

/** A state-overlay recipe: a named state presented as tint/badge. */
const StateOverlayRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('state-overlay'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    appliesTo: AppliesToTypes,
    stateKey: z.string().min(1).max(128),
    tint: ColorHexSchema.optional(),
    badgeLabel: z.string().max(64).optional(),
  })
  .meta({ id: 'StateOverlayRecord', title: 'StateOverlayRecord' });

/** An animation recipe: tracks of keyframed presentation properties. */
const AnimationRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('animation'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    appliesTo: AppliesToTypes,
    durationMs: z.number().int().positive(),
    loop: z.boolean(),
    tracks: z.array(AnimationTrackSchema).min(1).max(MAX_ONTOLOGY_ANIMATION_TRACKS),
  })
  .superRefine((record, ctx) => {
    const keys = record.tracks.map((t) => `${t.targetNodeId}\u0000${t.propertyPath}`);
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i] <= keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'tracks must be sorted by (targetNodeId, propertyPath) ascending and duplicate-free (the W011 clip discipline)',
          path: ['tracks'],
        });
        return;
      }
    }
    for (const track of record.tracks) {
      const last = track.keyframes[track.keyframes.length - 1];
      if (last.atMs > record.durationMs) {
        ctx.addIssue({
          code: 'custom',
          message: `keyframe at ${last.atMs}ms exceeds the record duration (${record.durationMs}ms)`,
          path: ['durationMs'],
        });
        return;
      }
    }
  })
  .meta({ id: 'AnimationRecord', title: 'AnimationRecord' });

/** An interaction-affordance recipe: which world interactions an entity offers, via which modalities. */
const AffordanceRecordSchema = z
  .strictObject({
    ontologyVersion: z.literal(WORLD_ONTOLOGY_VERSION),
    recordId: WorldOntologyRecordIdSchema,
    recordKind: z.literal('affordance'),
    tenantScope: TenantScopeSchema,
    contributor: z.strictObject({ packId: OpaqueScopeIdSchema }),
    appliesTo: AppliesToTypes,
    interactions: z
      .array(WorldInteractionKindSchema)
      .min(1)
      .max(MAX_AFFORDANCE_INTERACTIONS)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'affordance interactions must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    modalities: z
      .array(InteractionModalitySchema)
      .min(1)
      .max(7)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'affordance modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
  })
  .meta({ id: 'AffordanceRecord', title: 'AffordanceRecord' });

/** The domain visual ontology record union (discriminated on `recordKind`). */
export const WorldOntologyRecordSchema = z
  .discriminatedUnion('recordKind', [
    Symbol2dRecordSchema,
    Representation3dRecordSchema,
    MaterialRecordSchema,
    StateOverlayRecordSchema,
    AnimationRecordSchema,
    AffordanceRecordSchema,
  ])
  .meta({
    id: 'WorldOntologyRecord',
    title: 'WorldOntologyRecord',
    description:
      'One pack-contributed domain visual ontology record: symbol-2d, representation-3d, material, state-overlay, animation, or affordance — typed presentation declarations, never semantic authority.',
  });

/** One ontology record. */
export type WorldOntologyRecord = z.infer<typeof WorldOntologyRecordSchema>;

/** One 2D-symbol ontology record. */
export type Symbol2dRecord = z.infer<typeof Symbol2dRecordSchema>;

/** One 3D-representation ontology record. */
export type Representation3dRecord = z.infer<typeof Representation3dRecordSchema>;

/** One material ontology record. */
export type MaterialRecord = z.infer<typeof MaterialRecordSchema>;

/** One state-overlay ontology record. */
export type StateOverlayRecord = z.infer<typeof StateOverlayRecordSchema>;

/** One animation ontology record. */
export type AnimationRecord = z.infer<typeof AnimationRecordSchema>;

/** One interaction-affordance ontology record. */
export type AffordanceRecord = z.infer<typeof AffordanceRecordSchema>;

/** The in-memory ontology state: records sorted by recordId (deterministic iteration). */
export interface WorldOntology {
  readonly records: readonly WorldOntologyRecord[];
}

/**
 * The total admission surface for one serialized ontology record. Never
 * throws. Precedence: root shape → version gate (`ontologyVersion`) →
 * discriminator gate (an unknown `recordKind` is a typed
 * `unknown-ontology-record` rejection, distinguishable from generic
 * malformation) → schema gate (strict objects reject unknown/vendor
 * fields).
 */
export function admitOntologyRecord(input: unknown): WorldExperienceResult<WorldOntologyRecord> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: malformedRecord([{ path: '$', message: 'expected a JSON object at the record root' }]),
    };
  }
  const encountered = (input as Record<string, unknown>).ontologyVersion;
  if (typeof encountered === 'number' || typeof encountered === 'string') {
    const encounteredNumber = typeof encountered === 'number' ? encountered : Number(encountered);
    if (encounteredNumber !== WORLD_ONTOLOGY_VERSION) {
      return {
        ok: false,
        error: versionUnsupportedError(String(WORLD_ONTOLOGY_VERSION), String(encountered)),
      };
    }
  }
  const discriminator = (input as Record<string, unknown>).recordKind;
  if (
    discriminator !== undefined &&
    typeof discriminator === 'string' &&
    !['symbol-2d', 'representation-3d', 'material', 'state-overlay', 'animation', 'affordance'].includes(
      discriminator,
    )
  ) {
    return {
      ok: false,
      error: unknownOntologyRecordError(
        `unknown ontology record discriminator "${discriminator}" — the closed vocabulary is [symbol-2d, representation-3d, material, state-overlay, animation, affordance]`,
        { discriminator, path: ['recordKind'] },
      ),
    };
  }
  const parsed = WorldOntologyRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Register ontology records into an ontology state (pure: returns a new
 * state). Duplicate record ids are typed malformed-record rejections;
 * state size is bounded (MAX_ONTOLOGY_RECORDS).
 */
export function registerOntologyRecords(
  ontology: WorldOntology,
  records: readonly WorldOntologyRecord[],
): WorldExperienceResult<WorldOntology> {
  const validated = z.array(WorldOntologyRecordSchema).max(MAX_ONTOLOGY_RECORDS).safeParse(records);
  if (!validated.success) {
    return { ok: false, error: malformedRecordError(validated.error) };
  }
  const existing = new Map(ontology.records.map((r) => [r.recordId, r]));
  for (const record of validated.data) {
    if (existing.has(record.recordId)) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'recordId',
            message: `duplicate ontology record id "${record.recordId}"`,
          },
        ]),
      };
    }
    existing.set(record.recordId, record);
  }
  if (existing.size > MAX_ONTOLOGY_RECORDS) {
    return {
      ok: false,
      error: malformedRecord([
        {
          path: 'records',
          message: `an ontology is limited to ${MAX_ONTOLOGY_RECORDS} records`,
        },
      ]),
    };
  }
  const next = [...existing.values()].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  return { ok: true, value: { records: next } };
}

/** The empty ontology state. */
export function emptyOntology(): WorldOntology {
  return { records: [] };
}

/**
 * Resolve one ontology record by id: unresolvable ids are typed
 * `unknown-ontology-record` rejections (the scene referenced presentation
 * vocabulary the ontology does not carry).
 */
export function resolveOntologyRecord(
  ontology: WorldOntology,
  recordId: WorldOntologyRecordId,
): WorldExperienceResult<WorldOntologyRecord> {
  const record = ontology.records.find((r) => r.recordId === recordId);
  if (record === undefined) {
    return {
      ok: false,
      error: unknownOntologyRecordError(
        `the ontology does not carry a record with id "${recordId}"`,
        { recordId, path: ['ontology', recordId] },
      ),
    };
  }
  return { ok: true, value: record };
}

/** Resolve a record and require a specific record kind. */
export function resolveOntologyRecordOfKind<K extends WorldOntologyRecord['recordKind']>(
  ontology: WorldOntology,
  recordId: WorldOntologyRecordId,
  recordKind: K,
): WorldExperienceResult<Extract<WorldOntologyRecord, { recordKind: K }>> {
  const resolved = resolveOntologyRecord(ontology, recordId);
  if (!resolved.ok) {
    return resolved;
  }
  if (resolved.value.recordKind !== recordKind) {
    return {
      ok: false,
      error: unknownOntologyRecordError(
        `the ontology record "${recordId}" has kind "${resolved.value.recordKind}", but "${recordKind}" is required here`,
        { recordId, path: ['ontology', recordId] },
      ),
    };
  }
  return { ok: true, value: resolved.value as Extract<WorldOntologyRecord, { recordKind: K }> };
}

/** List the ontology records applying to one entity type (sorted by recordId). */
export function ontologyRecordsForEntityType(
  ontology: WorldOntology,
  entityType: string,
): readonly WorldOntologyRecord[] {
  return ontology.records.filter((r) => r.recordKind !== 'material' && r.appliesTo.includes(entityType));
}

/** Ontology usage accounting (pure). */
export interface OntologyUsage {
  readonly recordCount: number;
  readonly symbolCount: number;
  readonly representationCount: number;
  readonly materialCount: number;
  readonly stateOverlayCount: number;
  readonly animationCount: number;
  readonly affordanceCount: number;
}

/** Compute the ontology usage record of an ontology state. */
export function computeOntologyUsage(ontology: WorldOntology): OntologyUsage {
  let symbolCount = 0;
  let representationCount = 0;
  let materialCount = 0;
  let stateOverlayCount = 0;
  let animationCount = 0;
  let affordanceCount = 0;
  for (const record of ontology.records) {
    switch (record.recordKind) {
      case 'symbol-2d':
        symbolCount += 1;
        break;
      case 'representation-3d':
        representationCount += 1;
        break;
      case 'material':
        materialCount += 1;
        break;
      case 'state-overlay':
        stateOverlayCount += 1;
        break;
      case 'animation':
        animationCount += 1;
        break;
      case 'affordance':
        affordanceCount += 1;
        break;
    }
  }
  return {
    recordCount: ontology.records.length,
    symbolCount,
    representationCount,
    materialCount,
    stateOverlayCount,
    animationCount,
    affordanceCount,
  };
}

/** Exported for the schema surface registry (type-level only). */
export type OntologyColor = ColorHex;
export type OntologyDigest = Sha256Hex;
export type OntologyGeometry = Geometry2d;
export type OntologyModality = InteractionModality;
export type OntologyPrimitive = SpatialPrimitive;
export type OntologyMesh = MeshBinding;
export type OntologyStroke = StrokeStyle2d;
export type OntologyFill = FillStyle2d;
export type OntologyTrack = AnimationTrack;
export type OntologyTenantScope = TenantScope;
export type OntologyContributor = OpaqueScopeId;
