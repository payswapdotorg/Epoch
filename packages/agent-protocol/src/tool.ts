/**
 * Tool declarations: the neutral unit with which a registered agent declares
 * which external capabilities it can use. A tool references the Epoch
 * Capability Fabric adapter categories (architecture.md) — a category names a
 * role in the fabric, never a vendor product.
 */
import { z } from 'zod';
import { QUALIFIED_NAME_PATTERN } from './primitives';

/**
 * Canonical Capability Fabric adapter categories (architecture.md,
 * "Capability Fabric"). Provider-neutral by construction: a tool that talks
 * to any specific external system does so behind an adapter, not through
 * protocol vocabulary.
 */
export const CAPABILITY_FABRIC_CATEGORIES = [
  'source',
  'semantic',
  'reconstruction',
  'visualization',
  'simulation',
  'evaluator',
  'action',
  'verification',
] as const;

/** Tool id: `tool:` + namespaced slug. */
export const TOOL_ID_PATTERN = /^tool:[a-z0-9][a-z0-9.-]{0,80}$/;

export const ToolDeclarationSchema = z
  .strictObject({
    toolId: z.string().regex(TOOL_ID_PATTERN),
    summary: z.string().min(1).max(500),
    category: z.enum(CAPABILITY_FABRIC_CATEGORIES),
    capabilityRef: z.string().regex(QUALIFIED_NAME_PATTERN).optional(),
  })
  .meta({
    id: 'ToolDeclaration',
    title: 'ToolDeclaration',
    description:
      'Neutral declaration of a tool an agent can use, categorized by Capability Fabric adapter category.',
  });

export type ToolDeclaration = z.infer<typeof ToolDeclarationSchema>;
