/**
 * The sandbox SUBJECT description — the STRUCTURAL MIRROR of W008's
 * `SandboxSurfaceDescription` (extension id + version + manifest
 * digest + flavor + trust class + capability bindings + grants +
 * optional marketplace listing reference).
 *
 * The mirror is the W036/W038/W043 kernel convention: the fields are
 * field-for-field identical to the REAL W008 surface (pinned by
 * src/kernel-parity.ts compile-time + test/parity.test.ts runtime —
 * a REAL W008 SandboxSurfaceDescription parses through this schema
 * unchanged), but @epoch/extension-runtime stays a devDependency,
 * never a runtime edge. Cross-kernel vocabulary (trust classes,
 * flavors, host functions, resource scopes) is carried as BOUNDED
 * NEUTRAL tokens here and enforced against the MIRRORED closed
 * tables by the isolation check — this kernel never re-declares a
 * sibling authority's semantics, it verifies conformance to the
 * mirrored tables.
 */
import { z } from 'zod';
import {
  CapabilityBindingTokenSchema,
  HostFunctionTokenSchema,
  ResourceScopeTokenSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SubjectIdSchema,
} from './primitives';
import { OBSERVABILITY_RECORD_VERSION } from './version';

/** One grant of the sandbox subject (W008 GrantDescription, mirrored). */
export const SandboxGrantSchema = z
  .strictObject({
    capabilityId: z.string().min(3).max(128),
    hostFunctions: z.array(HostFunctionTokenSchema).max(16).readonly(),
    resourceScopes: z.array(ResourceScopeTokenSchema).max(8).readonly(),
  })
  .readonly()
  .meta({
    id: 'SandboxGrant',
    title: 'SandboxGrant',
    description:
      'One sandbox grant (the W008 shape): the capability it grounds plus the host functions and resource scopes it requests.',
  });

/** One sandbox grant. */
export type SandboxGrant = z.infer<typeof SandboxGrantSchema>;

/** One capability binding of the sandbox subject (opaque typed reference). */
export const SandboxBindingSchema = z
  .strictObject({
    capabilityId: CapabilityBindingTokenSchema,
  })
  .readonly()
  .meta({
    id: 'SandboxBinding',
    title: 'SandboxBinding',
    description:
      'One resolved capability binding of a sandbox subject (an opaque typed reference into the W007 registry).',
  });

/** One sandbox capability binding. */
export type SandboxBinding = z.infer<typeof SandboxBindingSchema>;

/**
 * The sandbox subject description — the W008 SandboxSurfaceDescription
 * mirror plus the optional marketplace listing reference (the W023
 * provenance the isolation profile may REQUIRE).
 */
export const SandboxSubjectSchema = z
  .strictObject({
    schemaVersion: z.literal(OBSERVABILITY_RECORD_VERSION),
    extensionId: SubjectIdSchema,
    extensionVersion: SemverCoreSchema,
    extensionManifestDigest: Sha256HexSchema,
    flavor: z.string().min(1).max(32),
    trustClass: z.string().regex(/^t[0-4]$/),
    bindings: z.array(SandboxBindingSchema).max(32).readonly(),
    grants: z.array(SandboxGrantSchema).max(32).readonly(),
    dataHandling: z.string().min(1).max(32),
    /** Optional marketplace listing reference (W023 provenance; REQUIRED by profiles with requireMarketplaceListing). */
    listingId: z.string().regex(/^listing:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
  })
  .readonly()
  .meta({
    id: 'SandboxSubject',
    title: 'SandboxSubject',
    description:
      'The sandbox admission subject (the W008 SandboxSurfaceDescription shape mirrored): extension identity + version + manifest digest + flavor + trust class + capability bindings + grants + data-handling classification + optional marketplace listing reference.',
  });

/** One sandbox subject description. */
export type SandboxSubject = z.infer<typeof SandboxSubjectSchema>;
