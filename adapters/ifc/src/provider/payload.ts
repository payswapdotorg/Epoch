/**
 * @epoch/adapter-ifc — the PROVIDER seam (the exchange standard's
 * vocabulary allowed HERE and ONLY here).
 *
 * These schemas parse the fixture payloads that stand in for
 * building-model exchange documents (the W020/W022 reference precedent:
 * no live parsers, no network; fixtures carry the standard's shapes).
 * Everything the standard names — schema identifiers, entity classes,
 * relationship classes — stays inside this directory and is TRANSLATED
 * by `../projection.ts` into the neutral record vocabulary. The
 * neutrality blocklist test (test/neutrality.test.ts) enforces that no
 * standard token escapes the provider layer into the neutral seam
 * modules.
 *
 * Strict objects throughout: unknown fields in provider payloads are
 * rejected with typed issues (`unknown-provider-payload`), never
 * silently ignored.
 */
import { z } from 'zod';

/** The provider fixture envelope version (exactly one pinned form). */
export const PROVIDER_MODEL_VERSION = 1 as const;

/** The exchange-standard identity carried by fixtures (provider data). */
export const PROVIDER_STANDARD_NAME = 'ifc' as const;

/** The supported exchange-standard schema identifiers (the fixture form). */
export const PROVIDER_SCHEMA_IDENTIFIERS = ['IFC2X3', 'IFC4'] as const;

/** The provider's entity reference grammar (`#<digits>`). */
const PROVIDER_REF_PATTERN = /^#[0-9]+$/;

/** A provider attribute value (scalar; typed exchange attributes). */
const ProviderAttributeValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/** The provider's entity classes recognized by the reference mapping. */
export const PROVIDER_ENTITY_CLASSES = [
  'IfcSite',
  'IfcBuilding',
  'IfcBuildingStorey',
  'IfcSpace',
  'IfcWall',
  'IfcSlab',
  'IfcColumn',
  'IfcBeam',
  'IfcDoor',
  'IfcWindow',
] as const;

/** One building element of the exchange model, in the standard's shape. */
export const ProviderElementSchema = z
  .strictObject({
    ref: z.string().regex(PROVIDER_REF_PATTERN),
    entityClass: z.enum(PROVIDER_ENTITY_CLASSES),
    name: z.string().min(1).max(256).optional(),
    properties: z.record(z.string().min(1).max(128), ProviderAttributeValueSchema),
  })
  .readonly();

export type ProviderElement = z.infer<typeof ProviderElementSchema>;

/** The provider's relationship classes recognized by the reference mapping. */
export const PROVIDER_RELATION_CLASSES = [
  'IfcRelContainedInSpatialStructure',
  'IfcRelAggregates',
] as const;

/** One typed relationship of the exchange model, in the standard's shape. */
export const ProviderRelationSchema = z
  .strictObject({
    relationClass: z.enum(PROVIDER_RELATION_CLASSES),
    relating: z.string().regex(PROVIDER_REF_PATTERN),
    related: z.array(z.string().regex(PROVIDER_REF_PATTERN)).min(1).max(128),
  })
  .readonly();

export type ProviderRelation = z.infer<typeof ProviderRelationSchema>;

/**
 * One building-model fixture: the typed stand-in for an exchange
 * document. The file identity names the model; elements and relations
 * reference each other by the standard's `#<ref>` grammar.
 */
export const ProviderModelSchema = z
  .strictObject({
    schemaVersion: z.literal(PROVIDER_MODEL_VERSION),
    standard: z.literal(PROVIDER_STANDARD_NAME),
    schemaIdentifier: z.enum(PROVIDER_SCHEMA_IDENTIFIERS),
    file: z
      .strictObject({
        name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/),
      })
      .readonly(),
    elements: z.array(ProviderElementSchema).min(1).max(4096),
    relations: z.array(ProviderRelationSchema).max(4096),
  })
  .readonly()
  .superRefine((model, ctx) => {
    const refs = new Set(model.elements.map((element) => element.ref));
    if (refs.size !== model.elements.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'element refs must be unique within a model',
        path: ['elements'],
      });
    }
    for (const relation of model.relations) {
      if (!refs.has(relation.relating)) {
        ctx.addIssue({
          code: 'custom',
          message: `relation ${relation.relationClass} references relating element ${relation.relating} which is not present in the model`,
          path: ['relations'],
        });
      }
      for (const related of relation.related) {
        if (!refs.has(related)) {
          ctx.addIssue({
            code: 'custom',
            message: `relation ${relation.relationClass} references related element ${related} which is not present in the model`,
            path: ['relations'],
          });
        }
      }
    }
  });

export type ProviderModel = z.infer<typeof ProviderModelSchema>;

/** Total parse outcome of the provider seam (typed; never throws). */
export type ProviderModelParse =
  | { readonly success: true; readonly data: ProviderModel }
  | { readonly success: false; readonly error: z.ZodError };

/**
 * The provider's own entity classes, mapped to neutral construction
 * types HERE (the standard's vocabulary is translated at the provider
 * seam; the neutral projection layer never spells the standard's class
 * names).
 */
export function neutralEntityClassOf(providerClass: (typeof PROVIDER_ENTITY_CLASSES)[number]): string {
  switch (providerClass) {
    case 'IfcSite':
      return 'construction:site';
    case 'IfcBuilding':
      return 'construction:building';
    case 'IfcBuildingStorey':
      return 'construction:storey';
    case 'IfcSpace':
      return 'construction:space';
    case 'IfcWall':
      return 'construction:wall';
    case 'IfcSlab':
      return 'construction:slab';
    case 'IfcColumn':
      return 'construction:column';
    case 'IfcBeam':
      return 'construction:beam';
    case 'IfcDoor':
      return 'construction:door';
    case 'IfcWindow':
      return 'construction:window';
  }
}

/** The provider's relationship classes, mapped to neutral relation types. */
export function neutralRelationClassOf(
  providerClass: (typeof PROVIDER_RELATION_CLASSES)[number],
): 'construction:contained-in' | 'construction:aggregates' {
  return providerClass === 'IfcRelContainedInSpatialStructure'
    ? 'construction:contained-in'
    : 'construction:aggregates';
}

/**
 * The semantic admission rule (the standard's own containment semantics,
 * expressed HERE so the neutral layer never spells the class names):
 * exactly one spatial root, and every containment relation's container
 * is a spatial element. Violations are REASONS (never partial loads).
 */
export function admissionProblemOf(model: ProviderModel): string | undefined {
  const classes = new Map(model.elements.map((element) => [element.ref, element.entityClass]));
  const roots = model.elements.filter((element) => element.entityClass === 'IfcSite');
  if (roots.length === 0) return 'no-spatial-root';
  if (roots.length > 1) return 'multiple-spatial-roots';
  for (const relation of model.relations) {
    if (relation.relationClass === 'IfcRelContainedInSpatialStructure') {
      const container = classes.get(relation.relating);
      if (container !== 'IfcSite' && container !== 'IfcBuilding' && container !== 'IfcBuildingStorey' && container !== 'IfcSpace') {
        return 'non-spatial-container';
      }
    }
  }
  return undefined;
}

/**
 * Total parse of a provider payload (the provider seam's ONLY entrance
 * for untrusted bytes). Unknown shapes, unknown fields, and envelope
 * skew are typed issues — the caller surfaces them as
 * `unknown-provider-payload` (never a partial silent load).
 */
export function parseProviderModel(input: unknown): ProviderModelParse {
  return ProviderModelSchema.safeParse(input);
}
