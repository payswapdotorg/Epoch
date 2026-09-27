/**
 * Construction constraint descriptors (DP1.0 "constraints"): typed
 * vocabulary entries compatible with the W004 constraint-language /
 * policy-contract shapes — each descriptor carries a constraint id in the
 * W004 grammar and a `policyBinding` that PARSES through the W004
 * `policyBindingSchema` (pinned by the devDep parity test). The Constraint
 * Engine remains the constraint authority; the pack only teaches the
 * construction constraint vocabulary.
 */
import { z } from 'zod';
import { QualifiedNameSchema, SemverCoreSchema } from '@epoch/solution-delivery';
import {
  CONSTRUCTION_CONSTRAINT_CATEGORIES,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRAINT_DESCRIPTOR_SCHEMA_NAME,
} from './version';

/** The W004 constraint-id grammar (constraint-language): lowercase kebab, max 127 chars. */
export const CONSTRAINT_ID_PATTERN = /^[a-z][a-z0-9-]{0,127}$/;

/**
 * The policy binding of one descriptor — structurally compatible with the
 * W004 `policyBindingSchema` (constraint id + optional exact version pin);
 * the parity test parses every descriptor binding through the W004 schema.
 */
export const ConstraintPolicyBindingSchema = z
  .strictObject({
    constraintId: z.string().regex(CONSTRAINT_ID_PATTERN),
    constraintVersion: SemverCoreSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'ConstraintPolicyBinding',
    title: 'ConstraintPolicyBinding',
    description:
      'The W004-compatible policy binding of a construction constraint descriptor: the bound constraint id (W004 grammar) plus an optional exact version pin.',
  });

/** One constraint policy binding. */
export type ConstraintPolicyBinding = z.infer<typeof ConstraintPolicyBindingSchema>;

/** One construction constraint descriptor. */
export const ConstructionConstraintDescriptorSchema = z
  .strictObject({
    schema: z.literal(CONSTRAINT_DESCRIPTOR_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    descriptorId: QualifiedNameSchema,
    /** The W004 constraint id this descriptor teaches (grammar-compatible). */
    constraintId: z.string().regex(CONSTRAINT_ID_PATTERN),
    title: z.string().min(1).max(256),
    category: z.enum(CONSTRUCTION_CONSTRAINT_CATEGORIES),
    policyBinding: ConstraintPolicyBindingSchema,
    description: z.string().max(2048),
  })
  .readonly()
  .superRefine((descriptor, ctx) => {
    if (descriptor.policyBinding.constraintId !== descriptor.constraintId) {
      ctx.addIssue({
        code: 'custom',
        message: 'policyBinding.constraintId must equal the descriptor constraintId (one descriptor teaches one W004 constraint)',
        path: ['policyBinding'],
      });
    }
  })
  .meta({
    id: 'ConstructionConstraintDescriptor',
    title: 'ConstructionConstraintDescriptor',
    description:
      'One construction constraint descriptor: a W004-grammar constraint id, category, W004-compatible policy binding and description — vocabulary data; the Constraint Engine stays the authority.',
  });

/** One construction constraint descriptor. */
export type ConstructionConstraintDescriptor = z.infer<typeof ConstructionConstraintDescriptorSchema>;

/**
 * The construction constraint vocabulary: typed descriptor entries, sorted
 * by descriptorId ascending, duplicate-free. Categories cover safety,
 * regulatory, technical, environmental and commercial construction
 * constraints.
 */
export const CONSTRUCTION_CONSTRAINT_DESCRIPTORS: readonly ConstructionConstraintDescriptor[] = [
  {
    schema: 'epoch.pack-construction.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'construction.constraint.height-limit',
    constraintId: 'max-building-height',
    title: 'Maximum building height',
    category: 'regulatory',
    policyBinding: { constraintId: 'max-building-height' },
    description:
      'Planning permission caps the building height; vertical elements above the cap are constrained out of every alternative during Decide.',
  },
  {
    schema: 'epoch.pack-construction.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'construction.constraint.hoisting-exclusion',
    constraintId: 'hoisting-exclusion-zone',
    title: 'Hoisting exclusion zone',
    category: 'safety',
    policyBinding: { constraintId: 'hoisting-exclusion-zone' },
    description:
      'Tower-crane hoisting paths exclude occupied areas; activities under a lift plan require sequencing constraints during Plan and Realize.',
  },
  {
    schema: 'epoch.pack-construction.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'construction.constraint.noise-hours',
    constraintId: 'noise-restriction-hours',
    title: 'Noise restriction hours',
    category: 'environmental',
    policyBinding: { constraintId: 'noise-restriction-hours' },
    description:
      'Permitted noisy-works windows constrain the programme; activities outside the windows are schedule conflicts, not silent slips.',
  },
  {
    schema: 'epoch.pack-construction.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'construction.constraint.retention-release',
    constraintId: 'retention-release-terms',
    title: 'Retention release terms',
    category: 'commercial',
    policyBinding: { constraintId: 'retention-release-terms' },
    description:
      'Retention release follows practical completion and defects liability outcome records; payment projections respect the split.',
  },
  {
    schema: 'epoch.pack-construction.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'construction.constraint.site-access',
    constraintId: 'site-access-window',
    title: 'Site access window',
    category: 'technical',
    policyBinding: { constraintId: 'site-access-window' },
    description:
      'Site access is limited to agreed logistics windows; deliveries and plant moves inside the windows constrain acquisition and realization sequencing.',
  },
];

/**
 * Find the construction constraint descriptor for one W04 constraint id: a
 * pure lookup fold. Deterministic: the FIRST descriptor (descriptorId
 * order) matching wins; unmatched ids describe as undefined.
 */
export function findConstraintDescriptor(
  descriptors: readonly ConstructionConstraintDescriptor[],
  constraintId: string,
): ConstructionConstraintDescriptor | undefined {
  const sorted = [...descriptors].sort((a, b) => (a.descriptorId < b.descriptorId ? -1 : 1));
  return sorted.find((descriptor) => descriptor.constraintId === constraintId);
}
