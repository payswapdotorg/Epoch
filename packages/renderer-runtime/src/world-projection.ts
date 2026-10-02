/**
 * The WORLD PROJECTION REFERENCE (W056) — the canonical identity of the
 * world an ephemeral renderer session presents: the world-experience
 * scene id, the CONTENT DIGEST of the exact canonical world-scene
 * revision, and the owning tenant scope.
 *
 * This is the identity triple that MUST survive a renderer switch
 * unchanged (the switching invariant: "verify digest/tenant
 * compatibility" before mounting the target). Entities are referenced
 * opaquely by id and digest — never embedded (the W002 discipline; the
 * world model stays the single semantic authority).
 */
import { z } from 'zod';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import { Sha256HexSchema } from './primitives';
import { WorldSceneIdMirrorSchema } from './fabric-primitives';

/**
 * The canonical world projection reference: scene id + world digest +
 * tenant scope. The digest is the content digest of the sealed W016 world
 * scene (the canonical Epoch projection) — the continuity anchor of every
 * mount and switch.
 */
export const WorldProjectionRefSchema = z
  .strictObject({
    sceneId: WorldSceneIdMirrorSchema,
    worldDigest: Sha256HexSchema,
    tenantScope: TenantScopeSchema,
  })
  .meta({
    id: 'WorldProjectionRef',
    title: 'WorldProjectionRef',
    description:
      'The canonical world projection reference: world-experience scene id, content digest of the exact scene revision, and owning tenant scope — the identity triple that survives renderer switching.',
  });

/** One world projection reference. */
export type WorldProjectionRef = z.infer<typeof WorldProjectionRefSchema>;
