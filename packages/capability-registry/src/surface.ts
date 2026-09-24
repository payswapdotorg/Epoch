/**
 * The capability-registry schema surface registry: every data type
 * published at the `@epoch/capability-registry` ownership boundary,
 * paired with its zod schema (W007 publishes its versioned contract
 * surface inside the package; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  CapabilityCategorySchema,
  CapabilityContractReferenceSchema,
  CapabilityDescriptorSchema,
  CapabilityIdSchema,
  CapabilityLifecycleStateSchema,
  CapabilityManifestSchema,
  CapabilityManifestVersionSchema,
  CapabilityOriginSchema,
  CapabilityRecordSchema,
  CapabilityTrustSchema,
  SemverCoreSchema,
  VersionConstraintSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the capability-registry contract v1. */
export const CAPABILITY_REGISTRY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'CapabilityCategory', schema: CapabilityCategorySchema },
  { type: 'CapabilityContractReference', schema: CapabilityContractReferenceSchema },
  { type: 'CapabilityDescriptor', schema: CapabilityDescriptorSchema },
  { type: 'CapabilityId', schema: CapabilityIdSchema },
  { type: 'CapabilityLifecycleState', schema: CapabilityLifecycleStateSchema },
  { type: 'CapabilityManifest', schema: CapabilityManifestSchema },
  { type: 'CapabilityManifestVersion', schema: CapabilityManifestVersionSchema },
  { type: 'CapabilityOrigin', schema: CapabilityOriginSchema },
  { type: 'CapabilityRecord', schema: CapabilityRecordSchema },
  { type: 'CapabilityTrust', schema: CapabilityTrustSchema },
  { type: 'SemverCore', schema: SemverCoreSchema },
  { type: 'VersionConstraint', schema: VersionConstraintSchema },
];
