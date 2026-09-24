/**
 * Evidence requirements: what a registered agent must attach to its action
 * proposals for them to be admissible. The protocol carries the requirements
 * as neutral booleans and artifact-kind slugs; the verification/evidence
 * domain (W006) owns evidence semantics and formats.
 */
import { z } from 'zod';
import { SLUG_PATTERN } from './primitives';

export const EvidenceRequirementsSchema = z
  .strictObject({
    requiresRationale: z.boolean(),
    requiresPredictedEffects: z.boolean(),
    requiresEvidenceRefs: z.boolean(),
    requiredArtifactKinds: z.array(z.string().regex(SLUG_PATTERN)),
  })
  .meta({
    id: 'EvidenceRequirements',
    title: 'EvidenceRequirements',
    description:
      'What evidence an agent must attach to action proposals (rationale, predicted effects, references, artifact kinds).',
  });

export type EvidenceRequirements = z.infer<typeof EvidenceRequirementsSchema>;
