/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W007 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  CapabilityCategory,
  CapabilityContractReference,
  CapabilityDescriptor,
  CapabilityId,
  CapabilityLifecycleState,
  CapabilityManifest,
  CapabilityOrigin,
  CapabilityRecord,
  CapabilityRegistration,
  CapabilityTrust,
  CapabilityVersion,
  RegistryIssue,
} from './types';
import type {
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
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { VersionConstraint } from './semver';

export type CapabilityRegistrySchemaSync = [
  Expect<Equals<z.infer<typeof CapabilityManifestVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof CapabilityCategorySchema>, CapabilityCategory>>,
  Expect<Equals<z.infer<typeof CapabilityLifecycleStateSchema>, CapabilityLifecycleState>>,
  Expect<Equals<z.infer<typeof CapabilityOriginSchema>, CapabilityOrigin>>,
  Expect<Equals<z.infer<typeof CapabilityIdSchema>, CapabilityId>>,
  Expect<Equals<z.infer<typeof SemverCoreSchema>, CapabilityVersion>>,
  Expect<Equals<z.infer<typeof CapabilityContractReferenceSchema>, CapabilityContractReference>>,
  Expect<Equals<z.infer<typeof CapabilityTrustSchema>, CapabilityTrust>>,
  Expect<Equals<z.infer<typeof CapabilityDescriptorSchema>, CapabilityDescriptor>>,
  Expect<Equals<z.infer<typeof CapabilityManifestSchema>, CapabilityManifest>>,
  Expect<Equals<z.infer<typeof CapabilityRecordSchema>, CapabilityRecord>>,
  Expect<Equals<z.infer<typeof VersionConstraintSchema>, VersionConstraint>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type CapabilityRegistryLiteralSync = [
  Expect<
    Equals<
      CapabilityCategory,
      'source' | 'semantic' | 'reconstruction' | 'visualization' | 'simulation' | 'evaluator' | 'action' | 'verification'
    >
  >,
  Expect<Equals<CapabilityLifecycleState, 'registered' | 'deprecated' | 'retired'>>,
  Expect<
    Equals<
      CapabilityOrigin,
      'first-party' | 'community' | 'external-software' | 'provisional-document-derived'
    >
  >,
];

/** Result/error surface shape sanity. */
export type CapabilityRegistryResultSync = [
  Expect<Equals<CapabilityRegistration['digest'], Sha256Hex>>,
  Expect<Equals<RegistryIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<CapabilityRecord['manifestDigest'], Sha256Hex>>,
];
