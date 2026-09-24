/**
 * @epoch/capability-registry — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * registry door (same policy as the W002/W006 validators). Every exported
 * schema is part of the published surface emitted under `schemas/`.
 */
import { z } from 'zod';
import {
  CAPABILITY_FABRIC_CATEGORIES,
  ParameterSpecSchema,
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
} from '@epoch/agent-protocol';
import {
  CAPABILITY_LIFECYCLE_STATES,
  CAPABILITY_MANIFEST_VERSION,
  CAPABILITY_ORIGINS,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Semver core string (the frozen agent-protocol shared pattern). */
export const SemverCoreSchema = z
  .string()
  .regex(SEMVER_CORE_PATTERN, 'must be a semver core "major.minor.patch"')
  .meta({
    id: 'SemverCore',
    title: 'SemverCore',
    description: 'Semantic-version core (major.minor.patch, digits only, no prerelease/build suffixes).',
  });

/** Version discriminator on serialized manifests and records (v1). */
export const CapabilityManifestVersionSchema = z
  .literal(CAPABILITY_MANIFEST_VERSION)
  .meta({
    id: 'CapabilityManifestVersion',
    title: 'CapabilityManifestVersion',
    description: 'Version discriminator carried by every serialized capability manifest and record (currently 1).',
  });

/** The Capability Fabric adapter categories (agent-protocol vocabulary). */
export const CapabilityCategorySchema = z.enum(CAPABILITY_FABRIC_CATEGORIES).meta({
  id: 'CapabilityCategory',
  title: 'CapabilityCategory',
  description:
    'Capability Fabric adapter category: source, semantic, reconstruction, visualization, simulation, evaluator, action, or verification.',
});

/** Capability lifecycle states. */
export const CapabilityLifecycleStateSchema = z
  .enum(CAPABILITY_LIFECYCLE_STATES)
  .meta({
    id: 'CapabilityLifecycleState',
    title: 'CapabilityLifecycleState',
    description:
      'Capability lifecycle: registered, deprecated (advisory — still resolves), or retired (terminal — does not resolve for new bindings).',
  });

/** Capability origin classes (architecture.md, Capability Fabric). */
export const CapabilityOriginSchema = z.enum(CAPABILITY_ORIGINS).meta({
  id: 'CapabilityOrigin',
  title: 'CapabilityOrigin',
  description:
    'Where a registered capability originates: first-party, community, external software, or provisional document-derived.',
});

/** Opaque capability identity: dot-namespaced qualified name. */
export const CapabilityIdSchema = z
  .string()
  .regex(QUALIFIED_NAME_PATTERN, 'must be a dot-namespaced qualified name (e.g. "engineering.stress-analysis")')
  .meta({
    id: 'CapabilityId',
    title: 'CapabilityId',
    description: 'Opaque, stable capability identity: dot-namespaced qualified name; the extension scoping unit (lock rule 9).',
  });

/** Reference to a versioned contract a capability honors. */
export const CapabilityContractReferenceSchema = z
  .strictObject({
    contractId: z.string().regex(QUALIFIED_NAME_PATTERN),
    contractVersion: SemverCoreSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityContractReference',
    title: 'CapabilityContractReference',
    description: 'Reference to a versioned contract a capability honors: qualified contract id plus semver core version.',
  });

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** The trust metadata surface. */
export const CapabilityTrustSchema = z
  .strictObject({
    origin: CapabilityOriginSchema,
    curator: z.string().min(1).max(256).optional(),
    attestationDigest: Sha256DigestSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'CapabilityTrust',
    title: 'CapabilityTrust',
    description: 'Provider-neutral trust surface: origin class, optional opaque curator, optional attestation digest.',
  });

/** The provider-neutral capability descriptor. */
export const CapabilityDescriptorSchema = z
  .strictObject({
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    inputs: z.array(ParameterSpecSchema).readonly(),
    outputs: z.array(ParameterSpecSchema).readonly(),
    assumptions: z.array(z.string().min(1).max(2000)).readonly(),
  })
  .readonly()
  .meta({
    id: 'CapabilityDescriptor',
    title: 'CapabilityDescriptor',
    description:
      'Provider-neutral capability descriptor: display name, inputs, outputs, and stated assumptions (shared ParameterSpec shape).',
  });

/**
 * The capability manifest. Runtime refinement (not representable in the
 * structural JSON Schema projection): referenced contract ids must be
 * duplicate-free — one contract id pins exactly one version per manifest.
 */
export const CapabilityManifestSchema = z
  .strictObject({
    schemaVersion: CapabilityManifestVersionSchema,
    capabilityId: CapabilityIdSchema,
    category: CapabilityCategorySchema,
    version: SemverCoreSchema,
    descriptor: CapabilityDescriptorSchema,
    contracts: z.array(CapabilityContractReferenceSchema).readonly(),
    trust: CapabilityTrustSchema,
  })
  .readonly()
  .refine(
    (manifest) =>
      new Set(manifest.contracts.map((reference) => reference.contractId)).size ===
      manifest.contracts.length,
    'contract ids must be unique within a manifest',
  )
  .meta({
    id: 'CapabilityManifest',
    title: 'CapabilityManifest',
    description:
      'Immutable, content-addressed capability registration document: id, category, version, descriptor, honored contracts, and trust surface.',
  });

/** The registry's published record: manifest + lifecycle + content address. */
export const CapabilityRecordSchema = z
  .strictObject({
    schemaVersion: CapabilityManifestVersionSchema,
    manifest: CapabilityManifestSchema,
    lifecycle: CapabilityLifecycleStateSchema,
    manifestDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityRecord',
    title: 'CapabilityRecord',
    description:
      'Published registry record: the immutable capability manifest, its lifecycle state, and the SHA-256 digest of the manifest content.',
  });

/** A version constraint (exact pin or caret compatibility). */
export const VersionConstraintSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('exact'), version: SemverCoreSchema }).readonly(),
    z.strictObject({ kind: z.literal('caret'), version: SemverCoreSchema }).readonly(),
  ])
  .meta({
    id: 'VersionConstraint',
    title: 'VersionConstraint',
    description:
      'Version constraint: an exact pin, or caret major-version compatibility (npm-caret semantics incl. the 0.x carve-outs).',
  });
