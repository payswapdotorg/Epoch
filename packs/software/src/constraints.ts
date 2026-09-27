/**
 * Software constraint descriptors (DP1.0 "constraints"): typed vocabulary
 * entries compatible with the W004 constraint-language / policy-contract
 * shapes — each descriptor carries a constraint id in the W004 grammar and
 * a `policyBinding` that PARSES through the W004 `policyBindingSchema`
 * (pinned by the devDep parity test). The Constraint Engine remains the
 * constraint authority; the pack only teaches the software constraint
 * vocabulary.
 */
import { z } from 'zod';
import { QualifiedNameSchema, SemverCoreSchema } from '@epoch/solution-delivery';
import {
  SOFTWARE_CONSTRAINT_CATEGORIES,
  SOFTWARE_PACK_RECORD_VERSION,
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
      'The W004-compatible policy binding of a software constraint descriptor: the bound constraint id (W004 grammar) plus an optional exact version pin.',
  });

/** One constraint policy binding. */
export type ConstraintPolicyBinding = z.infer<typeof ConstraintPolicyBindingSchema>;

/** One software constraint descriptor. */
export const SoftwareConstraintDescriptorSchema = z
  .strictObject({
    schema: z.literal(CONSTRAINT_DESCRIPTOR_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    descriptorId: QualifiedNameSchema,
    /** The W004 constraint id this descriptor teaches (grammar-compatible). */
    constraintId: z.string().regex(CONSTRAINT_ID_PATTERN),
    title: z.string().min(1).max(256),
    category: z.enum(SOFTWARE_CONSTRAINT_CATEGORIES),
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
    id: 'SoftwareConstraintDescriptor',
    title: 'SoftwareConstraintDescriptor',
    description:
      'One software constraint descriptor: a W004-grammar constraint id, category, W004-compatible policy binding and description — vocabulary data; the Constraint Engine stays the authority.',
  });

/** One software constraint descriptor. */
export type SoftwareConstraintDescriptor = z.infer<typeof SoftwareConstraintDescriptorSchema>;

/**
 * The software constraint vocabulary: typed descriptor entries, sorted by
 * descriptorId ascending, duplicate-free. Categories cover security,
 * compliance, technical, operational and commercial software constraints.
 */
export const SOFTWARE_CONSTRAINT_DESCRIPTORS: readonly SoftwareConstraintDescriptor[] = [
  {
    schema: 'epoch.pack-software.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'software.constraint.change-freeze',
    constraintId: 'deployment-change-freeze',
    title: 'Deployment change freeze',
    category: 'operational',
    policyBinding: { constraintId: 'deployment-change-freeze' },
    description:
      'Change-freeze windows block release rollouts to protected environments; rollout steps inside a freeze are schedule conflicts, not silent slips.',
  },
  {
    schema: 'epoch.pack-software.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'software.constraint.data-residency',
    constraintId: 'data-residency-region',
    title: 'Data residency region',
    category: 'compliance',
    policyBinding: { constraintId: 'data-residency-region' },
    description:
      'Personal and regulated data must remain within the approved residency regions; deployment topologies and data migrations are constrained out of every non-conforming alternative during Decide.',
  },
  {
    schema: 'epoch.pack-software.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'software.constraint.least-privilege',
    constraintId: 'least-privilege-access',
    title: 'Least-privilege access',
    category: 'security',
    policyBinding: { constraintId: 'least-privilege-access' },
    description:
      'Services and deployment identities receive the minimum scopes their rollout steps require; broader access grants are security constraint violations during Plan and Realize.',
  },
  {
    schema: 'epoch.pack-software.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'software.constraint.service-level',
    constraintId: 'service-level-objective',
    title: 'Service level objective',
    category: 'commercial',
    policyBinding: { constraintId: 'service-level-objective' },
    description:
      'Committed reliability and performance objectives bound release decisions; rollouts that would breach an objective require explicit remediation before release.',
  },
  {
    schema: 'epoch.pack-software.constraint-descriptor',
    schemaVersion: 1,
    descriptorId: 'software.constraint.supported-platform',
    constraintId: 'supported-platform-versions',
    title: 'Supported platform versions',
    category: 'technical',
    policyBinding: { constraintId: 'supported-platform-versions' },
    description:
      'Runtime and dependency platform versions must stay inside the supported matrix; upgrade and migration work packages are constrained to the supported transitions.',
  },
];

/**
 * Find the software constraint descriptor for one W004 constraint id: a
 * pure lookup fold. Deterministic: the FIRST descriptor (descriptorId
 * order) matching wins; unmatched ids describe as undefined.
 */
export function findConstraintDescriptor(
  descriptors: readonly SoftwareConstraintDescriptor[],
  constraintId: string,
): SoftwareConstraintDescriptor | undefined {
  const sorted = [...descriptors].sort((a, b) => (a.descriptorId < b.descriptorId ? -1 : 1));
  return sorted.find((descriptor) => descriptor.constraintId === constraintId);
}
