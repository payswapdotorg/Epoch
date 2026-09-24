/**
 * Agent authority declaration.
 *
 * The architecture lock is encoded structurally (lock rules 2/3): agents
 * PROPOSE actions; only the Action Gateway authorizes and executes. A
 * registration therefore carries proposal authority only, and
 * `executionAuthority` is a literal that admits exactly one value — `"none"`.
 * Granting agents any execution authority would require a major protocol
 * version change (and, in the architecture, an Architecture Change Request).
 */
import { z } from 'zod';
import { QualifiedTypeReferenceSchema } from './primitives';

export const AuthorityDeclarationSchema = z
  .strictObject({
    /** Structurally fixed: the only admitted value is "none". */
    executionAuthority: z.literal('none'),
    /** Action types this agent may propose (at least one). */
    proposableActionTypes: z.array(QualifiedTypeReferenceSchema).min(1),
    /** Whether every proposal from this agent needs a human co-signature. */
    requiresHumanCosign: z.boolean(),
  })
  .meta({
    id: 'AuthorityDeclaration',
    title: 'AuthorityDeclaration',
    description:
      'Proposal-scoped authority: action types the agent may propose. Execution authority is structurally "none" — only the Action Gateway authorizes execution.',
  });

export type AuthorityDeclaration = z.infer<typeof AuthorityDeclarationSchema>;
